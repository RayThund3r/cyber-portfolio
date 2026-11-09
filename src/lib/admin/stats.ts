// src/lib/admin/stats.ts — turns the per-day counters into the numbers the dashboard shows.
import { getStore, pairs } from './store';
import { dayKey } from './track';

export interface DayRow { date: string; pv: number; uv: number; chat: number; gap: number; games: number; msgs: number }
export interface Top { name: string; n: number }
export interface Stats {
  mode: 'upstash' | 'memory';
  days: DayRow[];
  prev: { pv: number; uv: number; chat: number };
  totals: { pv: number; uv: number; chat: number; gap: number; games: number; msgs: number };
  paths: Top[]; refs: Top[]; countries: Top[]; devices: Top[]; browsers: Top[]; os: Top[]; chatSources: Top[];
  hours: number[];
  games: Array<{ id: string; w: number; l: number; d: number; plays: number }>;
  speed: Array<{ path: string; avgMs: number; n: number }>;
}

const num = (v: string | undefined) => Number(v) || 0;
const top = (acc: Map<string, number>, n = 12): Top[] => [...acc].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, v]) => ({ name, n: v }));

export function dateRange(days: number, end = Date.now()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(dayKey(end - i * 86400000));
  return out;
}

export async function readStats(days = 14, end = Date.now()): Promise<Stats> {
  days = Math.max(1, Math.min(90, Math.floor(days)));
  const store = getStore();
  const range = dateRange(days * 2, end); // second half = the previous period (for "vs last period")
  const cmds = range.flatMap((d) => [['HGETALL', `s:d:${d}`], ['PFCOUNT', `s:u:${d}`], ['HGET', `inbox:count`, d]] as Array<Array<string | number>>);
  const res = await store.pipe(cmds);
  const rows = range.map((date, i) => ({ date, h: pairs(res[i * 3]), uv: num(String(res[i * 3 + 1] ?? 0)), msgs: num(String(res[i * 3 + 2] ?? 0)) }));
  const cur = rows.slice(days), prev = rows.slice(0, days);
  const sum = (arr: typeof rows, f: (r: (typeof rows)[number]) => number) => arr.reduce((a, r) => a + f(r), 0);
  const maps = { p: new Map<string, number>(), r: new Map<string, number>(), c: new Map<string, number>(), d: new Map<string, number>(), b: new Map<string, number>(), o: new Map<string, number>(), cs: new Map<string, number>() };
  const hours = new Array(24).fill(0);
  const games = new Map<string, { id: string; w: number; l: number; d: number; plays: number }>();
  const lt = new Map<string, { t: number; n: number }>();
  for (const r of cur) {
    for (const [f, v] of Object.entries(r.h)) {
      const n = num(v);
      const colon = f.indexOf(':');
      if (colon < 0) continue;
      const pre = f.slice(0, colon), name = f.slice(colon + 1);
      if (pre === 'h') hours[Number(name)] += n;
      else if (pre in maps) { const m = maps[pre as keyof typeof maps]; m.set(name, (m.get(name) || 0) + n); }
      else if (pre === 'g') {
        const [id, res2] = name.split(':');
        const g = games.get(id) || { id, w: 0, l: 0, d: 0, plays: 0 };
        if (res2 === 'w') g.w += n; else if (res2 === 'l') g.l += n; else if (res2 === 'd') g.d += n; else g.plays += n;
        games.set(id, g);
      } else if (pre === 'lt' || pre === 'ln') {
        const e = lt.get(name) || { t: 0, n: 0 };
        if (pre === 'lt') e.t += n; else e.n += n;
        lt.set(name, e);
      }
    }
  }
  const dayRows: DayRow[] = cur.map((r) => ({ date: r.date, pv: num(r.h.pv), uv: r.uv, chat: num(r.h.chat), gap: num(r.h.gap), games: num(r.h.game), msgs: r.msgs }));
  const tot = (f: keyof Omit<DayRow, 'date'>) => dayRows.reduce((a, r) => a + r[f], 0);
  return {
    mode: store.mode,
    days: dayRows,
    prev: { pv: sum(prev, (r) => num(r.h.pv)), uv: sum(prev, (r) => r.uv), chat: sum(prev, (r) => num(r.h.chat)) },
    totals: { pv: tot('pv'), uv: tot('uv'), chat: tot('chat'), gap: tot('gap'), games: tot('games'), msgs: tot('msgs') },
    paths: top(maps.p, 15), refs: top(maps.r), countries: top(maps.c), devices: top(maps.d), browsers: top(maps.b), os: top(maps.o), chatSources: top(maps.cs),
    hours,
    games: [...games.values()].map((g) => ({ ...g, plays: g.plays + g.w + g.l + g.d })).sort((a, b) => b.plays - a.plays),
    speed: [...lt].filter(([, e]) => e.n > 0).map(([path, e]) => ({ path, avgMs: Math.round(e.t / e.n), n: e.n })).sort((a, b) => b.n - a.n).slice(0, 12),
  };
}
