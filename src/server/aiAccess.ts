// src/server/aiAccess.ts
//
// Who may use the cloud model, and how much. Free visitors get a daily number of AI answers; when it runs out the chat
// quietly keeps working on the built-in rules engine (the client switches itself). People who want more redeem an
// "access pass" (a code you generate in /admin/ai-access, or one you approve after a mobile-money payment).
//
//  * A visitor is a signed cookie ("device"), plus a per-IP daily cap so clearing cookies is not a free refill.
//  * Days roll over at midnight in AI_TZ_HOURS (default +3 = Kampala).
//  * Passes: N extra answers (valid for D days) or unlimited (valid for D days). Free answers are spent first.
//  * Everything is stored with server/store (persistent with Upstash Redis; otherwise it resets when the instance restarts).
//  * Payment is MANUAL on purpose (same as /api/pay): the visitor sends money, submits the transaction id, you approve.
import 'server-only';
import crypto from 'node:crypto';
import { readJson, update } from './store';

export interface Plan { id: string; name: string; price: string; messages: number; days: number; note: string } // messages 0 = unlimited
export interface AccessConfig {
  enabled: boolean;
  dailyFree: number;      // answers per device per day
  ipDailyCap: number;     // answers per IP per day (free tier only)
  maxDevicesPerPass: number;
  plans: Plan[];
  payInfo: string;        // shown to visitors: where to send money, who to contact
}
export interface Pass { code: string; plan: string; label: string; messages: number; used: number; expires: number; created: number; note: string; revoked: boolean; devices: string[] }
export interface PassRequest { id: string; plan: string; name: string; contact: string; txId: string; at: number; status: 'pending' | 'approved' | 'rejected'; device: string; code?: string }
interface PassDb { passes: Record<string, Pass>; byDevice: Record<string, string>; requests: PassRequest[] }
interface Usage { day: string; dev: Record<string, number>; ip: Record<string, number>; total: number; paid: number; devices: number }

const envNum = (k: string, d: number, lo: number, hi: number) => {
  const n = parseInt((process.env[k] || '').trim(), 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export const DEFAULT_PLANS: Plan[] = [
  { id: 'boost', name: 'Boost', price: 'UGX 5,000', messages: 200, days: 30, note: '200 extra AI answers for 30 days' },
  { id: 'plus', name: 'Plus', price: 'UGX 15,000', messages: 1000, days: 30, note: '1,000 extra AI answers for 30 days' },
  { id: 'unlimited', name: 'Unlimited', price: 'UGX 30,000', messages: 0, days: 30, note: 'No daily limit for 30 days' },
];
function defaultPayInfo(): string {
  const mtn = process.env.MOMO_MTN_NUMBER, air = process.env.MOMO_AIRTEL_NUMBER, nm = process.env.MOMO_ACCOUNT_NAME;
  const lines = [mtn && `MTN MoMo: ${mtn}`, air && `Airtel Money: ${air}`, nm && `Name: ${nm}`].filter(Boolean);
  return lines.length ? `Send the amount to:\n${lines.join('\n')}` : '';
}
/** What the owner sees while signed in to /admin: always unlimited. */
export const OWNER_QUOTA: Quota = { enabled: true, plan: 'unlimited', planName: 'Owner', left: -1, limit: 0, freeLeft: -1, passLeft: -1, resetAt: 0, expires: 0 };
export const defaultConfig = (): AccessConfig => ({
  enabled: true,
  dailyFree: envNum('AI_FREE_DAILY', 15, 0, 1000),
  ipDailyCap: envNum('AI_IP_DAILY_CAP', 60, 1, 5000),
  maxDevicesPerPass: 2,
  plans: DEFAULT_PLANS,
  payInfo: defaultPayInfo(),
});

const CFG = 'ai-access-config';
const PASSES = 'ai-access-passes';
const usageKey = (day: string) => `ai-usage-${day}`;

export async function getConfig(): Promise<AccessConfig> {
  const stored = await readJson<Partial<AccessConfig>>(CFG, {});
  return sanitizeConfig({ ...defaultConfig(), ...stored });
}
export function sanitizeConfig(c: Partial<AccessConfig>): AccessConfig {
  const d = defaultConfig();
  const int = (v: unknown, lo: number, hi: number, fb: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; };
  const plans = (Array.isArray(c.plans) ? c.plans : d.plans).slice(0, 8).map((p, i): Plan => ({
    id: String(p?.id || `plan${i + 1}`).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || `plan${i + 1}`,
    name: String(p?.name || 'Plan').slice(0, 30),
    price: String(p?.price || '').slice(0, 40),
    messages: int(p?.messages, 0, 1_000_000, 0),
    days: int(p?.days, 1, 365, 30),
    note: String(p?.note || '').slice(0, 120),
  }));
  const seen = new Set<string>();
  return {
    enabled: c.enabled !== false,
    dailyFree: int(c.dailyFree, 0, 1000, d.dailyFree),
    ipDailyCap: int(c.ipDailyCap, 1, 5000, d.ipDailyCap),
    maxDevicesPerPass: int(c.maxDevicesPerPass, 1, 10, 2),
    plans: plans.filter((p) => !seen.has(p.id) && !!seen.add(p.id)),
    payInfo: String(c.payInfo || '').slice(0, 600),
  };
}
export const saveConfig = (c: Partial<AccessConfig>) => update<AccessConfig>(CFG, defaultConfig(), () => sanitizeConfig(c));

/* ------------------------------------------------------------------ day + device identity ------------------------------------------------------------------ */
export function dayKey(now = Date.now()): string {
  const off = envNum('AI_TZ_HOURS', 3, -12, 14);
  return new Date(now + off * 3_600_000).toISOString().slice(0, 10);
}
export function nextResetMs(now = Date.now()): number {
  const off = envNum('AI_TZ_HOURS', 3, -12, 14) * 3_600_000;
  const local = now + off;
  return (Math.floor(local / 86_400_000) + 1) * 86_400_000 - off;
}

const secret = () => process.env.AI_ACCESS_SECRET || process.env.ADMIN_SESSION_SECRET || 'sd-ai-access-dev-secret';
const sign = (id: string) => crypto.createHmac('sha256', secret()).update(id).digest('base64url').slice(0, 22);
export const COOKIE = 'sd_ai';

export interface Device { id: string; fresh: boolean; cookie: string }
export function deviceOf(req: Request): Device {
  const raw = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  const v = raw ? decodeURIComponent(raw.slice(COOKIE.length + 1)) : '';
  const [id, sig] = v.split('.');
  if (id && sig && /^[a-z0-9]{16}$/.test(id)) {
    const want = sign(id);
    if (sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return { id, fresh: false, cookie: '' };
  }
  const nid = crypto.randomBytes(12).toString('hex').slice(0, 16);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return { id: nid, fresh: true, cookie: `${COOKIE}=${nid}.${sign(nid)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}` };
}

/* ------------------------------------------------------------------ quota ------------------------------------------------------------------ */
export interface Quota {
  enabled: boolean;
  plan: 'free' | 'pass' | 'unlimited';
  planName: string;
  left: number;        // -1 = unlimited
  limit: number;       // free daily limit
  freeLeft: number;
  passLeft: number;    // -1 unlimited
  resetAt: number;
  expires: number;
}
const emptyUsage = (day: string): Usage => ({ day, dev: {}, ip: {}, total: 0, paid: 0, devices: 0 });

function activePass(db: PassDb, device: string, now: number): Pass | null {
  const code = db.byDevice[device];
  const p = code ? db.passes[code] : undefined;
  if (!p || p.revoked || (p.expires && p.expires < now)) return null;
  if (p.messages > 0 && p.used >= p.messages) return null;
  return p;
}

function summarize(cfg: AccessConfig, use: Usage, db: PassDb, device: string, ip: string, now = Date.now()): Quota {
  const p = activePass(db, device, now);
  const devUsed = use.dev[device] || 0, ipUsed = use.ip[ip] || 0;
  const freeLeft = Math.max(0, Math.min(cfg.dailyFree - devUsed, cfg.ipDailyCap - ipUsed));
  const passLeft = !p ? 0 : p.messages === 0 ? -1 : p.messages - p.used;
  const unlimited = !!p && p.messages === 0;
  return {
    enabled: cfg.enabled, limit: cfg.dailyFree, freeLeft, passLeft, resetAt: nextResetMs(now), expires: p?.expires || 0,
    plan: unlimited ? 'unlimited' : p ? 'pass' : 'free',
    planName: p ? p.label : 'Free',
    left: !cfg.enabled || unlimited ? -1 : freeLeft + Math.max(0, passLeft),
  };
}

export async function quotaFor(req: Request, dev: Device, ip: string): Promise<Quota> {
  const cfg = await getConfig();
  const [use, db] = await Promise.all([readJson<Usage>(usageKey(dayKey()), emptyUsage(dayKey())), readJson<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] })]);
  return summarize(cfg, use, db, dev.id, ip);
}

export type Spent = { ok: true; via: 'free' | 'pass' | 'open'; quota: Quota } | { ok: false; quota: Quota };

/** Atomically spends one answer. Free daily answers go first, then pass credit. Unlimited passes spend nothing. */
export async function spend(dev: Device, ip: string): Promise<Spent> {
  const cfg = await getConfig();
  if (!cfg.enabled) return { ok: true, via: 'open', quota: summarize(cfg, emptyUsage(dayKey()), { passes: {}, byDevice: {}, requests: [] }, dev.id, ip) };
  const day = dayKey(), now = Date.now();
  let via: 'free' | 'pass' | 'open' | null = null;
  const u = await update<Usage>(usageKey(day), emptyUsage(day), (use) => {
    use.dev ||= {}; use.ip ||= {};
    const devUsed = use.dev[dev.id] || 0, ipUsed = use.ip[ip] || 0;
    if (devUsed < cfg.dailyFree && ipUsed < cfg.ipDailyCap) {
      if (!devUsed) use.devices = (use.devices || 0) + 1;
      use.dev[dev.id] = devUsed + 1; use.ip[ip] = ipUsed + 1; use.total = (use.total || 0) + 1; via = 'free';
    }
  });
  const db0 = await readJson<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] });
  if (via) return { ok: true, via, quota: summarize(cfg, u, db0, dev.id, ip, now) };

  let paid = false;
  const db = await update<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] }, (d) => {
    const p = activePass(d, dev.id, now);
    if (!p) return;
    if (p.messages > 0) p.used += 1;
    paid = true;
  });
  if (paid) {
    await update<Usage>(usageKey(day), emptyUsage(day), (use) => { use.paid = (use.paid || 0) + 1; use.total = (use.total || 0) + 1; }).catch(() => undefined);
    return { ok: true, via: 'pass', quota: summarize(cfg, u, db, dev.id, ip, now) };
  }
  return { ok: false, quota: summarize(cfg, u, db, dev.id, ip, now) };
}

/** Gives the answer back when the model server failed, so visitors are never charged for an error. */
export async function refund(dev: Device, ip: string, via: 'free' | 'pass' | 'open'): Promise<void> {
  if (via === 'open') return;
  const day = dayKey();
  if (via === 'free') {
    await update<Usage>(usageKey(day), emptyUsage(day), (use) => {
      if ((use.dev?.[dev.id] || 0) > 0) { use.dev[dev.id] -= 1; use.total = Math.max(0, (use.total || 0) - 1); }
      if ((use.ip?.[ip] || 0) > 0) use.ip[ip] -= 1;
    }).catch(() => undefined);
  } else {
    await update<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] }, (d) => {
      const p = d.passes[d.byDevice[dev.id]];
      if (p && p.messages > 0 && p.used > 0) p.used -= 1;
    }).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ passes ------------------------------------------------------------------ */
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode(): string {
  const b = crypto.randomBytes(12);
  const s = Array.from(b, (x) => CHARS[x % CHARS.length]).join('');
  return `SD-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
export const normalizeCode = (v: unknown) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^SD/, '').replace(/(.{4})(.{4})(.{4}).*/, 'SD-$1-$2-$3');

export function makePass(plan: Plan | null, opts: { messages?: number; days?: number; label?: string; note?: string }): Pass {
  const days = Math.max(1, Math.min(3650, Math.floor(opts.days ?? plan?.days ?? 30)));
  return {
    code: newCode(), plan: plan?.id || 'custom', label: String(opts.label || plan?.name || 'Pass').slice(0, 30),
    messages: Math.max(0, Math.floor(opts.messages ?? plan?.messages ?? 0)), used: 0,
    expires: 0, // starts counting when first redeemed (see redeem)
    created: Date.now(), note: String(opts.note || '').slice(0, 120), revoked: false, devices: [],
    ...({ days } as object),
  } as Pass;
}
type PassWithDays = Pass & { days?: number };

export async function addPasses(passes: Pass[]): Promise<void> {
  await update<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] }, (d) => { for (const p of passes) d.passes[p.code] = p; });
}

export type Redeem = { ok: true; pass: Pass } | { ok: false; error: string };
export async function redeem(codeIn: unknown, dev: Device): Promise<Redeem> {
  const code = normalizeCode(codeIn);
  const cfg = await getConfig();
  let out: Redeem = { ok: false, error: 'That code was not recognised. Check it and try again.' };
  await update<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] }, (d) => {
    const p = d.passes[code] as PassWithDays | undefined;
    if (!p) return;
    if (p.revoked) { out = { ok: false, error: 'This pass has been cancelled. Please contact the studio.' }; return; }
    const now = Date.now();
    if (p.expires && p.expires < now) { out = { ok: false, error: 'This pass has expired.' }; return; }
    if (p.messages > 0 && p.used >= p.messages) { out = { ok: false, error: 'This pass has no answers left.' }; return; }
    if (!p.devices.includes(dev.id)) {
      if (p.devices.length >= cfg.maxDevicesPerPass) { out = { ok: false, error: 'This pass is already used on the maximum number of devices.' }; return; }
      p.devices.push(dev.id);
    }
    if (!p.expires) p.expires = now + (p.days || 30) * 86_400_000;
    d.byDevice[dev.id] = p.code;
    out = { ok: true, pass: p };
  });
  return out;
}

export async function getDb(): Promise<PassDb> {
  return readJson<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] });
}

/* ------------------------------------------------------------------ pass requests (manual payment) ------------------------------------------------------------------ */
export async function createRequest(dev: Device, r: { plan: string; name: string; contact: string; txId: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const cfg = await getConfig();
  const plan = cfg.plans.find((p) => p.id === r.plan);
  if (!plan) return { ok: false, error: 'Unknown plan.' };
  const id = crypto.randomBytes(5).toString('hex');
  let dup = false, tooMany = false;
  await update<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] }, (d) => {
    const tx = r.txId.toLowerCase();
    if (d.requests.some((q) => q.txId.toLowerCase() === tx)) { dup = true; return; }
    if (d.requests.filter((q) => q.device === dev.id && q.status === 'pending').length >= 3) { tooMany = true; return; }
    d.requests.unshift({ id, plan: plan.id, name: r.name, contact: r.contact, txId: r.txId, at: Date.now(), status: 'pending', device: dev.id });
    d.requests = d.requests.slice(0, 300);
  });
  if (dup) return { ok: false, error: 'That transaction id was already submitted.' };
  if (tooMany) return { ok: false, error: 'You already have pending requests. Please wait for approval.' };
  return { ok: true, id };
}

/** Approve: make a pass from the plan and attach it straight to the requesting device. */
export async function approveRequest(id: string): Promise<{ code: string; contact: string } | null> {
  const cfg = await getConfig();
  let res: { code: string; contact: string } | null = null;
  await update<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] }, (d) => {
    const q = d.requests.find((x) => x.id === id);
    if (!q || q.status !== 'pending') return;
    const plan = cfg.plans.find((p) => p.id === q.plan) || null;
    const pass = makePass(plan, { note: `Paid · ${q.name} · tx ${q.txId}` }) as PassWithDays;
    pass.devices = [q.device];
    pass.expires = Date.now() + (pass.days || 30) * 86_400_000;
    d.passes[pass.code] = pass;
    d.byDevice[q.device] = pass.code;
    q.status = 'approved'; q.code = pass.code;
    res = { code: pass.code, contact: q.contact };
  });
  return res;
}
export const rejectRequest = (id: string) => update<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] }, (d) => { const q = d.requests.find((x) => x.id === id); if (q && q.status === 'pending') q.status = 'rejected'; });
export const revokePass = (code: string) => update<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] }, (d) => { const p = d.passes[normalizeCode(code)]; if (p) p.revoked = true; });
export const deletePass = (code: string) => update<PassDb>(PASSES, { passes: {}, byDevice: {}, requests: [] }, (d) => {
  const c = normalizeCode(code); delete d.passes[c];
  for (const k of Object.keys(d.byDevice)) if (d.byDevice[k] === c) delete d.byDevice[k];
});

export async function usageToday(): Promise<{ day: string; total: number; paid: number; devices: number }> {
  const u = await readJson<Usage>(usageKey(dayKey()), emptyUsage(dayKey()));
  return { day: u.day, total: u.total || 0, paid: u.paid || 0, devices: u.devices || 0 };
}
export async function usageHistory(days = 7): Promise<Array<{ day: string; total: number; paid: number; devices: number }>> {
  const out: Array<{ day: string; total: number; paid: number; devices: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(Date.now() - i * 86_400_000);
    const u = await readJson<Usage>(usageKey(k), emptyUsage(k));
    out.push({ day: k, total: u.total || 0, paid: u.paid || 0, devices: u.devices || 0 });
  }
  return out;
}
