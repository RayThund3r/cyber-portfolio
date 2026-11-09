// src/lib/games/minesweeper.ts — Minesweeper rules (safe first click, flood fill, chording) and a
// exact probabilistic solver used for hints and the AI player: it enumerates every arrangement of mines
// that fits the visible numbers (per connected group of constraints), combines the groups with the
// global mine count, proves safe cells / mines when it can and otherwise picks the statistically
// safest guess.
export interface Cell { mine: boolean; open: boolean; flag: boolean; n: number }
export interface MsBoard { rows: number; cols: number; mines: number; cells: Cell[]; started: boolean; lost: boolean; won: boolean }

export const PRESETS = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 12, cols: 12, mines: 25 },
  expert: { rows: 16, cols: 16, mines: 50 },
} as const;
export type Preset = keyof typeof PRESETS;

export function empty(rows: number, cols: number, mines: number): MsBoard {
  return { rows, cols, mines, cells: Array.from({ length: rows * cols }, () => ({ mine: false, open: false, flag: false, n: 0 })), started: false, lost: false, won: false };
}

export function neighbours(b: { rows: number; cols: number }, i: number): number[] {
  const r = Math.floor(i / b.cols), c = i % b.cols, out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < b.rows && cc >= 0 && cc < b.cols) out.push(rr * b.cols + cc);
  }
  return out;
}

function place(b: MsBoard, safe: number, rand: () => number) {
  const banned = new Set([safe, ...neighbours(b, safe)]);
  const spots = b.cells.map((_, i) => i).filter((i) => !banned.has(i));
  for (let k = spots.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [spots[k], spots[j]] = [spots[j], spots[k]]; }
  for (const i of spots.slice(0, b.mines)) b.cells[i].mine = true;
  b.cells.forEach((c, i) => (c.n = neighbours(b, i).filter((j) => b.cells[j].mine).length));
  b.started = true;
}

const clone = (b: MsBoard): MsBoard => ({ ...b, cells: b.cells.map((c) => ({ ...c })) });

export function reveal(prev: MsBoard, i: number, rand: () => number = Math.random): MsBoard {
  if (prev.lost || prev.won) return prev;
  const b = clone(prev);
  if (!b.started) place(b, i, rand);
  const c = b.cells[i];
  if (c.open || c.flag) return prev;
  if (c.mine) { c.open = true; b.lost = true; b.cells.forEach((x) => { if (x.mine) x.open = true; }); return b; }
  const stack = [i];
  while (stack.length) {
    const j = stack.pop()!;
    const cell = b.cells[j];
    if (cell.open || cell.flag) continue;
    cell.open = true;
    if (cell.n === 0) for (const k of neighbours(b, j)) if (!b.cells[k].open) stack.push(k);
  }
  checkWin(b);
  return b;
}

/** Click an opened number whose flags match: open all other neighbours. */
export function chord(prev: MsBoard, i: number): MsBoard {
  const c = prev.cells[i];
  if (!c.open || c.n === 0 || prev.lost || prev.won) return prev;
  const ns = neighbours(prev, i);
  if (ns.filter((j) => prev.cells[j].flag).length !== c.n) return prev;
  let b = prev;
  for (const j of ns) if (!b.cells[j].flag && !b.cells[j].open) b = reveal(b, j);
  return b;
}

export function toggleFlag(prev: MsBoard, i: number): MsBoard {
  if (prev.lost || prev.won || prev.cells[i].open) return prev;
  const b = clone(prev);
  b.cells[i].flag = !b.cells[i].flag;
  return b;
}

function checkWin(b: MsBoard) {
  if (b.cells.every((c) => c.mine || c.open)) { b.won = true; b.cells.forEach((c) => { if (c.mine) c.flag = true; }); }
}

export const flagsLeft = (b: MsBoard) => b.mines - b.cells.filter((c) => c.flag).length;

export interface MsHint {
  safe: number[];
  mines: number[];
  guess?: number;
  chance?: number;
  why: string;
  /** Per cell probability of being a mine (-1 for opened cells). Present when the analysis ran. */
  probs?: number[];
  /** Flagged cells that are provably safe (the player's flag is wrong). */
  wrongFlags?: number[];
}

export interface MsAnalysis {
  probs: number[]; // -1 for opened cells
  safe: number[];
  mines: number[];
  /** true when some group was too large to enumerate and a local estimate was used for it */
  approx: boolean;
  /** number of mine arrangements of the frontier checked (capped, informational) */
  arrangements: number;
}

const NODE_CAP = 350000;

function lnChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  let s = 0;
  k = Math.min(k, n - k);
  for (let i = 0; i < k; i++) s += Math.log((n - i) / (i + 1));
  return s;
}
const choose = (n: number, k: number) => (k < 0 || k > n ? 0 : Math.exp(lnChoose(n, k)));
const conv = (a: number[], b: number[]) => {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) if (a[i]) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return out;
};

interface Group { cells: number[]; cons: Array<{ cells: number[]; need: number }>; ways: number[]; cnt: number[][]; ok: boolean }

/** Enumerates all consistent mine placements for one connected group of constraints. */
function enumerate(g: Group) {
  const n = g.cells.length;
  const local = new Map<number, number>();
  g.cells.forEach((c, i) => local.set(c, i));
  const cons = g.cons.map((c) => ({ cells: c.cells.map((x) => local.get(x)!), need: c.need, mines: 0, free: c.cells.length }));
  const of: number[][] = Array.from({ length: n }, () => []);
  cons.forEach((c, ci) => c.cells.forEach((x) => of[x].push(ci)));
  // order cells by BFS over constraints so constraints complete early
  const order: number[] = [], seen = new Array(n).fill(false);
  for (let s0 = 0; s0 < n; s0++) {
    if (seen[s0]) continue;
    seen[s0] = true;
    const q = [s0];
    while (q.length) {
      const x = q.shift()!;
      order.push(x);
      for (const ci of of[x]) for (const y of cons[ci].cells) if (!seen[y]) { seen[y] = true; q.push(y); }
    }
  }
  g.ways = new Array(n + 1).fill(0);
  g.cnt = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  const val = new Int8Array(n).fill(-1);
  let nodes = 0, mineCount = 0, aborted = false;
  const rec = (pos: number) => {
    if (aborted) return;
    if (++nodes > NODE_CAP) { aborted = true; return; }
    if (pos === n) {
      g.ways[mineCount]++;
      for (let i = 0; i < n; i++) if (val[i] === 1) g.cnt[i][mineCount]++;
      return;
    }
    const x = order[pos];
    for (let v = 0; v <= 1; v++) {
      let good = true;
      for (const ci of of[x]) {
        const c = cons[ci];
        c.free--; c.mines += v;
        if (c.mines > c.need || c.mines + c.free < c.need) good = false;
      }
      if (good) { val[x] = v; mineCount += v; rec(pos + 1); mineCount -= v; val[x] = -1; }
      for (const ci of of[x]) { const c = cons[ci]; c.free++; c.mines -= v; }
      if (aborted) return;
    }
  };
  rec(0);
  g.ok = !aborted;
}

/** Exact mine probabilities for every hidden cell (flags are not trusted: they are treated as unknown). */
export function analyse(b: MsBoard): MsAnalysis {
  const N = b.cells.length;
  const probs = new Array(N).fill(-1);
  // constraints from opened numbers
  const cons: Array<{ cells: number[]; need: number }> = [];
  const inFront = new Set<number>();
  for (let i = 0; i < N; i++) {
    const c = b.cells[i];
    if (!c.open || c.n === 0) continue;
    const hidden = neighbours(b, i).filter((j) => !b.cells[j].open);
    if (!hidden.length) continue;
    cons.push({ cells: hidden, need: c.n });
    hidden.forEach((h) => inFront.add(h));
  }
  // connected groups (cells linked by sharing a constraint)
  const parent = new Map<number, number>();
  const find = (x: number): number => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; let y = x; while (parent.get(y) !== r) { const nx = parent.get(y)!; parent.set(y, r); y = nx; } return r; };
  inFront.forEach((x) => parent.set(x, x));
  for (const c of cons) for (let k = 1; k < c.cells.length; k++) { const a = find(c.cells[0]), d = find(c.cells[k]); if (a !== d) parent.set(a, d); }
  const groups = new Map<number, Group>();
  inFront.forEach((x) => { const r = find(x); if (!groups.has(r)) groups.set(r, { cells: [], cons: [], ways: [], cnt: [], ok: true }); groups.get(r)!.cells.push(x); });
  for (const c of cons) groups.get(find(c.cells[0]))!.cons.push(c);
  const gs = [...groups.values()];
  gs.forEach(enumerate);

  const hiddenAll: number[] = [];
  for (let i = 0; i < N; i++) if (!b.cells[i].open) hiddenAll.push(i);
  const U = hiddenAll.length - inFront.size;
  const M = b.mines;
  const good = gs.filter((g) => g.ok);
  const approx = gs.some((g) => !g.ok);

  const safe: number[] = [], mines: number[] = [];
  let arrangements = 1;
  // Interior probability + per-group probabilities.
  const total = good.reduce((acc, g) => conv(acc, g.ways), [1]);
  // mines used by unsolved (approximate) groups are unknown; estimate them from local density
  let approxMines = 0;
  for (const g of gs) if (!g.ok) approxMines += g.cons.length ? Math.max(1, Math.round(g.cells.length * 0.25)) : 0;
  const Mrem = Math.max(0, M - approxMines);
  let Z = 0, interiorExp = 0;
  for (let s = 0; s < total.length; s++) {
    const w = total[s] * choose(U, Mrem - s);
    Z += w;
    interiorExp += w * (Mrem - s);
  }
  for (const g of good) arrangements *= Math.max(1, g.ways.reduce((a, c) => a + c, 0));
  const pInterior = Z > 0 && U > 0 ? interiorExp / Z / U : U > 0 ? Math.min(1, Math.max(0, Mrem / Math.max(1, U))) : 0;
  const EPS = 1e-12;
  for (const g of good) {
    const others = good.filter((h) => h !== g).reduce((acc, h) => conv(acc, h.ways), [1]);
    const wk = g.ways.map((_, k) => { let s = 0; for (let t = 0; t < others.length; t++) s += others[t] * choose(U, Mrem - k - t); return s; });
    let Zg = 0;
    g.ways.forEach((w, k) => (Zg += w * wk[k]));
    g.cells.forEach((cell, i) => {
      let p = 0;
      if (Zg > 0) for (let k = 0; k < g.ways.length; k++) p += g.cnt[i][k] * wk[k];
      p = Zg > 0 ? p / Zg : 0.5;
      probs[cell] = p;
      if (Zg > 0 && p <= EPS) safe.push(cell);
      else if (Zg > 0 && p >= 1 - EPS) mines.push(cell);
    });
  }
  // approximate groups: local heuristic (max of constraint ratios)
  for (const g of gs) if (!g.ok) for (const cell of g.cells) {
    const loc = g.cons.filter((c) => c.cells.includes(cell)).map((c) => c.need / c.cells.length);
    probs[cell] = Math.min(0.99, Math.max(0.01, Math.max(...loc)));
  }
  for (const i of hiddenAll) if (!inFront.has(i)) probs[i] = pInterior;
  return { probs, safe, mines, approx, arrangements };
}

/** What the AI would do next: provable cells first, otherwise the safest (and most informative) guess. */
export function solveHint(b: MsBoard): MsHint {
  const hiddenAll = b.cells.map((c, i) => (!c.open ? i : -1)).filter((i) => i >= 0);
  if (!hiddenAll.length || b.lost || b.won) return { safe: [], mines: [], why: 'Nothing left to do.' };
  const a = analyse(b);
  const newSafe = a.safe.filter((i) => !b.cells[i].flag);
  const wrongFlags = a.safe.filter((i) => b.cells[i].flag);
  const newMines = a.mines.filter((i) => !b.cells[i].flag);
  const exactNote = a.arrangements > 1 && a.arrangements < 1e6 ? ` I checked all ${Math.round(a.arrangements).toLocaleString()} ways the mines could fit.` : '';
  if (wrongFlags.length && !newSafe.length)
    return { safe: [], mines: newMines, wrongFlags, probs: a.probs, why: `Your flag${wrongFlags.length > 1 ? 's' : ''} on the highlighted cell${wrongFlags.length > 1 ? 's' : ''} can't be right: no arrangement of mines fits the numbers with a mine there.` };
  if (newSafe.length)
    return { safe: newSafe, mines: newMines, wrongFlags, probs: a.probs, why: `These cells are provably safe: in every arrangement of mines that fits the numbers they are empty.${exactNote}` };
  if (newMines.length)
    return { safe: [], mines: newMines, probs: a.probs, why: `These cells must be mines: in every arrangement that fits the numbers they hold one.${exactNote}` };
  // No certainty: pick the lowest probability, break ties towards cells likely to open up more.
  const cand = hiddenAll.filter((i) => !b.cells[i].flag);
  if (!cand.length) return { safe: [], mines: [], probs: a.probs, why: 'Everything left is flagged. Check your flags.' };
  const risk = (i: number) => a.probs[i];
  const spread = (i: number) => neighbours(b, i).reduce((s, j) => s + (b.cells[j].open ? 0 : Math.max(0, a.probs[j])), 0);
  let best = cand[0];
  for (const i of cand) {
    const d = risk(i) - risk(best);
    if (d < -1e-9 || (Math.abs(d) <= 1e-9 && spread(i) < spread(best))) best = i;
  }
  const pct = Math.round(risk(best) * 100);
  return { safe: [], mines: [], guess: best, chance: risk(best), probs: a.probs, why: `No certain move. This is the safest guess (about ${pct}% mine chance${a.approx ? ', estimated' : ''}).` };
}
