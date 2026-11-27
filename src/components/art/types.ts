// src/components/art/types.ts — shared bits of the public Art gallery.
export interface Art {
  id: string; title: string; category: string; description: string; tools: string[]; year: string; featured: boolean;
  w: number; h: number; v: number;
  /** A vivid colour taken from the picture, and its average tone (both '#rrggbb'); used for glows and placeholders. */
  color?: string; tone?: string;
}
export const FALLBACK_COLOR = '#22d3ee';
export const FALLBACK_TONE = '#18181b';
export const colorOf = (a: Art) => a.color || FALLBACK_COLOR;
export const toneOf = (a: Art) => a.tone || FALLBACK_TONE;
export const imgSrc = (a: Art, thumb = false) => `/api/art/${a.id}?${thumb ? 't=1&' : ''}v=${a.v}`;
export const ratioOf = (a: Art) => (a.w > 0 && a.h > 0 ? `${a.w} / ${a.h}` : '4 / 5');
export const commissionHref = (a?: Art) => `/contact?type=design${a ? `&ref=${encodeURIComponent(a.title.slice(0, 80))}` : ''}`;
