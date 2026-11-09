// src/lib/admin/crypto.ts — small Web-Crypto helpers (work on Node 18+, Vercel and in the browser tests). No dependencies.
const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

export const b64u = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = (s: string): Uint8Array => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(p);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export async function hmac(key: string | Uint8Array, data: string | Uint8Array, hash: 'SHA-256' | 'SHA-1' = 'SHA-256'): Promise<Uint8Array> {
  const k = await subtle().importKey('raw', (typeof key === 'string' ? enc.encode(key) : key) as BufferSource, { name: 'HMAC', hash }, false, ['sign']);
  return new Uint8Array(await subtle().sign('HMAC', k, (typeof data === 'string' ? enc.encode(data) : data) as BufferSource));
}
export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await subtle().digest('SHA-256', enc.encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
/** Constant-time string comparison that doesn't leak the length (both sides are hashed first). */
export async function safeEqual(a: string, b: string, salt = 'cmp'): Promise<boolean> {
  return timingSafeEqual(await hmac(salt, a), await hmac(salt, b));
}
export const randomToken = (bytes = 16): string => b64u(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export function randomCode(len = 8): string {
  const r = globalThis.crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (const b of r) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}
