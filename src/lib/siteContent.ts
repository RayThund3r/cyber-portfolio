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
export interface StatItem { label: string; value: string }
export interface SiteContent {
  reviews: Review[];
  prices: PriceItem[];
  faqs: FaqItem[];
  guides: Guide[];
  promise: { enabled: boolean; title: string; intro: string; points: string[] };
  stats: StatItem[];
  local: { mapsUrl: string; reviewUrl: string; areas: string; directions: string; showMap: boolean };
}

export const DEFAULT_CONTENT: SiteContent = {
  reviews: [], prices: [], faqs: [], guides: [],
  promise: { enabled: false, title: 'Our repair promise', intro: '', points: [] },
  stats: [],
  local: { mapsUrl: '', reviewUrl: '', areas: '', directions: '', showMap: true },
};

export const LIMITS = { reviews: 30, prices: 40, faqs: 30, guides: 40, points: 6, stats: 4 } as const;

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
  const maps = safeLink(String(s.local?.mapsUrl ?? '').trim(), 400);
  const review = safeLink(String(s.local?.reviewUrl ?? '').trim(), 400);
  return {
    reviews, prices, faqs, guides,
    promise: { enabled: s.promise?.enabled === true, title: t(s.promise?.title, 60) || 'Our repair promise', intro: t(s.promise?.intro, 300), points: arr(s.promise?.points, 30).map((x) => t(x, 140)).filter(Boolean).slice(0, LIMITS.points) },
    stats: arr(s.stats, 20).map((x) => ({ label: t(x?.label, 40), value: t(x?.value, 20) })).filter((x) => x.label && x.value).slice(0, LIMITS.stats),
    local: { mapsUrl: /^https:\/\//.test(maps) ? maps : '', reviewUrl: /^https:\/\//.test(review) ? review : '', areas: t(s.local?.areas, 200), directions: t(s.local?.directions, 300), showMap: s.local?.showMap !== false },
  };
}

export const hasContent = (c: SiteContent) => c.reviews.some((r) => r.shown) || c.prices.some((p) => p.shown) || c.faqs.some((f) => f.shown) || c.guides.some((g) => g.published) || c.promise.enabled || c.stats.length > 0;
