// src/server/art.ts — the Art gallery: artwork details in one small list, each picture (and its thumbnail) under its own key,
// so the list stays tiny and a picture is only read when somebody looks at it.
import { readJson, removeJson, writeJson, update } from './store';

export const ART_CATEGORIES = ['Logos', 'Branding', 'Posters', 'Social media', 'Illustration', 'Packaging', 'UI design', 'Other'] as const;
export interface ArtItem {
  id: string; title: string; category: string; description: string; tools: string[]; year: string; featured: boolean;
  w: number; h: number;
  /** A vivid colour from the picture and its average tone, '#rrggbb' (glows and placeholders). */
  color: string; tone: string;
  /** Bumped on every picture change, so browsers cache each picture forever and still see a new one at once. */
  v: number;
}
const LIST = 'art-list', imgKey = (id: string) => `art-img-${id}`, thumbKey = (id: string) => `art-thumb-${id}`;
export const MAX_ART = 150, MAX_IMG = 520_000, MAX_THUMB = 140_000;
const DATA_URL = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/;
const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d);
const txt = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, n);

export const cleanId = (v: unknown): string => String(v ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
const newId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function cleanItem(input: unknown, prev?: ArtItem): ArtItem {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const cat = txt(b.category, 30);
  const tools = (Array.isArray(b.tools) ? b.tools : String(b.tools ?? '').split(',')).map((t) => txt(t, 24)).filter(Boolean).slice(0, 10);
  return {
    id: prev?.id || cleanId(b.id) || newId(),
    title: txt(b.title, 80) || 'Untitled',
    category: (ART_CATEGORIES as readonly string[]).includes(cat) ? cat : 'Other',
    description: txt(b.description, 600),
    tools, year: txt(b.year, 4).replace(/\D/g, ''),
    featured: b.featured === true,
    w: prev?.w || 0, h: prev?.h || 0, v: prev?.v || 0,
    color: prev?.color || '#22d3ee', tone: prev?.tone || '#18181b',
  };
}

export const listArt = (): Promise<ArtItem[]> => readJson<ArtItem[]>(LIST, []).then((l) => (Array.isArray(l) ? l : []));

export function parseImage(dataUrl: unknown, max: number): { type: string; b64: string } | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > max) return null;
  const m = DATA_URL.exec(dataUrl);
  return m ? { type: m[1], b64: m[2] } : null;
}

export async function getArtImage(id: string, thumb: boolean): Promise<{ type: string; bytes: Buffer } | null> {
  const raw = await readJson<string>(thumb ? thumbKey(id) : imgKey(id), '');
  const p = parseImage(raw, MAX_IMG + 10);
  return p ? { type: p.type, bytes: Buffer.from(p.b64, 'base64') } : null;
}

/** Create or update one piece. `image`/`thumb` (data URLs) are only needed for a new picture. Returns the full list. */
export async function saveArt(input: { item: unknown; image?: unknown; thumb?: unknown; w?: unknown; h?: unknown; color?: unknown; tone?: unknown }): Promise<ArtItem[]> {
  const raw = (input.item && typeof input.item === 'object' ? input.item : {}) as Record<string, unknown>;
  const list = await listArt();
  const prev = list.find((a) => a.id === cleanId(raw.id));
  const item = cleanItem(raw, prev);
  const img = input.image ? parseImage(input.image, MAX_IMG) : null;
  const th = input.thumb ? parseImage(input.thumb, MAX_THUMB) : null;
  if (input.image && !img) throw Object.assign(new Error('That picture is not a valid or is too large (max about 380 KB after shrinking).'), { status: 400 });
  if (!prev && !img) throw Object.assign(new Error('Add a picture first.'), { status: 400 });
  if (!prev && list.length >= MAX_ART) throw Object.assign(new Error(`The gallery holds up to ${MAX_ART} pieces. Delete one first.`), { status: 400 });
  if (img) {
    await writeJson(imgKey(item.id), `data:${img.type};base64,${img.b64}`);
    await writeJson(thumbKey(item.id), th ? `data:${th.type};base64,${th.b64}` : `data:${img.type};base64,${img.b64}`);
    item.v = (prev?.v || 0) + 1;
    item.w = Math.max(0, Math.min(8000, Math.round(Number(input.w) || 0)));
    item.h = Math.max(0, Math.min(8000, Math.round(Number(input.h) || 0)));
    item.color = hex(input.color, item.color); item.tone = hex(input.tone, item.tone);
  } else if (prev && input.color) {
    item.color = hex(input.color, item.color); item.tone = hex(input.tone, item.tone); // colours only, picture untouched
  }
  return update<ArtItem[]>(LIST, [], (l) => {
    const i = l.findIndex((a) => a.id === item.id);
    if (i >= 0) l[i] = item; else l.unshift(item);
  });
}

export async function deleteArt(id: string): Promise<ArtItem[]> {
  const k = cleanId(id);
  await Promise.all([removeJson(imgKey(k)), removeJson(thumbKey(k))]);
  return update<ArtItem[]>(LIST, [], (l) => l.filter((a) => a.id !== k));
}

export function moveArt(id: string, dir: 'up' | 'down'): Promise<ArtItem[]> {
  const k = cleanId(id);
  return update<ArtItem[]>(LIST, [], (l) => {
    const i = l.findIndex((a) => a.id === k), j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
  });
}
