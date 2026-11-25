// src/server/auth.ts — single-owner admin access. Layers (all optional ones are env-controlled):
//   1. ADMIN_PASSWORD (required, 10+ chars)        2. ADMIN_TOTP_SECRET → authenticator-app 6-digit code (2FA)
//   3. ADMIN_ALLOWED_IPS → only these IPs may even reach the admin API
//   4. rate limit + GLOBAL lockout against distributed guessing     5. signed httpOnly SameSite=Strict cookie, 8h
//   6. "log out all devices" (session epoch)                        7. audit log + email alert on every sign-in
import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { readJson, update, storageInfo } from './store';
import { clientIp } from './util';

const COOKIE = 'sys_admin';
const TTL_SECONDS = 8 * 3600;

/* ───────── credentials: saved in the panel, with the Vercel variables as the reset switch ─────────
 * Passwords/2FA changed inside the panel are stored (scrypt hash for the password) and win over the environment variables.
 * Each saved value remembers a fingerprint of the env variable it replaced; if you later CHANGE that variable in Vercel the
 * saved value is ignored and the env value is in charge again. So a lock-out is always fixable: edit ADMIN_PASSWORD (or
 * ADMIN_TOTP_SECRET) in Vercel and redeploy. */
interface Creds { pw?: string; pwFp?: string; totp?: string | null; totpFp?: string; rec?: string[]; at?: string }
const fp = (v: string | undefined) => crypto.createHash('sha256').update('fp:' + (v || '')).digest('hex').slice(0, 16);
const readCreds = () => readJson<Creds>('admin-creds', {});
const envPw = () => process.env.ADMIN_PASSWORD || '';
const envTotp = () => process.env.ADMIN_TOTP_SECRET || '';

async function effective(): Promise<{ pwHash: string | null; totp: string; rec: string[] }> {
  const c = await readCreds();
  const pwHash = c.pw && c.pwFp === fp(envPw()) ? c.pw : null;
  const savedTotp = c.totp !== undefined && c.totpFp === fp(envTotp());
  const totp = savedTotp ? (c.totp || '') : envTotp();
  return { pwHash, totp, rec: savedTotp && c.totp ? (c.rec || []) : [] };
}
/* One-time recovery codes ("abcd-1234"): for a lost phone. Only their hashes are stored; each works once. */
const recHash = (code: string) => crypto.createHash('sha256').update('rec:' + code.toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex');
const newRecoveryCodes = () => Array.from({ length: 8 }, () => { const h = crypto.randomBytes(4).toString('hex'); return `${h.slice(0, 4)}-${h.slice(4)}`; });
const hashPw = (pw: string) => { const salt = crypto.randomBytes(16).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 32).toString('hex')}`; };
const verifyHash = (pw: string, h: string) => {
  const [, salt, hex] = h.split('$');
  if (!salt || !hex) return false;
  const a = crypto.scryptSync(pw, salt, 32), b = Buffer.from(hex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export async function adminConfigured(): Promise<boolean> { return envPw().length >= 10 || !!(await effective()).pwHash; }
export async function totpRequired(): Promise<boolean> { return !!(await effective()).totp; }
export async function credentialState() {
  const e = await effective();
  return { passwordSaved: !!e.pwHash, totpEnabled: !!e.totp, totpSaved: !!e.totp && e.totp !== envTotp(), recoveryLeft: e.rec.length, persistent: storageInfo().persistent };
}

/** Saves a new password. Ends every other session (the caller then signs the current device in again). */
export async function savePassword(next: string) {
  if (!storageInfo().persistent) throw new Error('Saving needs permanent storage (connect Upstash Redis). Until then, change ADMIN_PASSWORD in Vercel.');
  if (next.length < 10) throw new Error('Use at least 10 characters.');
  await update<Creds>('admin-creds', {}, (c) => { c.pw = hashPw(next); c.pwFp = fp(envPw()); c.at = new Date().toISOString(); });
  await logoutEverywhere();
}
/** secret = base32 string to turn 2FA on/rotate, or null to switch it off. Returns fresh recovery codes (shown once) when turning on. */
export async function saveTotp(secret: string | null): Promise<string[]> {
  if (!storageInfo().persistent) throw new Error('Saving needs permanent storage (connect Upstash Redis). Until then, use ADMIN_TOTP_SECRET in Vercel.');
  const codes = secret ? newRecoveryCodes() : [];
  await update<Creds>('admin-creds', {}, (c) => { c.totp = secret; c.totpFp = fp(envTotp()); c.rec = codes.map(recHash); c.at = new Date().toISOString(); });
  lastTotpStep.clear();
  await logoutEverywhere();
  return codes;
}
/** New set of recovery codes for the 2FA that is currently saved in the panel (old ones stop working). */
export async function regenRecoveryCodes(): Promise<string[]> {
  const e = await effective();
  if (!e.totp) throw new Error('Turn two-factor on first.');
  if (!storageInfo().persistent) throw new Error('Saving needs permanent storage (connect Upstash Redis).');
  const codes = newRecoveryCodes();
  await update<Creds>('admin-creds', {}, (c) => { c.totp = e.totp; c.totpFp = fp(envTotp()); c.rec = codes.map(recHash); });
  return codes;
}
/**
 * Cookie signing key. It must NOT be derived from the admin password (anyone holding a cookie could then guess the
 * password offline). Use ADMIN_SESSION_SECRET when set (16+ chars), otherwise a random key created once and kept in the data folder.
 */
let cachedKey: Buffer | null = null;
async function signingKey(): Promise<Buffer> {
  const env = process.env.ADMIN_SESSION_SECRET || '';
  if (env.length >= 16) return Buffer.from(env);
  if (cachedKey) return cachedKey;
  // Serverless host with no persistent storage and no secret: a random key kept in /tmp differs on every instance, so the
  // cookie set by one instance is rejected by the next (login loop). Derive a stable key from the password with a slow KDF
  // instead (a cookie holder would have to brute-force scrypt per guess). Setting ADMIN_SESSION_SECRET or connecting
  // Upstash Redis is still the recommended setup and avoids this path entirely.
  if (!storageInfo().persistent && process.env.VERCEL && envPw().length >= 10) {
    cachedKey = crypto.scryptSync(process.env.ADMIN_PASSWORD as string, 'sys-portfolio/admin-cookie/v1', 32);
    return cachedKey;
  }
  const rec = await update<{ epoch: number; key?: string }>('admin', { epoch: 0 }, (d) => { if (!d.key || d.key.length < 64) d.key = crypto.randomBytes(32).toString('hex'); });
  cachedKey = Buffer.from(rec.key as string, 'hex');
  return cachedKey;
}
const sign = async (v: string) => crypto.createHmac('sha256', await signingKey()).update(v).digest('base64url');
const sha = (s: string) => crypto.createHash('sha256').update(s).digest();
const safeEq = (a: string, b: string) => { const x = sha(a), y = sha(b); return crypto.timingSafeEqual(x, y); };

export async function checkPassword(pw: string): Promise<boolean> {
  const { pwHash } = await effective();
  if (pwHash) return verifyHash(pw, pwHash);
  if (envPw().length < 10) return false;
  return crypto.timingSafeEqual(sha(pw), sha(envPw()));
}

/* ───────── 2FA (TOTP, RFC 6238) ───────── */
function b32decode(s: string): Buffer {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/[=\s]+/g, '').toUpperCase()) { const v = A.indexOf(c); if (v >= 0) bits += v.toString(2).padStart(5, '0'); }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function hotp(key: Buffer, counter: number): string {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(b).digest();
  const o = h[19] & 15;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, '0');
}
const lastTotpStep = new Map<string, number>(); // replay guard, per secret
export async function verifyTotp(code: string): Promise<boolean> {
  const e = await effective();
  if (!e.totp) return true;
  if (checkTotpCode(e.totp, code)) return true;
  // a recovery code (lost phone): valid once, then removed
  const raw = String(code || '').trim();
  if (e.rec.length && /^[0-9a-f]{4}[-\s]?[0-9a-f]{4}$/i.test(raw)) {
    const h = recHash(raw);
    if (e.rec.includes(h)) { await update<Creds>('admin-creds', {}, (c) => { c.rec = (c.rec || []).filter((x) => x !== h); }); return true; }
  }
  return false;
}
/** Checks a code against a given base32 secret (also used to prove a NEW secret works before saving it). */
export function checkTotpCode(sec: string, code: string): boolean {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  const key = b32decode(sec);
  const step = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) {
    if (safeEq(hotp(key, step + d), c)) {
      if (step + d <= (lastTotpStep.get(sec) || 0)) return false; // a code can only be used once
      lastTotpStep.set(sec, step + d);
      return true;
    }
  }
  return false;
}

/* ───────── IP allow-list ───────── */
export function ipAllowed(req: Request): boolean {
  const list = (process.env.ADMIN_ALLOWED_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return !list.length || list.includes(clientIp(req));
}

/* ───────── global lockout ───────── */
const fails: number[] = [];
const WINDOW = 15 * 60_000;
export function lockedOut(): boolean {
  const now = Date.now();
  while (fails.length && now - fails[0] > WINDOW) fails.shift();
  return fails.length >= 40; // high on purpose: a stranger must not be able to lock the owner out with a few bad guesses (each IP is also limited to 6 tries)
}
export const noteFailure = () => { fails.push(Date.now()); };

/* ───────── sessions (with revocable epoch) ───────── */
async function epoch(): Promise<number> {
  return (await readJson<{ epoch: number }>('admin', { epoch: 0 })).epoch;
}
export async function logoutEverywhere() {
  await update<{ epoch: number }>('admin', { epoch: 0 }, (d) => { d.epoch = (d.epoch || 0) + 1; });
}

export async function createSession() {
  const payload = `${Math.floor(Date.now() / 1000) + TTL_SECONDS}.${await epoch()}`;
  (await cookies()).set(COOKIE, `${payload}.${await sign(payload)}`, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TTL_SECONDS,
  });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

export interface AdminSession { exp: number; epoch: number }
/** Verifies a raw `sys_admin` cookie value. Shared by isAdmin() (server components / actions) and adminSession() (route handlers). */
async function verifyRaw(raw: string | undefined | null): Promise<AdminSession | null> {
  if (!raw || !(await adminConfigured())) return null;
  const [exp, ep, sig] = raw.split('.');
  if (!exp || ep === undefined || !sig || Number(exp) < Date.now() / 1000) return null;
  const expected = await sign(`${exp}.${ep}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(ep) !== (await epoch())) return null;
  return { exp: Number(exp), epoch: Number(ep) };
}

export async function isAdmin(): Promise<boolean> {
  return !!(await verifyRaw((await cookies()).get(COOKIE)?.value));
}

/** Same check for code that only has a Request (the extra /api/admin/* tool routes). Also honours the IP allow-list. */
export async function adminSession(req: Request): Promise<AdminSession | null> {
  if (!ipAllowed(req)) return null;
  const raw = req.headers.get('cookie') || '';
  let value: string | null = null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) { value = part.slice(i + 1).trim(); break; }
  }
  return verifyRaw(value);
}

/* ───────── audit log ───────── */
export interface AuditEntry { at: string; ip: string; ua: string; event: string; ok: boolean }
export async function audit(req: Request, event: string, ok: boolean) {
  const entry: AuditEntry = { at: new Date().toISOString(), ip: clientIp(req), ua: (req.headers.get('user-agent') || '').slice(0, 120), event, ok };
  try { await update<AuditEntry[]>('audit', [], (a) => { a.unshift(entry); if (a.length > 300) a.length = 300; }); } catch { /* never block auth on logging */ }
  return entry;
}
export const readAudit = () => readJson<AuditEntry[]>('audit', []);
/** Empties the sign-in log, but leaves one entry saying who did it, so clearing can never be silent. */
export async function clearAudit(req: Request) {
  await update<AuditEntry[]>('audit', [], (a) => { a.length = 0; });
  await audit(req, 'audit-cleared', true);
}
