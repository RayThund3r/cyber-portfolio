// src/server/liveVersion.ts — a tiny "what version of the site is live" stamp. Every owner save bumps it; open pages ask
// /api/version (see components/site/LiveUpdates.tsx) and refresh themselves when it changed, so nobody has to reload by hand.
import 'server-only';
import { revalidatePath } from 'next/cache';
import { readJson, writeJson } from '@/server/store';

const KEY = 'site-version';
export async function getSiteVersion(): Promise<string> {
  try { const d = await readJson<{ v?: string }>(KEY, {}); return d.v || '0'; } catch { return '0'; }
}
export async function bumpSiteVersion(): Promise<string> {
  const v = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  try { await writeJson(KEY, { v }); } catch { /* storage down: the next save will bump it */ }
  return v;
}
/** After an owner save that changes what visitors see: rebuild the cached pages AND tell open pages to refresh. */
export async function publishChange(...extraPaths: string[]) {
  try { revalidatePath('/', 'layout'); for (const p of extraPaths) revalidatePath(p, 'layout'); } catch { /* not in a request */ }
  await bumpSiteVersion();
}
