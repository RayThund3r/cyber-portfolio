// src/lib/admin/auth.ts
//
// Auth adapter for the extra admin tools (/admin/analytics, /admin/lab, ...). The site has ONE owner login: the one in
// `server/auth.ts` (ADMIN_PASSWORD, optional ADMIN_TOTP_SECRET / ADMIN_ALLOWED_IPS, signed httpOnly cookie, lockout,
// "log out all devices"). These tools simply accept that same session, so there is nothing second to sign in to.
//
//  * ADMIN_WEBHOOK_URL / ADMIN_NTFY_TOPIC (optional) get a ping for new tickets and failed logins (Discord, Slack, ntfy.sh).
//
// Every state-changing call also needs the `x-admin: 1` header plus a same-origin check (CSRF).
import { b64u, hmac } from './crypto';
import { db } from './store';
import { adminConfigured as ownerConfigured, adminSession } from '@/server/auth';

export const COOKIE = 'sys_admin';

export const adminEnv = () => ({
  password: process.env.ADMIN_PASSWORD || '',
  secret: process.env.ADMIN_SESSION_SECRET || '',
  totp: (process.env.ADMIN_TOTP_SECRET || '').replace(/\s+/g, ''),
  webhook: process.env.ADMIN_WEBHOOK_URL || '',
  ntfy: process.env.ADMIN_NTFY_TOPIC || '',
});
export const adminConfigured = ownerConfigured;

async function ipKey(): Promise<Uint8Array> {
  const e = adminEnv();
  return hmac(e.secret || e.password || 'sys-portfolio', 'sys-admin-iphash-v1');
}

export interface ClientInfo { ip: string; ipHash: string; ua: string; country: string; city: string }
export async function clientInfo(req: Request): Promise<ClientInfo> {
  const h = req.headers;
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim() || 'unknown';
  const ua = (h.get('user-agent') || '').slice(0, 300);
  const key = await ipKey().catch(() => new Uint8Array(1));
  const ipHash = b64u((await hmac(key, 'ip:' + ip)).slice(0, 9));
  let city = h.get('x-vercel-ip-city') || '';
  try { city = decodeURIComponent(city); } catch { /* keep raw */ }
  return { ip, ipHash, ua, country: (h.get('x-vercel-ip-country') || '').slice(0, 2).toUpperCase(), city: city.slice(0, 60) };
}

/* ------------------------------------------------------------------ session gate ------------------------------------------------------------------ */
export interface Session { sid: string; iat: number; exp: number; ep: number }

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
export const jsonResponse = json;

/** Gate for every extra /api/admin/* route. Returns the session, or a ready-made error Response. */
export async function requireAdmin(req: Request, mutating = false): Promise<{ session: Session } | { error: Response }> {
  if (!adminConfigured()) return { error: json({ error: 'Admin is disabled: set ADMIN_PASSWORD (10+ characters) in your environment.' }, 503) };
  const found = await adminSession(req);
  if (!found) return { error: json({ error: 'Not signed in.' }, 401) };
  if (mutating) {
    if (req.headers.get('x-admin') !== '1') return { error: json({ error: 'Missing x-admin header.' }, 403) };
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (origin && host) { try { if (new URL(origin).host !== host) return { error: json({ error: 'Cross-site request blocked.' }, 403) }; } catch { return { error: json({ error: 'Bad origin.' }, 403) }; } }
  }
  return { session: { sid: 'owner', iat: found.exp - 8 * 3600, exp: found.exp, ep: found.epoch } };
}

/* ------------------------------------------------------------------ audit + notifications ------------------------------------------------------------------ */
export interface AuditItem { t: number; kind: string; ok: boolean; who: string; country?: string; city?: string; ua?: string; note?: string }
export async function audit(item: Omit<AuditItem, 't'>): Promise<void> {
  try { await db.push('adm:audit', { t: Date.now(), ...item }, 300); } catch { /* never block on logging */ }
}
export async function notify(text: string): Promise<void> {
  const e = adminEnv();
  const send = (url: string, init: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(3500) }).catch(() => undefined);
  const tasks: Promise<unknown>[] = [];
  if (e.webhook && /^https:\/\//.test(e.webhook)) tasks.push(send(e.webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: text, text }) }));
  if (e.ntfy && /^[A-Za-z0-9_-]{3,64}$/.test(e.ntfy)) tasks.push(send('https://ntfy.sh/' + e.ntfy, { method: 'POST', body: text, headers: { Title: 'SYS_PORTFOLIO admin' } }));
  await Promise.all(tasks);
}

