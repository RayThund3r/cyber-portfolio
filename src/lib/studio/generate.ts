// src/lib/studio/generate.ts
//
// Turns Studio settings into ONE complete website file (index.html): the shared in-browser engine
// (slideshow, catalogue, cart, bookings/quotes, reviews, languages, owner admin) + this site's settings.
// Pure string building, so it runs both in the editor (live preview) and on the server (download, demo).
import { ENGINE_CSS_A, ENGINE_CSS_B, ENGINE_JS, GENERIC_TRD } from './engineData';
import { FONTS, SKINS, fontById, onColor, rgba } from './look';
import { contentOf, type StudioData } from './schema';
import { sha256Hex } from './sha256';

export interface BuildOpts {
  /** Where an uploaded picture lives: a data URL (preview), a relative path (download) or a URL (live demo). */
  assetUrl: (id: string) => string;
  /** Live demo build: no cloud database, no real admin passcode, separate storage key. */
  demo?: { adminPass: string | null; slug: string };
  /** Put the content-security policy in the page itself (for downloaded sites; the live demo sends it as a header). */
  cspMeta?: boolean;
  /** Owner passcode to use when the settings don't have one. */
  fallbackPass?: string;
}

const ASSET = /^asset:([a-z0-9]{8})$/;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** Studio fields are plain text, but the engine writes a few of them (section titles, services, reviews, questions,
 *  numbers) into the page as HTML. Escaping them here means "Tom & Jerry <3" shows as typed and markup can never run. */
const h = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** JSON that is safe inside a <script> block. */
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Deposit lines are matched against the (escaped) service names, so the name part is escaped the same way. */
const depositsEscaped = (txt: unknown) => String(txt ?? '').split('\n').map((l) => { const i = l.lastIndexOf('='); return i < 0 ? h(l) : h(l.slice(0, i)) + l.slice(i); }).join('\n');

export function hashContent(v: unknown): string {
  const s = JSON.stringify(v);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export function referencedAssetIds(d: StudioData): string[] {
  const ids = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') { const m = v.match(ASSET); if (m) ids.add(m[1]); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(d);
  return [...ids];
}

function paletteCss(d: StudioData, k: 'L' | 'D'): string {
  const bg = d['bg' + k], tx = d['tx' + k], ac = d['ac' + k];
  return `--bg:${bg};--card:${d['card' + k]};--tx:${tx};--mut:${rgba(tx, 0.62)};--ac:${ac};--ac2:${d['ac2' + k]};--on:${onColor(ac)};--ln:${rgba(tx, 0.13)};--glass:${rgba(bg, k === 'L' ? 0.78 : 0.75)};`;
}

/**
 * What a generated site is allowed to do: run its own inline script, load Google Fonts and pictures, and talk only to
 * its own cloud database (if one is set). No other scripts, frames, plugins or form posts. Blocks data theft and
 * outside code even if a bug were ever found.
 */
export function siteCsp(opts: { dburl?: string; extra?: string[] } = {}): string {
  let connect = "'none'";
  try { if (opts.dburl) connect = new URL(opts.dburl).origin; } catch { /* keep none */ }
  return [
    "default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com',
    "img-src 'self' https: data: blob:", `connect-src ${connect}`, "base-uri 'none'", "form-action 'none'", "object-src 'none'", ...(opts.extra ?? []),
  ].join('; ');
}

export function buildStudioSite(d: StudioData, opts: BuildOpts): string {
  const img = (v: string) => { const m = String(v || '').match(ASSET); return m ? opts.assetUrl(m[1]) : String(v || ''); };
  const hf = fontById(d.hf, 'heading'), bf = fontById(d.bf, 'body');
  const demo = opts.demo;

  const num = (v: unknown) => Number(v) || 0;
  const off: Record<string, boolean> = {};
  ([['shop', 'fShop'], ['wa', 'fWa'], ['rev', 'fRev'], ['fav', 'fFav'], ['lang', 'fLang'], ['news', 'fNews'], ['top', 'fTop'], ['track', 'fTrack']] as const).forEach(([k, f]) => { if (d[f] === false) off[k] = true; });

  // The owner passcode is never written into the page: only a SHA-256 hash of it (the engine compares hashes).
  // A random unguessable value fills the legacy plain-text slot, so an empty passcode can never log in.
  const key = demo ? `demo-${demo.slug}`.slice(0, 40) : String(d.key || 'site').replace(/[^a-z0-9-]/g, '').slice(0, 30) || 'site';
  const passcode = demo ? (demo.adminPass ?? '') : d.pass || opts.fallbackPass || '';
  const ph = passcode ? sha256Hex(`${key}:owner:${passcode}`) : sha256Hex(`${key}:locked:${hashContent([d.name, key, demo?.slug])}${hashContent(d)}`);
  const pass = `x${hashContent([key, 'legacy'])}${hashContent([d.name, 'legacy'])}`;
  const settings: Record<string, any> = {
    name: d.name, tag: d.tag, announce: d.announce, about: d.about, phone: d.phone, wa: d.wa, email: d.email, addr: d.addr, hours: d.hours,
    ig: d.ig, thanks: d.thanks, wamsg: d.wamsg, logo: '', ac: '', pass, ph,
    ...(d.fb ? { fb: d.fb } : {}), ...(d.tt ? { tt: d.tt } : {}), ...(d.yt ? { yt: d.yt } : {}), ...(d.favicon ? { favicon: img(d.favicon) } : {}),
    ...(d.defTheme === 'light' || d.defTheme === 'dark' ? { defTheme: d.defTheme } : {}),
    slSpeed: num(d.slSpeed) || 5.5, ...(Object.keys(off).length ? { off } : {}),
    mtn: d.mtn, mtnn: d.mtnn, airtel: d.airtel, airteln: d.airteln, bank: d.bank, fee: num(d.fee), paylink: d.paylink, slots: d.slots, closed: d.closed,
    ...(d.promos ? { promos: d.promos } : {}), ...(!demo && d.dburl ? { dburl: d.dburl } : {}),
  };
  // empty strings fall back to the engine's own defaults
  for (const k of ['mtn', 'mtnn', 'airtel', 'airteln', 'bank', 'paylink', 'slots', 'closed']) if (settings[k] === '') delete settings[k];

  const rev = d.refresh !== false ? hashContent(contentOf(d)) : undefined;
  const C = {
    key, mode: d.mode === 'quote' ? 'quote' : 'book', fx: d.fx, mono: d.mono || '', lr: num(d.lr), rev,
    logoLight: img(d.logoLight), logoDark: img(d.logoDark), logoSub: d.logoSub,
    aboutImg: img(d.aboutImg), svTitle: h(d.svTitle), catTitle: h(d.catTitle), galTitle: h(d.galTitle),
    bookTitle: h(d.bookTitle), bookText: h(d.bookText), deposits: depositsEscaped(d.deposits),
    galCats: (d.gallery as any[]).map((g) => g.k || ''),
    stats: (d.stats as any[]).map((x) => [h(x.v), h(x.l)]), services: (d.services as any[]).map((x) => [h(x.t), h(x.d)]),
    testi: (d.testi as any[]).map((x) => [h(x.n), h(x.q)]), faq: (d.faq as any[]).map((x) => [h(x.q), h(x.a)]),
    tr: (d.tr as any[]).filter((r) => r.k && (r.sw || r.lg)).map((r) => [r.k, r.sw, r.lg]), // translations are applied as plain text by the engine (textContent), so they stay raw
    settings,
    products: (d.products as any[]).map((p, i) => ({ id: i + 1, n: p.n, c: p.c, p: num(p.p), st: num(p.st), d: p.d, u: img(p.u) })),
    gallery: (d.gallery as any[]).map((g) => ({ u: img(g.u), c: g.c, ...(g.k ? { k: g.k } : {}) })),
    slides: (d.slides as any[]).map((s) => ({ u: img(s.u), t: s.t, s: s.s })),
  };
  if (rev === undefined) delete (C as any).rev;

  const family = hf.id === bf.id ? `family=${hf.spec}` : `family=${hf.spec}&family=${bf.spec}`;
  const css =
    `\n:root{--sp:cubic-bezier(.32,.72,0,1);--hf:'${hf.family}';--bf:'${bf.family}';--r:${num(d.radius)}px;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);${paletteCss(d, 'L')}}\n` +
    `@media(prefers-color-scheme:dark){:root:not([data-theme=light]){${paletteCss(d, 'D')}}}\n:root[data-theme=dark]{${paletteCss(d, 'D')}}\n` +
    ENGINE_CSS_A + (SKINS[d.skin]?.css ?? '') + '\n' + ENGINE_CSS_B + (d.customCss ? `\n${d.customCss}\n` : '');
  const js = ENGINE_JS.replace('/*@@C@@*/', () => `const C=${json(C)};`).replace('/*@@TRD@@*/', () => json(GENERIC_TRD));
  const title = esc(d.title || d.name || 'Website');
  const desc = esc([d.tag, String(d.about || '').slice(0, 120)].filter(Boolean).join(' – '));

  return (
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${title}</title>\n` +
    (desc ? `<meta name="description" content="${desc}">\n` : '') +
    (opts.cspMeta ? `<meta http-equiv="Content-Security-Policy" content="${esc(siteCsp({ dburl: demo ? '' : d.dburl }))}">\n<meta name="referrer" content="strict-origin-when-cross-origin">\n` : '') +
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?${family}&display=swap" rel="stylesheet">\n<style>${css}</style></head><body><div id="app"></div>\n<script>\n${js}</script></body></html>\n`
  );
}

export const _fonts = FONTS; // (kept so the font list stays in the bundle with the generator)
