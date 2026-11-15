// src/lib/admin/brain.ts — owner-taught answers for the chat assistant ("home training").
// Stored in the same key/value store as everything else; served publicly (read-only) by /api/brain and merged into the
// assistant's knowledge at runtime, so a new answer reaches every visitor without a redeploy.
import { db } from './store';

export interface Taught {
  id: string;
  /** Ways a visitor might ask it. The first one doubles as the title. */
  q: string[];
  /** The reply, shown as written (light **bold** / lists work). */
  a: string;
  /** Optional page the reply offers as a button, e.g. /services. */
  link?: string;
  /** Hidden entries stay saved but are not served. */
  off?: boolean;
  t: number;
}

const KEY = 'brain:v1';
export const MAX_ENTRIES = 300;

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '');

export function sanitizeTaught(raw: unknown): Taught[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Taught[] = [];
  for (const r of raw.slice(0, MAX_ENTRIES)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const q = (Array.isArray(o.q) ? o.q : []).map((x) => clean(x, 160)).filter((x) => x.length >= 2).slice(0, 12);
    const a = clean(o.a, 1800);
    if (!q.length || a.length < 2) continue;
    let id = clean(o.id, 40).replace(/[^a-z0-9_-]/gi, '') || 'b' + Math.random().toString(36).slice(2, 9);
    while (seen.has(id)) id += 'x';
    seen.add(id);
    const link = clean(o.link, 120);
    out.push({ id, q, a, link: /^\/[a-z0-9\/_\-?=&#.]*$/i.test(link) ? link : undefined, off: o.off === true ? true : undefined, t: typeof o.t === 'number' ? o.t : Date.now() });
  }
  return out;
}

export const readBrain = async (): Promise<Taught[]> => sanitizeTaught(await db.getJSON<unknown>(KEY, []));
export async function writeBrain(list: unknown): Promise<Taught[]> {
  const clean = sanitizeTaught(list);
  await db.setJSON(KEY, clean);
  return clean;
}
