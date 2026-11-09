import { admin } from '@/lib/admin/api';
import { db, getStore } from '@/lib/admin/store';
import { dayKey } from '@/lib/admin/track';
import type { LiveEvent } from '@/lib/admin/track';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => {
  const store = getStore();
  const [events, uv] = await Promise.all([db.list<LiveEvent>('s:ev', 60), store.cmd<number>('PFCOUNT', 's:u:' + dayKey()).catch(() => 0)]);
  const fiveMin = Date.now() - 5 * 60_000;
  return { now: Date.now(), events, activeNow: events.filter((e) => e.t > fiveMin && e.k === 'pv').length, uniqueToday: uv, mode: store.mode };
});
