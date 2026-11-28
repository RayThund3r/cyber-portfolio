// src/lib/siteContent.ts
//
// The trust-building content of the public site, editable from Admin → Content without touching code:
// customer reviews, a price list, extra FAQ answers, the repair promise (warranty), headline numbers, local-search details and guides.
// Isomorphic (types, defaults and the validator); the server stores it, pages and the layout read it.
import { safeLink } from './safeText';

export interface Review { id: string; name: string; detail: string; text: string; rating: number; source: string; shown: boolean }
export interface PriceItem { id: string; group: string; name: string; from: number; to: number; note: string; shown: boolean }
export interface FaqItem { id: string; q: string; a: string; shown: boolean }
export interface Guide { id: string; title: string; summary: string; body: string; date: string; published: boolean }
/** A fixed-scope offer (a logo pack, a full service, a remote clean-up) with a clear price, turnaround and what is included. */
export interface Package { id: string; kind: 'design' | 'repair' | 'remote'; name: string; blurb: string; from: number; turnaround: string; includes: string[]; popular: boolean; shown: boolean }
export interface StatItem { label: string; value: string }
export interface SiteContent {
  reviews: Review[];
  prices: PriceItem[];
  faqs: FaqItem[];
  guides: Guide[];
  packages: Package[];
  /** The Remote support page (/remote). */
  remote: { enabled: boolean; intro: string };
  promise: { enabled: boolean; title: string; intro: string; points: string[] };
  stats: StatItem[];
  local: { mapsUrl: string; reviewUrl: string; areas: string; directions: string; showMap: boolean };
}

export const DEFAULT_CONTENT: SiteContent = {
  reviews: [], prices: [], faqs: [], guides: [], packages: [],
  remote: { enabled: true, intro: '' },
  promise: { enabled: false, title: 'Our repair promise', intro: '', points: [] },
  stats: [],
  local: { mapsUrl: '', reviewUrl: '', areas: '', directions: '', showMap: true },
};

export const LIMITS = { reviews: 30, prices: 40, faqs: 30, guides: 40, packages: 12, includes: 8, points: 6, stats: 4 } as const;

const t = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** Multi-line text: keeps line breaks, drops control characters. */
const long = (v: unknown, max: number) => String(v ?? '').replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
const money = (v: unknown) => { const n = Math.floor(Number(String(v ?? '').replace(/[^\d.]/g, ''))); return Number.isFinite(n) && n > 0 ? Math.min(n, 1_000_000_000) : 0; };
const id = (v: unknown, fallback: string) => { const x = String(v ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40); return x || fallback; };
export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const arr = (v: unknown, max: number): any[] => (Array.isArray(v) ? v.slice(0, max) : []);
const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : '');

/** Rebuilds the content from anything (a form, a stored file): unknown keys dropped, text length-limited, links must be https://. */
export function normalizeContent(input: unknown): SiteContent {
  const s = (input && typeof input === 'object' ? input : {}) as any;
  const seen = new Set<string>();
  const uniq = (raw: string, i: number) => { let k = raw || `i${i + 1}`; while (seen.has(k)) k += 'x'; seen.add(k); return k; };
  const reviews: Review[] = arr(s.reviews, LIMITS.reviews).map((r, i) => ({
    id: uniq(id(r?.id, ''), i), name: t(r?.name, 50), detail: t(r?.detail, 80), text: t(r?.text, 500),
    rating: Math.min(5, Math.max(1, Math.round(Number(r?.rating) || 5))), source: ['google', 'whatsapp', 'facebook', 'instagram', 'other', ''].includes(String(r?.source)) ? String(r.source) : '', shown: r?.shown !== false,
  })).filter((r) => r.name && r.text);
  seen.clear();
  const prices: PriceItem[] = arr(s.prices, LIMITS.prices).map((p, i) => {
    const from = money(p?.from), to = money(p?.to);
    return { id: uniq(id(p?.id, ''), i), group: t(p?.group, 30) || 'Services', name: t(p?.name, 80), from, to: to > from ? to : 0, note: t(p?.note, 120), shown: p?.shown !== false };
  }).filter((p) => p.name);
  seen.clear();
  const faqs: FaqItem[] = arr(s.faqs, LIMITS.faqs).map((f, i) => ({ id: uniq(id(f?.id, ''), i), q: t(f?.q, 160), a: long(f?.a, 1200), shown: f?.shown !== false })).filter((f) => f.q && f.a);
  seen.clear();
  const guides: Guide[] = arr(s.guides, LIMITS.guides).map((g, i) => {
    const title = t(g?.title, 90);
    return { id: uniq(slugify(String(g?.id || title)) || '', i), title, summary: t(g?.summary, 200), body: long(g?.body, 12000), date: day(g?.date), published: g?.published === true };
  }).filter((g) => g.title && g.body);
  seen.clear();
  const packages: Package[] = arr(s.packages, LIMITS.packages).map((k, i) => ({
    id: uniq(id(k?.id, ''), i), kind: (['design', 'repair', 'remote'].includes(String(k?.kind)) ? String(k.kind) : 'design') as Package['kind'],
    name: t(k?.name, 50), blurb: t(k?.blurb, 140), from: money(k?.from), turnaround: t(k?.turnaround, 40),
    includes: arr(k?.includes, 30).map((x) => t(x, 80)).filter(Boolean).slice(0, LIMITS.includes), popular: k?.popular === true, shown: k?.shown !== false,
  })).filter((k) => k.name);
  const maps = safeLink(String(s.local?.mapsUrl ?? '').trim(), 400);
  const review = safeLink(String(s.local?.reviewUrl ?? '').trim(), 400);
  return {
    reviews, prices, faqs, guides, packages,
    remote: { enabled: s.remote?.enabled !== false, intro: t(s.remote?.intro, 300) },
    promise: { enabled: s.promise?.enabled === true, title: t(s.promise?.title, 60) || 'Our repair promise', intro: t(s.promise?.intro, 300), points: arr(s.promise?.points, 30).map((x) => t(x, 140)).filter(Boolean).slice(0, LIMITS.points) },
    stats: arr(s.stats, 20).map((x) => ({ label: t(x?.label, 40), value: t(x?.value, 20) })).filter((x) => x.label && x.value).slice(0, LIMITS.stats),
    local: { mapsUrl: /^https:\/\//.test(maps) ? maps : '', reviewUrl: /^https:\/\//.test(review) ? review : '', areas: t(s.local?.areas, 200), directions: t(s.local?.directions, 300), showMap: s.local?.showMap !== false },
  };
}

export const hasContent = (c: SiteContent) => c.reviews.some((r) => r.shown) || c.prices.some((p) => p.shown) || c.faqs.some((f) => f.shown) || c.guides.some((g) => g.published) || c.packages.some((k) => k.shown) || c.promise.enabled || c.stats.length > 0;

/** The owner's real prices, FAQ, promise and service areas as short plain text, so the chat assistant quotes THEM instead of guessing. */
export function contentFacts(c: SiteContent): string {
  const ugx = (n: number) => `UGX ${n.toLocaleString('en-US')}`;
  const out: string[] = [];
  const prices = c.prices.filter((p) => p.shown && p.name).slice(0, 25);
  if (prices.length) out.push('PRICES (real, set by the owner; say "from" for a starting price and that the final price is confirmed after a look):\n' + prices.map((p) => `- ${p.name}${p.group ? ` (${p.group})` : ''}: ${p.from ? (p.to ? `${ugx(p.from)} to ${ugx(p.to)}` : `from ${ugx(p.from)}`) : 'price on request'}${p.note ? `. ${p.note}` : ''}`).join('\n'));
  const pk = c.packages.filter((k) => k.shown && k.name).slice(0, 12);
  if (pk.length) out.push('PACKAGES (fixed offers; the final price is confirmed with the customer):\n' + pk.map((k) => `- ${k.name} (${k.kind})${k.from ? ` from ${ugx(k.from)}` : ''}${k.turnaround ? `, ${k.turnaround}` : ''}${k.includes.length ? `: ${k.includes.join(', ')}` : ''}`).join('\n'));
  const faqs = c.faqs.filter((f) => f.shown && f.q && f.a).slice(0, 10);
  if (faqs.length) out.push('OWNER FAQ:\n' + faqs.map((f) => `- Q: ${f.q} A: ${f.a.replace(/\s+/g, ' ').slice(0, 280)}`).join('\n'));
  if (c.promise.enabled && c.promise.points.length) out.push(`${c.promise.title}: ${c.promise.points.join('; ')}`);
  if (c.local.areas) out.push(`Areas served: ${c.local.areas}`);
  return out.join('\n').slice(0, 3500);
}
