// src/lib/admin/events.ts — storage for the world-events settings (server only). Rules live in lib/events/config.ts.
import { db } from './store';
import { sanitizeEventsCfg, type EventsConfig } from '@/lib/events/config';

const KEY = 'events:cfg:v1';
export const readEventsCfg = async (): Promise<EventsConfig> => sanitizeEventsCfg(await db.getJSON<unknown>(KEY, {}));
export async function writeEventsCfg(raw: unknown): Promise<EventsConfig> {
  const c = sanitizeEventsCfg(raw);
  await db.setJSON(KEY, c);
  return c;
}
