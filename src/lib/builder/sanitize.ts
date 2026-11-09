// src/lib/builder/sanitize.ts — rebuilds a SiteConfig strictly from the schema (isomorphic).
// Users never write code; still, EVERYTHING is validated: unknown keys are dropped, URLs are scheme-checked,
// colours/enums are whitelisted, lengths and counts are bounded.
import { PRO_GROUPS, newProKey } from './pro';
import { CODE_FIELDS, SECTION_DEFS, SITE_FIELDS, defaultsFor, newSection, type Field, type SiteConfig, type SectionInstance, type SectionType } from './schema';

export interface SanitizeCtx {
  /** Asset ids that exist for this project. Omit to accept any well-formed `asset:` token (client side). */
  assetIds?: Set<string>;
}

export const ASSET_RE = /^asset:([a-z0-9]{8})$/;
const MAX_SECTIONS = 40;

export const clean = (v: unknown, max: number, multiline = false): string => {
  if (typeof v !== 'string') return '';
  let s = v.replace(/\u0000/g, '').replace(multiline ? /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g : /[\u0001-\u001F]/g, ' ');
  if (!multiline) s = s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
};

export function safeUrl(v: unknown): string {
  const s = clean(v, 500);
  if (!s) return '';
  if (/^(#|\/(?!\/))[^\s]*$/.test(s)) return s;                       // #section or /path
  if (/^(https?:\/\/)[^\s"'<>]+$/i.test(s)) return s;                  // web
  if (/^mailto:[^\s"'<>]+$/i.test(s) || /^tel:[+\d\-().\s]+$/i.test(s)) return s;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/[^\s"'<>]*)?$/i.test(s)) return 'https://' + s; // facebook.com/x → https://…
  return '';
}

function safeImage(v: unknown, ctx: SanitizeCtx): string {
  const s = clean(v, 600);
  if (!s) return '';
  const m = s.match(ASSET_RE);
  if (m) return !ctx.assetIds || ctx.assetIds.has(m[1]) ? s : '';
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : '';                    // https images only
}

function coerce(f: Field, v: any, ctx: SanitizeCtx): any {
  switch (f.type) {
    case 'text': return clean(v, f.max ?? 200);
    case 'textarea': return clean(v, f.max ?? 3000, true);
    case 'code': return clean(v, f.max ?? 20000, true); // raw code: only control characters are removed
    case 'number': { const n = Number(v); const lo = f.min ?? 0, hi = f.max ?? 1e9; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : Number(f.def ?? 0); }
    case 'passcode': return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) ? v : ''; // only a SHA-256 hash is ever stored
    case 'emoji': return clean(v, 8).replace(/[<>"'&]/g, '');
    case 'url': return safeUrl(v);
    case 'image': return safeImage(v, ctx);
    case 'color': return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : String(f.def || '#000000');
    case 'select': return f.options!.some((o) => o.value === v) ? v : f.def;
    case 'toggle': return typeof v === 'boolean' ? v : !!f.def;
    case 'list':
      return Array.isArray(v) ? v.slice(0, f.max ?? 12).map((it) => coerceObj(f.fields!, it, ctx)) : JSON.parse(JSON.stringify(f.def ?? []));
  }
}

export function coerceObj(fields: Field[], src: any, ctx: SanitizeCtx): Record<string, any> {
  const out: Record<string, any> = {};
  const o = src && typeof src === 'object' ? src : {};
  for (const f of fields) out[f.key] = f.key in o ? coerce(f, o[f.key], ctx) : f.type === 'list' ? JSON.parse(JSON.stringify(f.def ?? [])) : f.def ?? (f.type === 'toggle' ? false : '');
  return out;
}

export function sanitizePro(input: any, ctx: SanitizeCtx = {}): NonNullable<SiteConfig['pro']> {
  const src = input && typeof input === 'object' ? input : {};
  const out: Record<string, any> = { key: typeof src.key === 'string' && /^[a-z0-9]{6,16}$/.test(src.key) ? src.key : newProKey() };
  for (const g of PRO_GROUPS) out[g.id] = coerceObj(g.fields, src[g.id], ctx);
  return out as NonNullable<SiteConfig['pro']>;
}

export function sanitizeConfig(input: any, ctx: SanitizeCtx = {}): SiteConfig {
  if (JSON.stringify(input ?? {}).length > 700_000) throw new Error('Site is too large.');
  const src = input && typeof input === 'object' ? input : {};
  const [brandG, themeG, metaG] = SITE_FIELDS;

  const sections: SectionInstance[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(src.sections) ? src.sections.slice(0, MAX_SECTIONS) : []) {
    const type = raw?.type as SectionType;
    const def = SECTION_DEFS[type];
    if (!def) continue;
    if (def.fixed && sections.some((s) => s.type === type)) continue; // one navbar, one footer
    let id = typeof raw.id === 'string' && /^[a-z0-9]{3,12}$/.test(raw.id) ? raw.id : '';
    if (!id || seen.has(id)) id = newSection(type).id;
    seen.add(id);
    sections.push({ id, type, visible: raw.visible !== false, data: coerceObj(def.fields, raw.data, ctx) });
  }
  // navbar always first, footer always last
  const nav = sections.find((s) => s.type === 'navbar') ?? newSection('navbar');
  const foot = sections.find((s) => s.type === 'footer') ?? newSection('footer');
  const body = sections.filter((s) => s.type !== 'navbar' && s.type !== 'footer').slice(0, MAX_SECTIONS - 2); // total incl. navbar+footer ≤ MAX_SECTIONS

  return {
    v: 1,
    meta: coerceObj(metaG.fields, src.meta, ctx) as SiteConfig['meta'],
    brand: coerceObj(brandG.fields, src.brand, ctx) as SiteConfig['brand'],
    theme: coerceObj(themeG.fields, src.theme, ctx) as SiteConfig['theme'],
    sections: [nav, ...body, foot],
    code: coerceObj(CODE_FIELDS, src.code, ctx) as SiteConfig['code'],
    ...(src.kind === 'pro' ? { kind: 'pro' as const, pro: sanitizePro(src.pro, ctx) } : {}),
  };
}

/** Asset tokens referenced anywhere in a config. */
export function referencedAssets(cfg: SiteConfig): Set<string> {
  const ids = new Set<string>();
  const walk = (v: any) => {
    if (typeof v === 'string') { const m = v.match(ASSET_RE); if (m) ids.add(m[1]); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(cfg);
  return ids;
}

export { defaultsFor };
