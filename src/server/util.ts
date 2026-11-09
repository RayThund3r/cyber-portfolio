// src/server/util.ts
import 'server-only';

export const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const oneLine = (v: unknown, max: number): string =>
  String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

export const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[\d\s\-+()]{6,30}$/;

/**
 * The visitor's IP, for rate limits and the admin allow-list. Headers a visitor can forge are NOT trusted blindly:
 * platform headers (Cloudflare, Vercel, Fly) come first; otherwise the entry of X-Forwarded-For added by OUR proxy
 * (counting TRUSTED_PROXY_HOPS from the right, default 1) is used, never the left-most value the visitor can set.
 */
export function clientIp(req: Request): string {
  const h = (n: string) => (req.headers.get(n) || '').trim();
  const direct = h('cf-connecting-ip') || h('x-vercel-forwarded-for') || h('fly-client-ip');
  if (direct) return direct.split(',')[0].trim().slice(0, 64);
  const xff = h('x-forwarded-for').split(',').map((x) => x.trim()).filter(Boolean);
  if (xff.length) {
    const hops = Math.max(1, Math.min(5, Number(process.env.TRUSTED_PROXY_HOPS) || 1));
    return xff[Math.max(0, xff.length - hops)].slice(0, 64);
  }
  return (h('x-real-ip') || 'unknown').slice(0, 64);
}

/** Reads a JSON request body without ever holding more than `maxBytes` in memory. */
export interface LimitedBody { ok: boolean; body: any; status: number; error: string }
export async function readJsonLimited(req: Request, maxBytes: number): Promise<LimitedBody> {
  const fail = (status: number, error: string): LimitedBody => ({ ok: false, body: null, status, error });
  const tooBig = fail(413, 'Request too large.');
  if (Number(req.headers.get('content-length') || 0) > maxBytes) return tooBig;
  const reader = req.body?.getReader();
  if (!reader) return fail(400, 'Invalid request.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { try { await reader.cancel(); } catch { /* already closed */ } return tooBig; }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return body && typeof body === 'object' && !Array.isArray(body) ? { ok: true, body, status: 200, error: '' } : fail(400, 'Invalid request.');
  } catch {
    return fail(400, 'Invalid request.');
  }
}

/** A link we are willing to store: an on-site /path (never //other-site or backslash tricks) or https://. */
export function safeLink(v: unknown, max = 600): string {
  const s = clean(v, max);
  if (/^\/(?![\/\\])[^\s\\]*$/.test(s) || /^https:\/\/[^\s"'<>\\]+$/i.test(s)) return s;
  return '';
}

/** Per-instance sliding-window limiter. Add host/WAF rate limits for real protection. */
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 8000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return hits.length > max;
}

/** True when `key` already hit its limit. Unlike rateLimit() this does not count a new attempt. */
export function isLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  return (buckets.get(key) || []).filter((t) => now - t < windowMs).length >= max;
}

/** Same-origin guard for browser-initiated mutations. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients; auth still required where it matters
  try {
    return new URL(origin).host === (req.headers.get('x-forwarded-host') || req.headers.get('host'));
  } catch {
    return false;
  }
}

export function digits(s: string): string {
  return s.replace(/\D/g, '');
}

/** Compare two phone numbers by their last 9 digits (handles 0700…, +256700… and 256700…). */
export function samePhone(a: string, b: string): boolean {
  const x = digits(a).slice(-9);
  const y = digits(b).slice(-9);
  return x.length >= 7 && x === y;
}

/** Uganda-friendly wa.me number: 0700… → 256700… */
export function toWaNumber(phone: string): string {
  const d = digits(phone);
  if (d.startsWith('0') && d.length === 10) return '256' + d.slice(1);
  return d;
}
