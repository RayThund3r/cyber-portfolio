// src/lib/admin/games.ts — storage for the owner's extra web games (server only). Rules and validation live in lib/games/ext.ts.
import { db } from './store';
import { sanitizeExt, type ExtGame } from '@/lib/games/ext';

export * from '@/lib/games/ext';
const KEY = 'games:ext:v1';

export const readExt = async (): Promise<ExtGame[]> => sanitizeExt(await db.getJSON<unknown>(KEY, []));
export async function writeExt(list: unknown): Promise<ExtGame[]> {
  const c = sanitizeExt(list);
  await db.setJSON(KEY, c);
  return c;
}

