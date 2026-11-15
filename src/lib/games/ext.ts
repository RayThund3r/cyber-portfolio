// src/lib/games/ext.ts — pure rules (no storage, safe for the browser) for web games the owner built (or likes) that get listed on /games and can be embedded.
// Stored next to everything else (key "games:ext:v1"), served read-only by /api/games. Everything is validated here, on the server.
export type EmbedMode = 'iframe' | 'tab';
export type Ratio = '16:9' | '4:3' | '3:2' | '1:1' | '9:16';

export interface ExtGame {
  id: string;
  title: string;
  /** The game's address. https only (http only for localhost while developing). */
  url: string;
  desc: string;
  /** Optional cover image address (https). */
  cover?: string;
  category: string;
  /** 'iframe' plays inside our page; 'tab' opens it in a new tab (for games that refuse to be embedded). */
  mode: EmbedMode;
  ratio: Ratio;
  tags: string[];
  off?: boolean;
  t: number;
}

export const MAX_EXT = 60;

/** CSS aspect-ratio value for a Ratio ('16:9' -> '16 / 9'). Unknown values fall back to 16 / 9. */
export function ratioCss(r: Ratio | string | undefined): string {
  return RATIOS.includes(r as Ratio) ? String(r).replace(':', ' / ') : '16 / 9';
}
export const RATIOS: Ratio[] = ['16:9', '4:3', '3:2', '1:1', '9:16'];

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '');

/** Returns the normalised address, or '' when it is not safe to link or embed. */
export function safeUrl(raw: unknown, opts: { allowLocalHttp?: boolean } = {}): string {
  const s = clean(raw, 400);
  if (!s) return '';
  let u: URL;
  try { u = new URL(s); } catch { return ''; }
  if (u.username || u.password) return '';
  if (u.protocol === 'https:') return u.toString();
  if (u.protocol === 'http:' && opts.allowLocalHttp !== false && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return u.toString();
  return '';
}

export function sanitizeExt(raw: unknown): ExtGame[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ExtGame[] = [];
  for (const r of raw.slice(0, MAX_EXT)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const title = clean(o.title, 60);
    const url = safeUrl(o.url);
    if (title.length < 2 || !url) continue;
    let id = clean(o.id, 40).replace(/[^a-z0-9_-]/gi, '') || 'x' + Math.random().toString(36).slice(2, 9);
    while (seen.has(id)) id += 'x';
    seen.add(id);
    const cover = safeUrl(o.cover, { allowLocalHttp: false });
    const ratio = RATIOS.includes(o.ratio as Ratio) ? (o.ratio as Ratio) : '16:9';
    const tags = (Array.isArray(o.tags) ? o.tags : []).map((t) => clean(t, 20).toLowerCase()).filter(Boolean).slice(0, 6);
    out.push({
      id, title, url, desc: clean(o.desc, 240), cover: cover || undefined, category: clean(o.category, 24) || 'Community',
      mode: o.mode === 'tab' ? 'tab' : 'iframe', ratio, tags, off: o.off === true ? true : undefined, t: typeof o.t === 'number' ? o.t : Date.now(),
    });
  }
  return out;
}

