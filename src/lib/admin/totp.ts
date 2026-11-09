// src/lib/admin/totp.ts — RFC 6238 time-based one-time passwords (Google Authenticator, Authy, 1Password...). No dependencies.
import { hmac, timingSafeEqual } from './crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, val = 0, out = '';
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0; const out: number[] = [];
  for (const ch of clean) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export const newTotpSecret = () => base32Encode(globalThis.crypto.getRandomValues(new Uint8Array(20)));

export async function totpAt(secretB32: string, counter: number, digits = 6): Promise<string> {
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 255; c = Math.floor(c / 256); }
  const h = await hmac(base32Decode(secretB32), msg, 'SHA-1');
  const o = h[h.length - 1] & 15;
  const bin = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}
export const stepOf = (ms: number, period = 30) => Math.floor(ms / 1000 / period);

/** Returns the matching time step (so the caller can refuse a replay) or null. Accepts one step either side for clock drift. */
export async function verifyTotp(secretB32: string, code: string, now = Date.now()): Promise<number | null> {
  const clean = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const enc = new TextEncoder();
  for (const d of [0, -1, 1]) {
    const step = stepOf(now) + d;
    if (timingSafeEqual(enc.encode(await totpAt(secretB32, step)), enc.encode(clean))) return step;
  }
  return null;
}
export const otpauthUri = (secret: string, account: string, issuer = 'SYS_PORTFOLIO') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
