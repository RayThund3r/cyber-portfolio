// src/lib/games/sliding.ts — Sliding-tile puzzle (8-puzzle / 15-puzzle) with an IDA* solver
// (Manhattan distance + linear conflict) that gives optimal solutions on typical boards.
export type Tiles = Uint8Array; // 0 = blank, row-major

export const goal = (n: number): Tiles => { const t = new Uint8Array(n * n); for (let i = 0; i < n * n - 1; i++) t[i] = i + 1; return t; };
export const isSolved = (t: Tiles) => { for (let i = 0; i < t.length - 1; i++) if (t[i] !== i + 1) return false; return t[t.length - 1] === 0; };

export function solvable(t: Tiles, n: number): boolean {
  let inv = 0;
  const a = Array.from(t).filter((v) => v);
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) inv++;
  if (n % 2 === 1) return inv % 2 === 0;
  const blankRowFromBottom = n - Math.floor(t.indexOf(0) / n);
  return (inv + blankRowFromBottom) % 2 === 1;
}

export function slide(t: Tiles, n: number, tile: number): Tiles | null {
  const b = t.indexOf(0), i = t.indexOf(tile);
  if (i < 0) return null;
  const d = Math.abs(i - b);
  if (!(d === n || (d === 1 && ((i / n) | 0) === ((b / n) | 0)))) return null;
  const o = new Uint8Array(t); o[b] = tile; o[i] = 0; return o;
}

export function shuffle(n: number, rand: () => number = Math.random, walk = 0): Tiles {
  if (walk > 0) { // random walk: bounded difficulty (used for 4×4 so hints stay instant)
    let t = goal(n), prev = -1;
    for (let k = 0; k < walk; k++) {
      const b = t.indexOf(0), r = (b / n) | 0, c = b % n, opts: number[] = [];
      if (r > 0) opts.push(b - n); if (r < n - 1) opts.push(b + n); if (c > 0) opts.push(b - 1); if (c < n - 1) opts.push(b + 1);
      const ch = opts.filter((x) => x !== prev); const pick = ch[Math.floor(rand() * ch.length)];
      prev = b; t = slide(t, n, t[pick])!;
    }
    return isSolved(t) ? shuffle(n, rand, walk) : t;
  }
  for (;;) {
    const t = goal(n);
    for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    if (solvable(t, n) && !isSolved(t)) return t;
  }
}

function heuristic(t: Tiles, n: number): number {
  let h = 0;
  for (let i = 0; i < t.length; i++) {
    const v = t[i]; if (!v) continue;
    h += Math.abs(((i / n) | 0) - (((v - 1) / n) | 0)) + Math.abs((i % n) - ((v - 1) % n));
  }
  // linear conflicts
  for (let r = 0; r < n; r++) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const x = t[r * n + a], y = t[r * n + b];
    if (x && y && ((x - 1) / n | 0) === r && ((y - 1) / n | 0) === r && x > y) h += 2;
  }
  for (let c = 0; c < n; c++) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const x = t[a * n + c], y = t[b * n + c];
    if (x && y && (x - 1) % n === c && (y - 1) % n === c && x > y) h += 2;
  }
  return h;
}

/** Optimal (or, if the budget runs out, best-effort) list of tile numbers to slide, in order. */
export function solve(start: Tiles, n: number, timeMs = 1500): { moves: number[]; optimal: boolean } | null {
  if (!solvable(start, n)) return null;
  const t0 = Date.now();
  const t = new Uint8Array(start); let blank = t.indexOf(0);
  const path: number[] = [];
  let timedOut = false, nodes = 0, w = 1, deadline = t0 + timeMs;
  const dfs = (g: number, bound: number, prevBlank: number): number => {
    const h = heuristic(t, n), f = g + w * h;
    if (f > bound) return f;
    if (h === 0) return -1;
    if ((++nodes & 4095) === 0 && Date.now() > deadline) { timedOut = true; return Infinity; }
    let min = Infinity;
    const r = (blank / n) | 0, c = blank % n;
    const cand: number[] = [];
    if (r > 0) cand.push(blank - n); if (r < n - 1) cand.push(blank + n); if (c > 0) cand.push(blank - 1); if (c < n - 1) cand.push(blank + 1);
    for (const nb of cand) {
      if (nb === prevBlank) continue;
      const tile = t[nb]; t[blank] = tile; t[nb] = 0; const old = blank; blank = nb; path.push(tile);
      const v = dfs(g + 1, bound, old);
      if (v === -1) return -1;
      path.pop(); blank = old; t[nb] = tile; t[blank] = 0;
      if (timedOut) return Infinity;
      if (v < min) min = v;
    }
    return min;
  };
  let bound = heuristic(t, n);
  while (bound < 80) {
    const v = dfs(0, bound, -1);
    if (v === -1) return { moves: path.slice(), optimal: true };
    if (timedOut || v === Infinity) break;
    bound = v;
  }
  // Second chance: weighted IDA* (heuristic x3) finds a valid, slightly longer solution in milliseconds
  // where the optimal search ran out of time. Only if even that fails do we use the greedy descent.
  t.set(start); blank = t.indexOf(0); path.length = 0; timedOut = false; w = 3; deadline = Date.now() + Math.max(1500, timeMs);
  for (bound = w * heuristic(t, n); bound < 600; ) {
    const v = dfs(0, bound, -1);
    if (v === -1) return { moves: path.slice(), optimal: false };
    if (timedOut || v === Infinity) break;
    bound = v;
  }
  // Fallback: greedy descent on the heuristic (never worse than telling the player nothing).
  let cur: Tiles = new Uint8Array(start); const moves: number[] = []; const seen = new Set<string>([cur.join()]);
  for (let k = 0; k < 400 && !isSolved(cur); k++) {
    const b = cur.indexOf(0), r = (b / n) | 0, c = b % n; let bestT = -1, bestH = Infinity, bestS: Tiles | null = null;
    const cand: number[] = []; if (r > 0) cand.push(b - n); if (r < n - 1) cand.push(b + n); if (c > 0) cand.push(b - 1); if (c < n - 1) cand.push(b + 1);
    for (const nb of cand) { const s = slide(cur, n, cur[nb])!; if (seen.has(s.join())) continue; const h = heuristic(s, n); if (h < bestH) { bestH = h; bestT = cur[nb]; bestS = s; } }
    if (!bestS) break;
    moves.push(bestT); cur = bestS; seen.add(cur.join());
  }
  return { moves, optimal: false };
}
export const SIZES = [{ id: '3', label: '3×3 (8)', n: 3, walk: 0 }, { id: '4', label: '4×4 (15)', n: 4, walk: 70 }] as const;
