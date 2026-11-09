// src/lib/builder/pro.ts — reserved for "pro" (app-style) sites that the Site Engine in /engine will power.
//
// The upload this builder came from referenced this module but did not contain it. It is deliberately inert: no pro group
// exists, so sanitising a pro config keeps only the salt key, and readiness never raises pro warnings. The classic builder
// is unaffected. App-style sites (shop / booking / owner admin) are produced today by Admin → STUDIO instead.
import type { Field, SiteConfig } from './schema';

export interface ProGroup { id: string; label: string; fields: Field[] }
export const PRO_GROUPS: ProGroup[] = [];

/** A short random salt for the owner-passcode hash of a pro site. */
export function newProKey(): string {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const g = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  const bytes = new Uint8Array(10);
  if (g?.getRandomValues) g.getRandomValues(bytes); else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (const b of bytes) out += a[b % a.length];
  return out;
}

export const proWarnings = (_cfg: SiteConfig): string[] => [];
