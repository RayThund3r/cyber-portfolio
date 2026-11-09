// src/lib/studio/import.ts
//
// Reads a site made with this engine (a single index.html) back into Studio settings, so existing
// sites can be opened, edited and re-exported. SECURITY: the HTML is only ever PARSED (JSON + regex);
// nothing in it is executed, so an uploaded file cannot run code on the server.
import { FONTS } from './look';
import { GENERIC_TRD } from './engineData';
import { presetData, sanitizeStudio, type StudioData } from './schema';

/** End index of the {...} / [...] block that opens at s[start] (aware of quotes). */
function block(s: string, start: number): number {
  const open = s[start], close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'") { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } }
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return i + 1;
  }
  throw new Error('unbalanced');
}

/** Unquote a JS single/double quoted string literal. */
const unq = (lit: string) => lit.slice(1, -1).replace(/\\(n|t|'|"|\\)/g, (_, c) => ({ n: '\n', t: '\t' } as Record<string, string>)[c] ?? c);
const JS_STR = String.raw`('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")`;

export interface ImportResult { data: StudioData; warnings: string[]; name: string }

export function parseEngineSite(html: string): ImportResult {
  const warnings: string[] = [];
  const ci = html.indexOf('const C={');
  if (ci < 0) throw new Error('This file was not made with the site engine (no site settings found).');
  let C: any;
  try { C = JSON.parse(html.slice(ci + 8, block(html, ci + 8))); } catch { throw new Error('The site settings in this file could not be read.'); }
  const s = C.settings || {};
  const d: StudioData = presetData('fresh');

  // ── look: palette, fonts, radius, skin
  const root = html.match(/:root\{([^}]*)\}\s*@media\(prefers-color-scheme:dark\)\{:root:not\(\[data-theme=light\]\)\{([^}]*)\}\}/);
  const kv = (b: string) => Object.fromEntries([...b.matchAll(/(--[a-z0-9]+):([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  if (root) {
    const L = kv(root[1]), D = kv(root[2]);
    Object.assign(d, { bgL: L['--bg'], cardL: L['--card'], txL: L['--tx'], acL: L['--ac'], ac2L: L['--ac2'], bgD: D['--bg'], cardD: D['--card'], txD: D['--tx'], acD: D['--ac'], ac2D: D['--ac2'] });
    const fam = (v?: string) => (v || '').replace(/['"]/g, '').trim();
    const hf = FONTS.find((f) => f.kind === 'heading' && f.family === fam(L['--hf'])), bf = FONTS.find((f) => f.kind === 'body' && f.family === fam(L['--bf']));
    if (hf) d.hf = hf.id; else warnings.push(`Heading font "${fam(L['--hf'])}" is not in the list; a similar one was chosen.`);
    if (bf) d.bf = bf.id; else warnings.push(`Text font "${fam(L['--bf'])}" is not in the list; a similar one was chosen.`);
    const r = parseInt(L['--r'] || '14', 10);
    d.radius = String([0, 2, 6, 10, 14, 20, 26].reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a)));
  } else warnings.push('Colours were not found; defaults were used.');
  // the site's own style layer becomes "Extra CSS" so the look is preserved exactly
  const mk = '@media(prefers-reduced-motion:reduce){*{animation:none!important;transition-duration:.01s!important}}';
  const a = html.indexOf(mk), b = html.indexOf('\n.cartb{');
  d.skin = 'clean';
  d.customCss = a > 0 && b > a ? html.slice(a + mk.length, b).trim().replace(/\/\*[\s\S]*?\*\//g, '').trim() : '';
  if (d.customCss.length > 4000) { warnings.push('The site had a very long custom style layer; it was shortened.'); d.customCss = d.customCss.slice(0, 4000); }

  // ── brand + contact
  const set = (k: string, v: unknown) => { if (v !== undefined && v !== null) d[k] = String(v); };
  for (const k of ['name', 'tag', 'announce', 'about', 'phone', 'wa', 'email', 'addr', 'hours', 'ig', 'fb', 'tt', 'yt', 'thanks', 'wamsg', 'mtn', 'mtnn', 'airtel', 'airteln', 'bank', 'paylink', 'promos', 'dburl', 'pass', 'slots', 'closed']) set(k, s[k]);
  set('fee', s.fee); set('slSpeed', s.slSpeed); set('mono', C.mono); set('lr', [0, 8, 12, 16, 20].reduce((x, y) => (Math.abs(y - (C.lr || 0)) < Math.abs(x - (C.lr || 0)) ? y : x))); set('fx', C.fx);
  d.defTheme = s.defTheme === 'light' || s.defTheme === 'dark' ? s.defTheme : 'auto';
  const off = s.off || {};
  ([['shop', 'fShop'], ['wa', 'fWa'], ['rev', 'fRev'], ['fav', 'fFav'], ['lang', 'fLang'], ['news', 'fNews'], ['top', 'fTop'], ['track', 'fTrack']] as const).forEach(([k, f]) => { d[f] = !off[k]; });
  d.key = String(C.key || 'site');

  // ── images: web pictures are kept; files that lived next to the site cannot be imported
  const local: string[] = [];
  const img = (v: unknown) => { const u = String(v || ''); if (!u) return ''; if (/^https:\/\//i.test(u)) return u; local.push(u); return ''; };
  const sub = html.match(/class="logo-sub">([^<$]{1,60})</);
  d.logoSub = C.logoSub ?? (sub ? sub[1].replace(/&amp;/g, '&') : '');
  d.logoLight = img(C.logoLight || s.logo); d.logoDark = img(C.logoDark); d.favicon = img(s.favicon); d.aboutImg = img(C.aboutImg);
  if (!d.logoLight && /id="main-logo"/.test(html) && /logo1?\.png/.test(html)) local.push('logo');
  d.slides = (C.slides || []).map((x: any) => ({ u: img(x.u), t: x.t, s: x.s }));
  d.products = (C.products || []).map((p: any) => ({ n: p.n, c: p.c, p: String(p.p ?? 0), st: String(p.st ?? 0), d: p.d, u: img(p.u) }));
  d.gallery = (C.gallery || []).map((g: any) => ({ u: img(g.u), c: g.c, k: g.k || '' }));
  if (local.length) warnings.push(`${local.length} picture(s) were files stored next to the site (for example a logo) and could not be imported. Upload them again in the editor.`);

  // ── lists
  d.stats = (C.stats || []).map(([v, l]: string[]) => ({ v, l }));
  d.services = (C.services || []).map(([t, x]: string[]) => ({ t, d: x }));
  d.testi = (C.testi || []).map(([n, q]: string[]) => ({ n, q }));
  d.faq = (C.faq || []).map(([q, a]: string[]) => ({ q, a }));
  d.svTitle = C.svTitle ?? d.svTitle; d.catTitle = C.catTitle ?? d.catTitle; d.galTitle = C.galTitle ?? d.galTitle;

  // ── per-site hooks: newer sites carry them in C; older ones kept them in small lookup tables in the script
  const key = String(C.key || '');
  d.mode = C.mode ? (C.mode === 'quote' ? 'quote' : 'book') : html.includes(`C.key==='${key}'?'quote'`) || /const MODE=C\.key==='olam'\?'quote'/.test(html) && key === 'olam' ? 'quote' : 'book';
  const bk = html.match(new RegExp(String.raw`const BK=\{[\s\S]*?\b${key}:\[${JS_STR},\s*${JS_STR}\]`));
  d.bookTitle = C.bookTitle ?? (bk ? unq(bk[1]) : d.bookTitle); d.bookText = C.bookText ?? (bk ? unq(bk[2]) : d.bookText);
  const dp = html.match(new RegExp(String.raw`const DEPD=\{[\s\S]*?\b${key}:${JS_STR}`));
  d.deposits = C.deposits ?? (dp ? unq(dp[1]) : '');
  const cat = html.match(new RegExp(String.raw`const CAT=\{[\s\S]*?\b${key}:\[([^\]]*)\]`));
  if (cat && Array.isArray(d.gallery)) {
    const cats = [...cat[1].matchAll(new RegExp(JS_STR, 'g'))].map((m) => unq(m[1]));
    d.gallery.forEach((g: any, i: number) => { if (!g.k && cats[i]) g.k = cats[i]; });
  }

  // ── own translations = everything beyond the engine's built-in set
  const ti = html.indexOf('const TRD={');
  const rows = new Map<string, { k: string; sw: string; lg: string }>();
  if (ti >= 0) {
    try {
      const trd = JSON.parse(html.slice(ti + 10, block(html, ti + 10)));
      for (const lang of ['sw', 'lg'] as const) for (const [k, v] of Object.entries<string>(trd[lang] || {})) if ((GENERIC_TRD as any)[lang][k] !== v) { const r = rows.get(k) ?? { k, sw: '', lg: '' }; r[lang] = v; rows.set(k, r); }
    } catch { warnings.push('The translations could not be read.'); }
  }
  for (const r of C.tr || []) rows.set(r[0], { k: r[0], sw: r[1] || '', lg: r[2] || '' });
  d.tr = [...rows.values()].slice(0, 120);

  d.title = (html.match(/<title>([^<]*)<\/title>/)?.[1] || '').replace(/&amp;/g, '&');
  if (d.title === d.name) d.title = '';
  d.refresh = true; d.demoAdmin = false;
  return { data: sanitizeStudio(d), warnings, name: String(s.name || 'Imported site').slice(0, 60) };
}
