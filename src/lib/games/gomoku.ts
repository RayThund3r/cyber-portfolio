// src/lib/games/gomoku.ts — Gomoku (five in a row, free-style, 15×15) with a pattern-based alpha-beta AI.
// Board: Int8Array(N*N); 1 = Black (moves first), -1 = White, 0 empty.

export const N = 15;
export type Stone = 1 | -1;
export const idx = (r: number, c: number) => r * N + c;

export const emptyBoard = () => new Int8Array(N * N);
const DIRS: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** The winning line (5+ in a row) through the stone at `i`, or null. */
export function winLine(b: Int8Array, i: number): number[] | null {
  const p = b[i];
  if (!p) return null;
  const r = Math.floor(i / N), c = i % N;
  for (const [dr, dc] of DIRS) {
    const line = [i];
    for (const sgn of [1, -1]) {
      let rr = r + sgn * dr, cc = c + sgn * dc;
      while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[idx(rr, cc)] === p) { line.push(idx(rr, cc)); rr += sgn * dr; cc += sgn * dc; }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

const BASE = [0, 2, 14, 90, 700, 1000000];
/** Score of all 5-windows through (r,c) for `p` as if p stood there (used for move ordering). */
function cellScore(b: Int8Array, r: number, c: number, p: number): number {
  let total = 0;
  for (const [dr, dc] of DIRS) {
    for (let off = -4; off <= 0; off++) {
      let mine = 0, theirs = 0, ok = true;
      for (let k = 0; k < 5; k++) {
        const rr = r + (off + k) * dr, cc = c + (off + k) * dc;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) { ok = false; break; }
        const v = rr === r && cc === c ? p : b[idx(rr, cc)];
        if (v === p) mine++; else if (v) theirs++;
      }
      if (ok && !theirs && mine) total += BASE[mine];
    }
  }
  return total;
}

/** Whole-board evaluation for `side`: own windows minus opponent windows (open lines count extra). */
export function evaluate(b: Int8Array, side: Stone): number {
  let score = 0;
  for (const [dr, dc] of DIRS) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const er = r + 4 * dr, ec = c + 4 * dc;
      if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
      let me = 0, op = 0;
      for (let k = 0; k < 5; k++) { const v = b[idx(r + k * dr, c + k * dc)]; if (v === side) me++; else if (v) op++; }
      if (me && op) continue;
      if (!me && !op) continue;
      const n = me || op;
      let s = BASE[n];
      if (n >= 2) {
        const pr = r - dr, pc = c - dc, nr = er + dr, nc = ec + dc;
        const open1 = pr >= 0 && pr < N && pc >= 0 && pc < N && !b[idx(pr, pc)];
        const open2 = nr >= 0 && nr < N && nc >= 0 && nc < N && !b[idx(nr, nc)];
        if (open1 && open2) s = s * 1.6;
      }
      score += me ? s : -s * 1.05;
    }
  }
  return score;
}

export interface GSearchOptions { maxDepth?: number; timeMs?: number; noise?: number; rand?: () => number }
export interface GSearchResult { move: number; score: number; depth: number; nodes: number }

export function aiMove(board: Int8Array, side: Stone, opts: GSearchOptions = {}): GSearchResult {
  const rand = opts.rand ?? Math.random;
  const b = new Int8Array(board);
  let stones = 0;
  for (const v of b) if (v) stones++;
  if (!stones) return { move: idx(7, 7), score: 0, depth: 0, nodes: 0 };
  if (stones === 1) {
    const at = b.findIndex(Boolean);
    const r = Math.floor(at / N), c = at % N;
    const choices = [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [1, 0]].map(([dr, dc]) => idx(Math.min(N - 1, Math.max(0, r + dr)), Math.min(N - 1, Math.max(0, c + dc)))).filter((i) => !b[i]);
    return { move: choices[Math.floor(rand() * choices.length)], score: 0, depth: 0, nodes: 0 };
  }
  const maxDepth = opts.maxDepth ?? 4, deadline = Date.now() + (opts.timeMs ?? 900);
  let nodes = 0, stop = false;
  // neighbourhood counts so candidate generation is cheap
  const near = new Int16Array(N * N);
  const bump = (i: number, d: number) => {
    const r = Math.floor(i / N), c = i % N;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N) near[idx(rr, cc)] += d;
    }
  };
  for (let i = 0; i < N * N; i++) if (b[i]) bump(i, 1);

  const candidates = (me: Stone, limit: number): number[] => {
    const list: Array<[number, number]> = [];
    for (let i = 0; i < N * N; i++) {
      if (b[i] || !near[i]) continue;
      const r = Math.floor(i / N), c = i % N;
      const att = cellScore(b, r, c, me), def = cellScore(b, r, c, -me);
      list.push([i, att * 1.1 + def]);
    }
    list.sort((x, y) => y[1] - x[1]);
    return list.slice(0, limit).map((x) => x[0]);
  };

  const place = (i: number, p: Stone) => { b[i] = p; bump(i, 1); };
  const lift = (i: number) => { b[i] = 0; bump(i, -1); };

  const negamax = (me: Stone, depth: number, alpha: number, beta: number, ply: number): number => {
    if ((++nodes & 511) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    if (depth === 0) return evaluate(b, me);
    const cands = candidates(me, ply === 0 ? 14 : depth >= 3 ? 9 : 7);
    if (!cands.length) return 0;
    let best = -Infinity;
    for (const i of cands) {
      place(i, me);
      const win = winLine(b, i);
      const v = win ? 1e7 - ply : -negamax((-me) as Stone, depth - 1, -beta, -alpha, ply + 1);
      lift(i);
      if (stop) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta || v >= 1e7 - 100) break;
    }
    return best;
  };

  // tactics first: win now, or stop the opponent's five
  const all: number[] = [];
  for (let i = 0; i < N * N; i++) if (!b[i] && near[i]) all.push(i);
  for (const i of all) { b[i] = side; const w = winLine(b, i); b[i] = 0; if (w) return { move: i, score: 1e7, depth: 0, nodes: 0 }; }
  for (const i of all) { b[i] = -side as Stone; const w = winLine(b, i); b[i] = 0; if (w) return { move: i, score: 0, depth: 0, nodes: 0 }; }

  const root = candidates(side, 14);
  let best = root[0], bestScore = 0, doneDepth = 0;
  let scoredRoot: Array<[number, number]> = root.map((m) => [m, 0]);
  for (let d = 1; d <= maxDepth; d++) {
    const results: Array<[number, number]> = [];
    let alpha = -Infinity;
    for (const [i] of scoredRoot) {
      place(i, side);
      const win = winLine(b, i);
      const v = win ? 1e7 : -negamax((-side) as Stone, d - 1, -1e9, (opts.noise ?? 0) > 0 ? 1e9 : -alpha, 1);
      lift(i);
      if (stop) break;
      results.push([i, v]);
      if ((opts.noise ?? 0) <= 0 && v > alpha) alpha = v;
    }
    if (stop || results.length < scoredRoot.length) break;
    results.sort((x, y) => y[1] - x[1]);
    scoredRoot = results; best = results[0][0]; bestScore = results[0][1]; doneDepth = d;
    if (bestScore >= 1e7 - 100) break;
    if (Date.now() > deadline - (opts.timeMs ?? 900) * 0.5) break;
  }
  if ((opts.noise ?? 0) > 0 && scoredRoot.length > 1 && bestScore < 1e7 - 100) {
    const margin = Math.max(30, Math.abs(bestScore) * 0.25 * (opts.noise ?? 0) + 60 * (opts.noise ?? 0));
    const pool = scoredRoot.filter((x) => x[1] >= bestScore - margin);
    best = pool[Math.floor(rand() * pool.length)][0];
  }
  return { move: best, score: bestScore, depth: doneDepth, nodes };
}

export const LEVELS = [
  { id: 'easy', label: 'Casual', depth: 1, timeMs: 200, noise: 1.5 },
  { id: 'medium', label: 'Sharp', depth: 2, timeMs: 500, noise: 0 },
  { id: 'hard', label: 'Ruthless', depth: 4, timeMs: 1200, noise: 0 },
  { id: 'max', label: 'Grandmaster', depth: 8, timeMs: 2500, noise: 0 },
] as const;
export type GLevel = (typeof LEVELS)[number]['id'];
