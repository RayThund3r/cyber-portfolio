// src/lib/admin/siteconfig.ts — the few things the owner can change live from the panel (announcement bar, availability).
import { db } from './store';

export type Level = 'info' | 'success' | 'warn' | 'alert';
export interface SiteConfig {
  announce: { enabled: boolean; text: string; level: Level; href: string; expires: number; dismissible: boolean };
  availability: 'available' | 'busy' | 'away';
  availabilityNote: string;
}
export const DEFAULT_CONFIG: SiteConfig = {
  announce: { enabled: false, text: '', level: 'info', href: '', expires: 0, dismissible: true },
  availability: 'available',
  availabilityNote: '',
};
const KEY = 'site:config';

export function sanitize(input: unknown): SiteConfig {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const a = (o.announce && typeof o.announce === 'object' ? o.announce : {}) as Record<string, unknown>;
  const text = typeof a.text === 'string' ? a.text.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 240) : '';
  const href = typeof a.href === 'string' && /^(\/[A-Za-z0-9/_\-?=&#.]*|https:\/\/[^\s"'<>]{3,200})$/.test(a.href.trim()) ? a.href.trim() : '';
  const level: Level = ['info', 'success', 'warn', 'alert'].includes(a.level as string) ? (a.level as Level) : 'info';
  const exp = Number(a.expires);
  return {
    announce: { enabled: a.enabled === true && text.length > 0, text, level, href, expires: Number.isFinite(exp) && exp > 0 ? exp : 0, dismissible: a.dismissible !== false },
    availability: ['available', 'busy', 'away'].includes(o.availability as string) ? (o.availability as SiteConfig['availability']) : 'available',
    availabilityNote: typeof o.availabilityNote === 'string' ? o.availabilityNote.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 120) : '',
  };
}
export async function readConfig(): Promise<SiteConfig> {
  return sanitize(await db.getJSON<unknown>(KEY, DEFAULT_CONFIG));
}
export async function writeConfig(c: unknown): Promise<SiteConfig> {
  const clean = sanitize(c);
  await db.setJSON(KEY, clean);
  return clean;
}
/** What the public site is allowed to see: nothing when the announcement is off or expired. */
export function publicView(c: SiteConfig, now = Date.now()) {
  const live = c.announce.enabled && (!c.announce.expires || c.announce.expires > now);
  return { announce: live ? { text: c.announce.text, level: c.announce.level, href: c.announce.href, dismissible: c.announce.dismissible, id: String(c.announce.text.length) + ':' + c.announce.text.slice(0, 24) } : null, availability: c.availability, availabilityNote: c.availabilityNote };
}
