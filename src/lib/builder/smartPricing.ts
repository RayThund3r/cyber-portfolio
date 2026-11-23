// src/lib/builder/smartPricing.ts  (OPTIONAL: only used when Admin → SETTINGS → "Smart pricing" is switched on; live-currency pricing stays in pricing.ts)
//
// Smart pricing for websites built in the builder. The price is calculated from what is actually IN the site, using a rate card the
// owner controls in Admin → PRICING: a base price, a fee per kind of section (gallery, pricing table, team…), extra sections, extra
// list items, pictures, custom colours, animations and a logo. A template's own price (if set) acts as a floor ("starting from").
// Pure and isomorphic: the editor shows a live estimate while the visitor builds, and the server recomputes the real price at checkout
// (the browser's number is never trusted).
import { PALETTES, type SiteConfig } from './schema';

export interface RateCard {
  base: number; includedSections: number; perExtraSection: number; typeFees: Record<string, number>;
  includedItems: number; perExtraItem: number; includedImages: number; perImage: number;
  customColors: number; animations: number; darkMode: number; logo: number; min: number; roundTo: number;
}

export const DEFAULT_RATE_CARD: RateCard = {
  base: 150_000, includedSections: 4, perExtraSection: 12_000,
  typeFees: { gallery: 25_000, pricing: 20_000, team: 15_000, testimonials: 15_000, faq: 10_000, contact: 20_000, stats: 8_000, cta: 5_000, text: 3_000 },
  includedItems: 6, perExtraItem: 1_500, includedImages: 4, perImage: 3_000,
  customColors: 15_000, animations: 8_000, darkMode: 10_000, logo: 5_000, min: 120_000, roundTo: 5_000,
};

export const RATE_LABELS: Record<string, string> = {
  base: 'Base price (every website)', includedSections: 'Sections included in the base price', perExtraSection: 'Each extra section',
  includedItems: 'Cards / photos / items included per section', perExtraItem: 'Each extra card, photo or item', includedImages: 'Pictures included',
  perImage: 'Each extra picture', customColors: 'Custom brand colours', animations: 'Scroll animations', darkMode: 'Dark mode', logo: 'Logo set-up',
  min: 'Lowest possible price', roundTo: 'Round the total to the nearest',
};
export const TYPE_LABELS: Record<string, string> = {
  gallery: 'Photo gallery', pricing: 'Pricing plans', team: 'Team', testimonials: 'Testimonials', faq: 'FAQ', contact: 'Contact section', stats: 'Numbers / stats', cta: 'Call-to-action banner', text: 'Free text block',
};

export interface QuoteLine { key: string; label: string; amount: number; detail?: string }
export interface Quote { total: number; subtotal: number; tier: 'Starter' | 'Standard' | 'Professional' | 'Premium'; lines: QuoteLine[]; floorApplied: boolean }

/** Clean up a rate card from storage or from a form: only known keys, sane numbers, defaults for anything missing. */
export function normalizeRateCard(input: unknown): RateCard {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const num = (v: unknown, d: number, max = 50_000_000) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : d; };
  const d = DEFAULT_RATE_CARD;
  const typeFees: Record<string, number> = {};
  for (const k of Object.keys(d.typeFees)) typeFees[k] = num(src.typeFees?.[k], d.typeFees[k]);
  return {
    base: num(src.base, d.base), includedSections: num(src.includedSections, d.includedSections, 50), perExtraSection: num(src.perExtraSection, d.perExtraSection), typeFees,
    includedItems: num(src.includedItems, d.includedItems, 100), perExtraItem: num(src.perExtraItem, d.perExtraItem), includedImages: num(src.includedImages, d.includedImages, 200),
    perImage: num(src.perImage, d.perImage), customColors: num(src.customColors, d.customColors), animations: num(src.animations, d.animations), darkMode: num(src.darkMode, d.darkMode),
    logo: num(src.logo, d.logo), min: num(src.min, d.min), roundTo: Math.max(1, num(src.roundTo, d.roundTo, 1_000_000)),
  };
}

const isVisible = (s: any) => s && s.hidden !== true && s.visible !== false && s.enabled !== false;

/** What a site contains, in numbers (also shown to the visitor as the "what you are paying for" list). */
export function measure(cfg: SiteConfig) {
  const body = (cfg.sections || []).filter((s: any) => isVisible(s) && s.type !== 'navbar' && s.type !== 'footer');
  const types: Record<string, number> = {};
  let items = 0;
  for (const s of body as any[]) {
    types[s.type] = (types[s.type] || 0) + 1;
    for (const k of Object.keys(s.data || {})) if (Array.isArray(s.data[k])) items += s.data[k].length;
  }
  const assets = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') { const m = v.match(/^asset:([a-z0-9]{8})$/); if (m) assets.add(m[1]); else if (/^https:\/\/.+\.(jpe?g|png|webp|gif)(\?|$)/i.test(v)) assets.add(v); }
    else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(cfg);
  const t: any = (cfg as any).theme || {};
  const b: any = (cfg as any).brand || {};
  const matchesPreset = PALETTES.some((pl: any) => String(pl.primary).toLowerCase() === String(t.primary).toLowerCase() && String(pl.bg ?? '').toLowerCase() === String(t.bg ?? '').toLowerCase());
  return { sections: body.length, types, items, images: assets.size, animations: !!t.animations, darkMode: t.mode === 'dark' || t.mode === 'auto', customColors: !!t.primary && !matchesPreset, logo: !!(b.logo && String(b.logo).length > 0) };
}

export function quote(cfg: SiteConfig, rc: RateCard, floorUGX: number | null = null): Quote {
  const m = measure(cfg);
  const lines: QuoteLine[] = [{ key: 'base', label: 'Website base price', amount: rc.base, detail: `includes ${rc.includedSections} sections` }];
  const extraSections = Math.max(0, m.sections - rc.includedSections);
  if (extraSections) lines.push({ key: 'sections', label: `${extraSections} extra section${extraSections > 1 ? 's' : ''}`, amount: extraSections * rc.perExtraSection, detail: `${m.sections} sections in total` });
  for (const [type, fee] of Object.entries(rc.typeFees)) {
    if (m.types[type] && fee > 0) lines.push({ key: `type:${type}`, label: TYPE_LABELS[type] || type, amount: fee * (type === 'text' ? m.types[type] : 1), detail: m.types[type] > 1 && type !== 'text' ? 'one fee, however many' : undefined });
  }
  const extraItems = Math.max(0, m.items - rc.includedItems * Math.max(1, m.sections - 1));
  if (extraItems) lines.push({ key: 'items', label: `${extraItems} extra card${extraItems > 1 ? 's' : ''} / photo${extraItems > 1 ? 's' : ''} / item${extraItems > 1 ? 's' : ''}`, amount: extraItems * rc.perExtraItem });
  const extraImages = Math.max(0, m.images - rc.includedImages);
  if (extraImages) lines.push({ key: 'images', label: `${extraImages} extra picture${extraImages > 1 ? 's' : ''}`, amount: extraImages * rc.perImage, detail: `${m.images} pictures used` });
  if (m.customColors && rc.customColors) lines.push({ key: 'colors', label: 'Custom brand colours', amount: rc.customColors });
  if (m.animations && rc.animations) lines.push({ key: 'anim', label: 'Scroll animations', amount: rc.animations });
  if (m.darkMode && rc.darkMode) lines.push({ key: 'dark', label: 'Dark mode', amount: rc.darkMode });
  if (m.logo && rc.logo) lines.push({ key: 'logo', label: 'Logo set-up', amount: rc.logo });
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const roundTo = Math.max(1, rc.roundTo);
  let total = Math.max(rc.min, Math.round(subtotal / roundTo) * roundTo);
  let floorApplied = false;
  if (floorUGX && floorUGX > total) { total = floorUGX; floorApplied = true; lines.push({ key: 'floor', label: 'Template starting price', amount: floorUGX - subtotal, detail: 'this template starts at this price' }); }
  const tier = total < 200_000 ? 'Starter' : total < 350_000 ? 'Standard' : total < 600_000 ? 'Professional' : 'Premium';
  return { total, subtotal, tier, lines, floorApplied };
}
