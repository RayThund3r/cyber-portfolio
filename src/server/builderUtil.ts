// src/server/builderUtil.ts — small helpers the builder needs on top of the generic store (kept out of store.ts on purpose).
//
// Everything is written against the store's exported API only (readJson / update / removeJson / listNames), so it works with
// whichever backend the store uses (disk, or a hosted key-value service).
import 'server-only';
import { listNames, readJson, removeJson, update } from './store';
import { BLANK_ID, BLANK_TEMPLATE, PRESETS, type TemplateDef } from '@/lib/builder/templates';
import { CATEGORIES } from '@/lib/builder/schema';

/** Writes a whole JSON document (used for write-once files such as pictures). */
export async function putJson(name: string, data: unknown): Promise<void> {
  await update<unknown>(name, null, () => data as never);
}

/** Removes every document stored under `dir/` (one level, e.g. all pictures of a site). */
export async function removeTree(dir: string): Promise<void> {
  for (const n of await listNames(dir)) await removeJson(`${dir}/${n}`);
}

/* ───────── template catalogue (with migration of older stored catalogues) ───────── */
const CAT_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const toCat = (c: unknown) => (typeof c === 'string' && CAT_IDS.has(c.toLowerCase()) ? c.toLowerCase() : 'business');

/** The builder's "Start from scratch" entry must always exist, even if it was deleted from the stored catalogue. */
const withBlank = (items: TemplateDef[]): TemplateDef[] => (items.some((t) => t.id === BLANK_ID) ? items : [BLANK_TEMPLATE, ...items]);

/** Stored catalogue + migration: older stores gain priceUSD / valid categories, and newly shipped built-in designs appear. */
export async function getTemplates(): Promise<TemplateDef[]> {
  const stored = await readJson<{ items: TemplateDef[] | null; v?: number }>('templates', { items: null });
  if (!stored.items || !stored.items.length) return withBlank(PRESETS);
  const have = new Set(stored.items.map((t) => t.id));
  const items = stored.items.map((t) => ({
    ...t,
    priceUSD: t.priceUSD === undefined ? (PRESETS.find((p) => p.id === t.id)?.priceUSD ?? null) : t.priceUSD,
    priceUGX: t.priceUGX === undefined ? null : t.priceUGX,
    category: toCat(t.category),
  }));
  if (stored.v !== 2) for (const p of PRESETS) if (!have.has(p.id)) items.push(p);
  return withBlank(items);
}

export async function saveTemplates(items: TemplateDef[]): Promise<void> {
  await update<{ items: TemplateDef[] | null; v?: number }>('templates', { items: null }, (d) => { d.items = items; d.v = 2; });
}
