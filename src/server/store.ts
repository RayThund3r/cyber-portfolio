// src/server/store.ts
//
// Tiny JSON datastore. The rest of the app only uses the helpers exported from this file; underneath there are three
// interchangeable back-ends, chosen automatically:
//
//  1. Upstash Redis (FREE) — used when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or the KV_REST_API_URL +
//     KV_REST_API_TOKEN pair that Vercel -> Storage -> Upstash creates) are set. Persistent on Vercel / any serverless
//     host. Big records (customers' pictures) are split into safe-size pieces transparently.
//  2. JSON files — a VPS, your own computer, Railway/Render with a volume. Atomic writes, a last-good copy (.bak),
//     damaged files are quarantined, one writer at a time. Folder: DATA_DIR or ./.data
//  3. Vercel without a database: the project folder is read-only there, so files go to /tmp. Everything works, but /tmp
//     is wiped whenever the instance restarts — storageInfo().persistent is false and the admin dashboard says so.
import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getStore, storeConfigured, type Store } from '@/lib/admin/store';
import type { TicketStatus, PayNetwork, PayStatus } from '@/lib/shared';
import { ALL_PROJECTS, type ProjectItem } from '@/data/portfolioData';

const NAME_RE = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;
const checkName = (name: string): string => {
  if (!NAME_RE.test(name)) throw new Error('Invalid store name');
  return name;
};
const split = (name: string): { dir: string; leaf: string } => {
  const i = name.lastIndexOf('/');
  return i < 0 ? { dir: '', leaf: name } : { dir: name.slice(0, i), leaf: name.slice(i + 1) };
};

interface Backend {
  readonly kind: 'redis' | 'file';
  /** Raw JSON text, or null when the record does not exist. */
  get(name: string): Promise<string | null>;
  put(name: string, text: string): Promise<void>;
  del(name: string): Promise<void>;
  /** Removes every record directly inside `dir` (e.g. 'assets/PRJ-ABC123'). */
  delTree(dir: string): Promise<void>;
  /** Names (without the directory) of the records directly inside `dir`. */
  list(dir: string): Promise<string[]>;
}

/* ───────────────────────── file back-end ───────────────────────── */
const ON_VERCEL = !!process.env.VERCEL;
const DIR = process.env.DATA_DIR || (ON_VERCEL ? '/tmp/sys-data' : path.join(process.cwd(), '.data'));
const fileFor = (name: string) => path.join(DIR, `${checkName(name)}.json`);

export const fileBackend: Backend = {
  kind: 'file',
  /** If the file is missing mid-write or damaged, the last good copy (.bak) is used instead of silently starting empty. */
  async get(name) {
    const file = fileFor(name);
    const read = async (f: string) => {
      const text = await fs.readFile(f, 'utf8');
      JSON.parse(text); // throws when damaged
      return text;
    };
    try {
      return await read(file);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        console.error(`[store] ${name} is unreadable; keeping a copy and trying the last good version`, e?.message);
        try { await fs.copyFile(file, `${file}.corrupt-${Date.now()}`); } catch { /* nothing to keep */ }
      }
      try { return await read(`${file}.bak`); } catch { return null; }
    }
  },
  async put(name, text) {
    const file = fileFor(name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, text);
    try { await fs.rename(file, `${file}.bak`); } catch { /* first write: nothing to back up */ }
    await fs.rename(tmp, file);
  },
  async del(name) {
    const f = fileFor(name);
    await fs.rm(f, { force: true });
    await fs.rm(`${f}.bak`, { force: true });
  },
  async delTree(dir) {
    await fs.rm(path.join(DIR, ...checkName(dir).split('/')), { recursive: true, force: true });
  },
  async list(dir) {
    try {
      return (await fs.readdir(path.join(DIR, ...checkName(dir).split('/')))).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
    } catch {
      return [];
    }
  },
};

/* ───────────────────────── Redis back-end (Upstash REST or the in-memory look-alike used in tests) ─────────────────────────
   Upstash's free plan accepts about 1 MB per request, and JSON escaping can double a payload, so a record bigger than CHUNK
   characters is written as several pieces ("@@c:<version>:<count>" marker + pieces) — a reader never sees a half-written record. */
const CHUNK = 300_000;
const MARK = /^@@c:([a-z0-9]+):(\d+)$/;
const rk = (n: string) => `sd:${n}`;
const dirKey = (d: string) => `sd:dir:${d}`;

export function redisBackend(s: Store): Backend {
  const pieces = (name: string, ver: string, n: number) => Array.from({ length: n }, (_, i) => `${rk(name)}:${ver}:${i}`);
  const dropPieces = async (head: unknown, name: string) => {
    const m = typeof head === 'string' ? MARK.exec(head) : null;
    if (m) for (const k of pieces(name, m[1], Number(m[2]))) await s.cmd('DEL', k).catch(() => undefined);
  };
  return {
    kind: 'redis',
    async get(name) {
      checkName(name);
      const head = await s.cmd<string | null>('GET', rk(name));
      if (head == null) return null;
      const m = MARK.exec(head);
      if (!m) return head;
      // A writer may switch versions (and delete the old pieces) while we read. Re-read the head and try again; if the record
      // still cannot be read whole, THROW: returning "missing" would let a read-modify-write replace good data with the fallback.
      let cur: RegExpExecArray | null = m;
      for (let attempt = 0; attempt < 4 && cur; attempt++) {
        const out: string[] = [];
        let whole = true;
        for (const k of pieces(name, cur[1], Number(cur[2]))) {
          const part = await s.cmd<string | null>('GET', k);
          if (typeof part !== 'string') { whole = false; break; }
          out.push(part);
        }
        if (whole) return out.join('');
        await sleep(40 + attempt * 60);
        const again = await s.cmd<string | null>('GET', rk(name));
        if (again == null) return null;
        cur = MARK.exec(again);
        if (!cur) return again;
      }
      throw new Error(`[store] record "${name}" is temporarily unreadable (incomplete pieces)`);
    },
    async put(name, text) {
      checkName(name);
      const old = await s.cmd<string | null>('GET', rk(name));
      if (text.length <= CHUNK) {
        await s.cmd('SET', rk(name), text);
      } else {
        const ver = crypto.randomBytes(4).toString('hex');
        const n = Math.ceil(text.length / CHUNK);
        const keys = pieces(name, ver, n);
        for (let i = 0; i < n; i++) await s.cmd('SET', keys[i], text.slice(i * CHUNK, (i + 1) * CHUNK));
        await s.cmd('SET', rk(name), `@@c:${ver}:${n}`); // the marker goes last: switching to the new version is one step
      }
      await dropPieces(old, name);
      const { dir, leaf } = split(name);
      if (dir) await s.cmd('HSET', dirKey(dir), leaf, 1);
    },
    async del(name) {
      checkName(name);
      const head = await s.cmd<string | null>('GET', rk(name));
      await dropPieces(head, name);
      await s.cmd('DEL', rk(name));
      const { dir, leaf } = split(name);
      if (dir) await s.cmd('HDEL', dirKey(dir), leaf);
    },
    async list(dir) {
      const flat = await s.cmd<string[] | null>('HGETALL', dirKey(checkName(dir)));
      const names: string[] = [];
      for (let i = 0; Array.isArray(flat) && i < flat.length; i += 2) names.push(String(flat[i]));
      return names;
    },
    async delTree(dir) {
      for (const leaf of await this.list(dir)) await this.del(`${dir}/${leaf}`);
      await s.cmd('DEL', dirKey(dir));
    },
  };
}

let chosen: Backend | null = null;
const backend = (): Backend => (chosen ??= storeConfigured() ? redisBackend(getStore()) : fileBackend);
/** Test hook: force a back-end (null = choose automatically again). */
export const __setBackend = (b: Backend | null) => { chosen = b; };

export function storageInfo(): { kind: 'redis' | 'file'; persistent: boolean; where: string; note: string } {
  if (storeConfigured()) return { kind: 'redis', persistent: true, where: 'Upstash Redis', note: 'Data is kept in your Upstash database.' };
  if (ON_VERCEL && !process.env.DATA_DIR) {
    return { kind: 'file', persistent: false, where: '/tmp (temporary)', note: 'This host wipes its disk whenever the server restarts, so requests, bookings and customer sites can disappear. Connect the free Upstash Redis (Vercel > Storage) to keep them.' };
  }
  return { kind: 'file', persistent: true, where: DIR, note: 'Data is kept as files in this folder — back it up, and make sure the host keeps this disk between deploys.' };
}

/* ───────────────────────── helpers used by the rest of the app ───────────────────────── */
export const listNames = (dir: string): Promise<string[]> => backend().list(dir);
export const removeJson = (name: string): Promise<void> => backend().del(name);
export const removeTree = (dir: string): Promise<void> => backend().delTree(dir);

/** Reads a record; a missing or damaged one gives `fallback`. */
export async function readJson<T>(name: string, fallback: T): Promise<T> {
  const text = await backend().get(name);
  if (text == null) return fallback;
  try { return JSON.parse(text) as T; } catch { return fallback; }
}

/** Writes a whole record (no read-modify-write). Use for write-once records such as pictures. */
export const putJson = (name: string, data: unknown): Promise<void> => backend().put(name, JSON.stringify(data));
export const writeJson = putJson;

const locks = new Map<string, Promise<unknown>>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Several server instances may run at once on serverless hosts: a short Redis lock keeps two read-modify-writes of one record apart. */
async function withRemoteLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (backend().kind !== 'redis') return fn();
  const s = getStore();
  const key = `sd:lock:${name}`;
  let got = false;
  for (let i = 0; i < 40 && !got; i++) {
    // One atomic command: it can never leave a lock behind without an expiry if this instance dies half-way.
    got = (await s.cmd<string | null>('SET', key, '1', 'NX', 'EX', 15)) === 'OK';
    if (!got) await sleep(75 + Math.random() * 75);
  }
  try { return await fn(); } finally { if (got) await s.cmd('DEL', key).catch(() => undefined); }
}

export function update<T>(name: string, fallback: T, mutate: (d: T) => T | void): Promise<T> {
  const prev = locks.get(name) || Promise.resolve();
  const run = prev.catch(() => undefined).then(() =>
    withRemoteLock(name, async () => {
      const data = await readJson<T>(name, fallback);
      const out = (mutate(data) ?? data) as T;
      await putJson(name, out);
      return out;
    })
  );
  locks.set(name, run.catch(() => undefined));
  return run;
}

// ───────────────────────── Tickets (repairs, design requests, bookings, payments) ─────────────────────────

export interface Payment {
  id: string; network: PayNetwork; txId: string; amountUGX?: number; status: PayStatus; at: string;
}
export interface Ticket {
  id: string; kind: 'repair' | 'design' | 'template';
  /** Template-builder orders link to the customer's site project. */
  projectId?: string;
  name: string; email: string; phone: string; details: string;
  slot?: { date: string; time: string };
  status: TicketStatus;
  quoteUGX?: number; depositUGX?: number;
  payments: Payment[];
  history: { at: string; status: TicketStatus; note?: string }[];
  adminNotes?: string;
  createdAt: string; updatedAt: string;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export function newTicketId(): string {
  const b = crypto.randomBytes(6);
  return 'SYS-' + Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('');
}

export const listTickets = () => readJson<Ticket[]>('tickets', []);

export async function createTicket(
  input: Pick<Ticket, 'kind' | 'name' | 'email' | 'phone' | 'details' | 'slot'> & Partial<Pick<Ticket, 'id' | 'projectId' | 'quoteUGX' | 'depositUGX'>>
): Promise<Ticket> {
  const now = new Date().toISOString();
  const ticket: Ticket = {
    ...input,
    id: input.id || newTicketId(),
    status: 'RECEIVED',
    payments: [],
    history: [{ at: now, status: 'RECEIVED', note: input.slot ? `Visit requested for ${input.slot.date} at ${input.slot.time}.` : 'We received your request.' }],
    createdAt: now,
    updatedAt: now,
  };
  await update<Ticket[]>('tickets', [], (all) => {
    all.unshift(ticket);
    if (all.length > 5000) all.length = 5000;
  });
  return ticket;
}

export async function findTicket(id: string): Promise<Ticket | undefined> {
  return (await listTickets()).find((t) => t.id === id.toUpperCase().trim());
}

/** Applies fn to a ticket atomically; returns the updated ticket (or undefined if not found). */
export async function mutateTicket(id: string, fn: (t: Ticket) => void): Promise<Ticket | undefined> {
  let out: Ticket | undefined;
  await update<Ticket[]>('tickets', [], (all) => {
    const t = all.find((x) => x.id === id);
    if (!t) return;
    fn(t);
    t.updatedAt = new Date().toISOString();
    out = t;
  });
  return out;
}

/** Sets the same status on many tickets in one atomic write. Returns how many changed. */
export async function bulkSetStatus(ids: string[], status: TicketStatus, note?: string): Promise<number> {
  const wanted = new Set(ids);
  let changed = 0;
  await update<Ticket[]>('tickets', [], (all) => {
    const now = new Date().toISOString();
    for (const t of all) {
      if (!wanted.has(t.id) || t.status === status) continue;
      t.status = status;
      t.updatedAt = now;
      t.history.push({ at: now, status, note: note || undefined });
      changed++;
    }
  });
  return changed;
}

/** Permanently removes tickets (spam clean-up). Returns how many were removed. */
export async function deleteTickets(ids: string[]): Promise<number> {
  const doomed = new Set(ids);
  let removed = 0;
  await update<Ticket[]>('tickets', [], (all) => {
    const keep = all.filter((t) => !doomed.has(t.id));
    removed = all.length - keep.length;
    return keep;
  });
  return removed;
}

/** Adds tickets whose id does not exist yet (never overwrites). Returns { added, skipped }. */
export async function importTickets(incoming: Ticket[]): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  await update<Ticket[]>('tickets', [], (all) => {
    const have = new Set(all.map((t) => t.id));
    for (const t of incoming) {
      if (have.has(t.id)) { skipped++; continue; }
      all.push(t);
      have.add(t.id);
      added++;
    }
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (all.length > 5000) all.length = 5000;
  });
  return { added, skipped };
}

export async function slotCounts(date: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const t of await listTickets()) {
    if (t.slot?.date === date && t.status !== 'CANCELLED') counts[t.slot.time] = (counts[t.slot.time] || 0) + 1;
  }
  return counts;
}

// ───────────────────────── Portfolio CMS ─────────────────────────

export async function getProjects(): Promise<ProjectItem[]> {
  // Every page renders through the root layout, so a storage outage (Redis down / over quota) must never take
  // the whole site (and the admin login) down with it: fall back to the built-in list.
  try {
    const stored = await readJson<{ items: ProjectItem[] | null }>('projects', { items: null });
    return stored.items && stored.items.length ? stored.items : ALL_PROJECTS;
  } catch (e) {
    console.error('[store] getProjects failed, using built-in projects:', e instanceof Error ? e.message : e);
    return ALL_PROJECTS;
  }
}

export async function saveProjects(items: ProjectItem[]) {
  await update<{ items: ProjectItem[] | null }>('projects', { items: null }, (d) => {
    d.items = items;
  });
}

// ───────────────────────── Analytics, unanswered chat questions, errors ─────────────────────────

interface Stats {
  days: Record<string, { views: Record<string, number>; events: Record<string, number> }>;
  unanswered: Record<string, { n: number; last: string }>;
  errors: Record<string, { msg: string; where: string; n: number; first: string; last: string }>;
}
const EMPTY_STATS: Stats = { days: {}, unanswered: {}, errors: {} };

export const readStats = () => readJson<Stats>('stats', EMPTY_STATS);

type Pending = { view: Record<string, number>; event: Record<string, number>; unanswered: Record<string, number> };
let pending: Pending = { view: {}, event: {}, unanswered: {} };
let timer: ReturnType<typeof setTimeout> | null = null;

/** Writes the buffered counters into the stats record. */
async function flushPending() {
  const p = pending;
  pending = { view: {}, event: {}, unanswered: {} };
  if (!Object.keys(p.view).length && !Object.keys(p.event).length && !Object.keys(p.unanswered).length) return;
  const day = new Date().toISOString().slice(0, 10);
  try {
    await update<Stats>('stats', EMPTY_STATS, (s) => {
      s.days[day] ||= { views: {}, events: {} };
      for (const [k, n] of Object.entries(p.view)) if (k in s.days[day].views || Object.keys(s.days[day].views).length < MAX_KEYS) s.days[day].views[k] = (s.days[day].views[k] || 0) + n;
      for (const [k, n] of Object.entries(p.event)) s.days[day].events[k] = (s.days[day].events[k] || 0) + n;
      for (const [k, n] of Object.entries(p.unanswered)) {
        s.unanswered[k] = { n: (s.unanswered[k]?.n || 0) + n, last: new Date().toISOString() };
      }
      const keys = Object.keys(s.days).sort();
      while (keys.length > 60) delete s.days[keys.shift()!];
      const u = Object.entries(s.unanswered);
      if (u.length > 300) s.unanswered = Object.fromEntries(u.sort((a, b) => b[1].n - a[1].n).slice(0, 200));
    });
  } catch (e) {
    console.warn('[stats] flush failed', e);
  }
}

/** On a long-running server the counters are batched (one write every 5 s). On Vercel / any serverless host the process is
 *  frozen right after the response, so a timer may never fire and the counts would silently vanish: there the write is awaited. */
const serverless = () => !!process.env.VERCEL || backend().kind === 'redis';
function settle(): Promise<void> {
  if (serverless()) return flushPending();
  if (!timer) timer = setTimeout(() => { timer = null; void flushPending(); }, 5000);
  return Promise.resolve();
}

const MAX_KEYS = 200; // analytics keys are visitor-influenced: never let them grow without limit
const bump = (m: Record<string, number>, k: string) => { if (k in m || Object.keys(m).length < MAX_KEYS) m[k] = (m[k] || 0) + 1; };
export function bumpView(path: string): Promise<void> { bump(pending.view, path); return settle(); }
export function bumpEvent(name: string): Promise<void> { pending.event[name] = (pending.event[name] || 0) + 1; return settle(); }
export function bumpUnanswered(q: string): Promise<void> { bump(pending.unanswered, q); return settle(); }

/** Returns true when this error signature is new (so the caller can alert the owner once). */
export async function recordError(msg: string, where: string): Promise<boolean> {
  const sig = crypto.createHash('sha1').update(`${where}|${msg}`).digest('hex').slice(0, 12);
  let isNew = false;
  await update<Stats>('stats', EMPTY_STATS, (s) => {
    const now = new Date().toISOString();
    const e = s.errors[sig];
    if (e) { e.n++; e.last = now; }
    else {
      isNew = true;
      s.errors[sig] = { msg, where, n: 1, first: now, last: now };
      const all = Object.entries(s.errors);
      if (all.length > 200) s.errors = Object.fromEntries(all.sort((a, b) => b[1].last.localeCompare(a[1].last)).slice(0, 150));
    }
  });
  return isNew;
}


// ───────────────────────── Website-template catalog (owner-editable) ───────────────────────
import { BLANK_ID, BLANK_TEMPLATE, PRESETS, type TemplateDef } from '@/lib/builder/templates';
import { CATEGORIES } from '@/lib/builder/schema';

const CAT_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const toCat = (c: unknown) => (typeof c === 'string' && CAT_IDS.has(c.toLowerCase()) ? c.toLowerCase() : 'business');

/**
 * Stored catalog + migration: older stores gain priceUSD / valid categories, newly shipped built-in designs appear,
 * and "Start from scratch" is always available, even for installs that saved their own template list earlier.
 */
export async function getTemplates(): Promise<TemplateDef[]> {
  const stored = await readJson<{ items: TemplateDef[] | null; v?: number }>('templates', { items: null });
  if (!stored.items || !stored.items.length) return PRESETS;
  const have = new Set(stored.items.map((t) => t.id));
  const items = stored.items.map((t) => ({
    ...t,
    priceUSD: t.priceUSD === undefined ? (PRESETS.find((p) => p.id === t.id)?.priceUSD ?? null) : t.priceUSD,
    priceUGX: t.priceUGX === undefined ? null : t.priceUGX,
    category: toCat(t.category),
  }));
  if (stored.v !== 2) for (const p of PRESETS) if (!have.has(p.id)) items.push(p);
  return items.some((t) => t.id === BLANK_ID) ? items : [BLANK_TEMPLATE, ...items];
}
export async function saveTemplates(items: TemplateDef[]) {
  await update<{ items: TemplateDef[] | null; v?: number }>('templates', { items: null }, (d) => { d.items = items; d.v = 2; });
}
