// src/lib/admin/store.ts
//
// One tiny storage layer for everything the admin panel keeps (settings, inbox, jobs, stats...).
//
//  * If you connect a FREE Upstash Redis database (Vercel -> Storage -> Upstash, or upstash.com), the data is
//    persistent. Env vars (either pair works): UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or
//    KV_REST_API_URL + KV_REST_API_TOKEN (what the Vercel integration creates).
//  * Without it, a small in-memory Redis look-alike is used. Everything works, but data is lost whenever the
//    serverless instance restarts, so the panel shows an "ephemeral" warning.
//
// Both back-ends speak the same handful of Redis commands, so the app code never knows the difference.

export type Arg = string | number;
export type Cmd = Arg[];

export interface Store {
  mode: 'upstash' | 'memory';
  cmd<T = unknown>(...args: Cmd): Promise<T>;
  pipe(cmds: Cmd[]): Promise<unknown[]>;
}

export class StoreError extends Error {}

/* ------------------------------------------------------------------ in-memory Redis subset ------------------------------------------------------------------ */
interface Mem {
  kv: Map<string, unknown>;
  exp: Map<string, number>;
}
const g = globalThis as unknown as { __sysAdminMem?: Mem };
const mem = (): Mem => (g.__sysAdminMem ??= { kv: new Map(), exp: new Map() });

const alive = (m: Mem, k: string) => {
  const e = m.exp.get(k);
  if (e !== undefined && e <= Date.now()) { m.kv.delete(k); m.exp.delete(k); return false; }
  return m.kv.has(k);
};
const bound = (v: Arg, dflt: number) => {
  const s = String(v);
  if (s === '-inf') return -Infinity;
  if (s === '+inf' || s === 'inf') return Infinity;
  const n = Number(s.replace('(', ''));
  return Number.isFinite(n) ? n : dflt;
};

export function memExec(args: Cmd): unknown {
  const m = mem();
  const op = String(args[0]).toUpperCase();
  const k = String(args[1] ?? '');
  const get = <T,>(mk: () => T): T => {
    if (!alive(m, k)) m.kv.set(k, mk());
    return m.kv.get(k) as T;
  };
  switch (op) {
    case 'GET': return alive(m, k) ? (m.kv.get(k) as string) : null;
    case 'SET': {
      if (args.slice(3).some((a) => String(a).toUpperCase() === 'NX') && alive(m, k)) return null; // SET ... NX: only when absent
      m.kv.set(k, String(args[2]));
      m.exp.delete(k);
      const i = args.findIndex((a, n) => n > 2 && String(a).toUpperCase() === 'EX');
      if (i > 0) m.exp.set(k, Date.now() + Number(args[i + 1]) * 1000);
      return 'OK';
    }
    case 'DEL': { let n = 0; for (const key of args.slice(1).map(String)) if (alive(m, key)) { m.kv.delete(key); m.exp.delete(key); n++; } return n; }
    case 'INCR': { const cur = alive(m, k) ? Number(m.kv.get(k)) : 0; m.kv.set(k, String(cur + 1)); return cur + 1; }
    case 'EXPIRE': if (!alive(m, k)) return 0; m.exp.set(k, Date.now() + Number(args[2]) * 1000); return 1;
    case 'HGET': return alive(m, k) ? ((m.kv.get(k) as Map<string, string>).get(String(args[2])) ?? null) : null;
    case 'HSET': { const h = get(() => new Map<string, string>()); let n = 0; for (let i = 2; i + 1 < args.length; i += 2) { if (!h.has(String(args[i]))) n++; h.set(String(args[i]), String(args[i + 1])); } return n; }
    case 'HDEL': { if (!alive(m, k)) return 0; const h = m.kv.get(k) as Map<string, string>; let n = 0; for (const f of args.slice(2)) if (h.delete(String(f))) n++; return n; }
    case 'HLEN': return alive(m, k) ? (m.kv.get(k) as Map<string, string>).size : 0;
    case 'HGETALL': { if (!alive(m, k)) return []; const out: string[] = []; for (const [f, v] of m.kv.get(k) as Map<string, string>) out.push(f, v); return out; }
    case 'HINCRBY': { const h = get(() => new Map<string, string>()); const f = String(args[2]); const v = Number(h.get(f) ?? 0) + Number(args[3]); h.set(f, String(v)); return v; }
    case 'LPUSH': { const l = get(() => [] as string[]); for (const v of args.slice(2)) l.unshift(String(v)); return l.length; }
    case 'LTRIM': { if (!alive(m, k)) return 'OK'; const l = m.kv.get(k) as string[]; const a = Number(args[2]), b = Number(args[3]); m.kv.set(k, l.slice(a < 0 ? Math.max(0, l.length + a) : a, (b < 0 ? l.length + b : b) + 1)); return 'OK'; }
    case 'LRANGE': { if (!alive(m, k)) return []; const l = m.kv.get(k) as string[]; const a = Number(args[2]), b = Number(args[3]); return l.slice(a < 0 ? Math.max(0, l.length + a) : a, (b < 0 ? l.length + b : b) + 1); }
    case 'PFADD': { const s = get(() => new Set<string>()); const before = s.size; for (const v of args.slice(2)) s.add(String(v)); return s.size > before ? 1 : 0; }
    case 'PFCOUNT': { const seen = new Set<string>(); for (const key of args.slice(1).map(String)) if (alive(m, key)) for (const v of m.kv.get(key) as Set<string>) seen.add(v); return seen.size; }
    case 'ZADD': { const z = get(() => new Map<string, number>()); const had = z.has(String(args[3])); z.set(String(args[3]), Number(args[2])); return had ? 0 : 1; }
    case 'ZREMRANGEBYSCORE': { if (!alive(m, k)) return 0; const z = m.kv.get(k) as Map<string, number>; const lo = bound(args[2], -Infinity), hi = bound(args[3], Infinity); let n = 0; for (const [mb, sc] of [...z]) if (sc >= lo && sc <= hi) { z.delete(mb); n++; } return n; }
    case 'ZCOUNT': { if (!alive(m, k)) return 0; const z = m.kv.get(k) as Map<string, number>; const lo = bound(args[2], -Infinity), hi = bound(args[3], Infinity); let n = 0; for (const sc of z.values()) if (sc >= lo && sc <= hi) n++; return n; }
    case 'FLUSHALL': m.kv.clear(); m.exp.clear(); return 'OK';
    default: throw new StoreError('Unsupported command in memory store: ' + op);
  }
}

const memStore: Store = {
  mode: 'memory',
  async cmd<T>(...args: Cmd) { return memExec(args) as T; },
  async pipe(cmds) { return cmds.map((c) => memExec(c)); },
};

/* ------------------------------------------------------------------ Upstash REST ------------------------------------------------------------------ */
function upstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

async function call(url: string, token: string, body: unknown): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new StoreError(`Upstash HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    throw e instanceof StoreError ? e : new StoreError('Upstash request failed');
  } finally {
    clearTimeout(t);
  }
}

function upstashStore(env: { url: string; token: string }): Store {
  return {
    mode: 'upstash',
    async cmd<T>(...args: Cmd) {
      const r = (await call(env.url, env.token, args)) as { result?: T; error?: string };
      if (r.error) throw new StoreError(r.error);
      return r.result as T;
    },
    async pipe(cmds) {
      if (!cmds.length) return [];
      const r = (await call(env.url + '/pipeline', env.token, cmds)) as Array<{ result?: unknown; error?: string }>;
      return r.map((x) => { if (x.error) throw new StoreError(x.error); return x.result; });
    },
  };
}

export const storeConfigured = () => !!upstashEnv();
export function getStore(): Store {
  const e = upstashEnv();
  return e ? upstashStore(e) : memStore;
}

/* ------------------------------------------------------------------ typed helpers ------------------------------------------------------------------ */
export const pairs = (flat: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = String(flat[i + 1]);
  return out;
};
export const parse = <T,>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string') return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

export const db = {
  async getJSON<T>(key: string, fallback: T): Promise<T> {
    return parse<T>(await getStore().cmd<string | null>('GET', key), fallback);
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    await getStore().cmd('SET', key, JSON.stringify(value));
  },
  async hgetAllJSON<T>(key: string): Promise<T[]> {
    const raw = pairs(await getStore().cmd('HGETALL', key));
    return Object.values(raw).map((s) => parse<T | null>(s, null)).filter((x): x is T => x !== null);
  },
  async hgetJSON<T>(key: string, field: string): Promise<T | null> {
    return parse<T | null>(await getStore().cmd<string | null>('HGET', key, field), null);
  },
  async hsetJSON(key: string, field: string, value: unknown): Promise<void> {
    await getStore().cmd('HSET', key, field, JSON.stringify(value));
  },
  async hdel(key: string, field: string): Promise<void> {
    await getStore().cmd('HDEL', key, field);
  },
  async push(key: string, value: unknown, cap: number): Promise<void> {
    await getStore().pipe([['LPUSH', key, JSON.stringify(value)], ['LTRIM', key, 0, cap - 1]]);
  },
  async list<T>(key: string, n: number): Promise<T[]> {
    const raw = await getStore().cmd<string[]>('LRANGE', key, 0, n - 1);
    return (raw || []).map((s) => parse<T | null>(s, null)).filter((x): x is T => x !== null);
  },
};
