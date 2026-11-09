// src/lib/games/reversi.ts — Reversi / Othello. AI: padded-mailbox negamax + alpha-beta, Zobrist transposition
// table, iterative deepening under a time budget, mobility-based move ordering, evaluation (positional weights,
// mobility, potential mobility, frontier, corners/edge stability, parity) and an exact endgame solver. Board Int8Array(64): 1 = black (you), -1 = white (AI), 0 empty.
export const SIZE = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export function newBoard(): Int8Array {
  const b = new Int8Array(64);
  b[27] = -1; b[36] = -1; b[28] = 1; b[35] = 1;
  return b;
}

export function flipsFor(b: Int8Array, idx: number, player: number): number[] {
  if (b[idx]) return [];
  const r0 = idx >> 3, c0 = idx & 7, out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const run: number[] = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === -player) { run.push(r * 8 + c); r += dr; c += dc; }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === player) out.push(...run);
  }
  return out;
}

export function legalMoves(b: Int8Array, player: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) if (!b[i] && flipsFor(b, i, player).length) out.push(i);
  return out;
}

export function apply(b: Int8Array, idx: number, player: number): { board: Int8Array; flipped: number[] } {
  const n = new Int8Array(b);
  const f = flipsFor(b, idx, player);
  n[idx] = player;
  for (const i of f) n[i] = player;
  return { board: n, flipped: f };
}

export const count = (b: Int8Array) => { let black = 0, white = 0; for (const v of b) { if (v === 1) black++; else if (v === -1) white++; } return { black, white }; };
export const gameOver = (b: Int8Array) => !legalMoves(b, 1).length && !legalMoves(b, -1).length;

// ---------------------------------------------------------------------------------------------------------
// Engine. Internal board: 10x10 padded mailbox (border = 2), empties kept in a linked list so make/unmake are
// cheap. Scores are "centi-discs": a finished game scores 100 * disc differential (exact), heuristic values stay
// inside +-5500 so they never masquerade as a proven result.
// ---------------------------------------------------------------------------------------------------------
const W = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];
const PD = [-11, -10, -9, -1, 1, 9, 10, 11];
const SQ = new Int8Array(64), P2S = new Int8Array(100).fill(-1);
for (let k = 0; k < 64; k++) { SQ[k] = ((k >> 3) + 1) * 10 + (k & 7) + 1; P2S[SQ[k]] = k; }
const CORNERS = [11, 18, 81, 88];
// corner-adjacent squares (X and C squares): their penalty only applies while the corner is empty
const ADJ = new Int8Array(64);
for (const corner of CORNERS) for (const d of PD) { const a = corner + d; const k = a >= 0 && a < 100 ? P2S[a] : -1; if (k >= 0) ADJ[k] = corner; }
for (const k of [0, 7, 56, 63]) ADJ[k] = 0;
// edge directions out of each corner
const EDGE_DIRS: number[][] = [[1, 10], [-1, 10], [1, -10], [-1, -10]];
const SIDE_A = 0x5bd1e995 | 0, SIDE_B = 0x1b873593 | 0;
const ZA = new Int32Array(200), ZB = new Int32Array(200);
{ let s = 0x2545f491 | 0; const nx = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) | 0; }; // mulberry32: non-linear, so XOR-combinations of keys never collapse (xorshift is GF(2)-linear and made hash collisions inevitable)
  for (let i = 0; i < 200; i++) { ZA[i] = nx(); ZB[i] = nx(); } }
const TT_BITS = 19, TT_MASK = (1 << TT_BITS) - 1;
let tKey: Int32Array | null = null, tVal: Int16Array, tDepth: Int8Array, tFlag: Uint8Array, tMove: Int8Array;
const EXACT_D = 64, MAXPLY = 140, STR = 40;
const BIG = 30000;

class Engine {
  b = new Int8Array(100);
  nxt = new Int8Array(101); prv = new Int8Array(101);
  cnt = new Int32Array(3); // index colour + 1
  hA = 0; hB = 0;
  nodes = 0; stop = false; deadline = Infinity;
  mv = new Int8Array(MAXPLY * STR); ms = new Int32Array(MAXPLY * STR);
  fl = new Int8Array(8192); fsp = 0;

  load(board: Int8Array) {
    const b = this.b; b.fill(2);
    this.cnt.fill(0); this.hA = 0; this.hB = 0; this.fsp = 0;
    const order: number[] = [];
    for (let k = 0; k < 64; k++) {
      const i = SQ[k], v = board[k]; b[i] = v;
      if (v) { this.cnt[v + 1]++; const z = i * 2 + (v === 1 ? 0 : 1); this.hA ^= ZA[z]; this.hB ^= ZB[z]; } else order.push(k);
    }
    order.sort((x, y) => W[y] - W[x] || x - y);
    let last = 0;
    for (const k of order) { const i = SQ[k]; this.nxt[last] = i; this.prv[i] = last; last = i; }
    this.nxt[last] = 0; this.prv[0] = last;
  }
  get empties() { return 64 - this.cnt[0] - this.cnt[2]; }
  legal(i: number, p: number): boolean {
    const b = this.b;
    for (let x = 0; x < 8; x++) {
      const d = PD[x]; let j = i + d;
      if (b[j] !== -p) continue;
      do j += d; while (b[j] === -p);
      if (b[j] === p) return true;
    }
    return false;
  }
  gen(p: number, ply: number): number {
    const base = ply * STR, mv = this.mv, nxt = this.nxt; let n = 0;
    for (let e = nxt[0]; e; e = nxt[e]) if (this.legal(e, p)) mv[base + n++] = e;
    return n;
  }
  countMoves(p: number): number { let n = 0; const nxt = this.nxt; for (let e = nxt[0]; e; e = nxt[e]) if (this.legal(e, p)) n++; return n; }
  hasMove(p: number): boolean { const nxt = this.nxt; for (let e = nxt[0]; e; e = nxt[e]) if (this.legal(e, p)) return true; return false; }
  make(p: number, i: number): number {
    const b = this.b, fl = this.fl; let n = 0;
    b[i] = p;
    this.nxt[this.prv[i]] = this.nxt[i]; this.prv[this.nxt[i]] = this.prv[i];
    for (let x = 0; x < 8; x++) {
      const d = PD[x]; let k = i + d;
      if (b[k] !== -p) continue;
      do k += d; while (b[k] === -p);
      if (b[k] !== p) continue;
      for (let m = i + d; m !== k; m += d) { b[m] = p; fl[this.fsp++] = m; n++; this.hA ^= ZA[m * 2] ^ ZA[m * 2 + 1]; this.hB ^= ZB[m * 2] ^ ZB[m * 2 + 1]; }
    }
    const z = i * 2 + (p === 1 ? 0 : 1); this.hA ^= ZA[z]; this.hB ^= ZB[z];
    this.cnt[p + 1] += n + 1; this.cnt[1 - p] -= n;
    return n;
  }
  unmake(p: number, i: number, n: number) {
    const b = this.b, fl = this.fl;
    for (let t = 0; t < n; t++) { const m = fl[--this.fsp]; b[m] = -p; this.hA ^= ZA[m * 2] ^ ZA[m * 2 + 1]; this.hB ^= ZB[m * 2] ^ ZB[m * 2 + 1]; }
    const z = i * 2 + (p === 1 ? 0 : 1); this.hA ^= ZA[z]; this.hB ^= ZB[z];
    b[i] = 0;
    this.nxt[this.prv[i]] = i; this.prv[this.nxt[i]] = i;
    this.cnt[p + 1] -= n + 1; this.cnt[1 - p] += n;
  }

  /** Heuristic value from p's point of view (p to move). */
  evaluate(p: number): number {
    const b = this.b, o = -p, nxt = this.nxt;
    let pos = 0, fr = 0, potMe = 0, potOpp = 0;
    for (let k = 0; k < 64; k++) {
      const i = SQ[k], v = b[i]; if (!v) continue;
      const s = v === p ? 1 : -1; let w = W[k];
      const a = ADJ[k]; if (a && b[a]) w = 2;
      pos += s * w;
      for (let x = 0; x < 8; x++) if (b[i + PD[x]] === 0) { fr += s; break; }
    }
    for (let e = nxt[0]; e; e = nxt[e]) {
      let am = false, ao = false;
      for (let x = 0; x < 8; x++) { const v = b[e + PD[x]]; if (v === p) am = true; else if (v === o) ao = true; }
      if (ao) potMe++;
      if (am) potOpp++;
    }
    let cm = 0, co = 0, stab = 0;
    for (let c = 0; c < 4; c++) {
      const cv = b[CORNERS[c]]; if (!cv) continue;
      const s = cv === p ? 1 : -1; if (s > 0) cm++; else co++;
      for (const d of EDGE_DIRS[c]) { let j = CORNERS[c] + d; while (b[j] === cv) { stab += s; j += d; } }
    }
    const mm = this.countMoves(p), om = this.countMoves(o);
    const e = this.empties;
    const mob = mm + om ? (100 * (mm - om)) / (mm + om) : 0;
    const diff = this.cnt[p + 1] - this.cnt[1 - p];
    let s = pos * (e > 24 ? 1 : 0.6);
    s += mob * (e > 10 ? 3.5 : 2);
    s += (potMe - potOpp) * (e > 20 ? 4 : 2);
    s -= fr * (e > 12 ? 7 : 3);
    s += 150 * (cm - co) + 30 * stab;
    if (e <= 28) s += e & 1 ? 18 : -18;
    s += diff * (e <= 12 ? 10 : e <= 24 ? 3 : 0.3);
    return s > 5500 ? 5500 : s < -5500 ? -5500 : s;
  }

  /** Order moves in mv[base..base+n): TT move, then fewest opponent replies (when worth it), then list order. */
  order(p: number, ply: number, n: number, ttm: number, deep: boolean) {
    const base = ply * STR, mv = this.mv, sc = this.ms;
    for (let k = 0; k < n; k++) {
      const m = mv[base + k]; let s = -k;
      if (m === ttm) s += 100000;
      else if (deep) {
        const f = this.make(p, m);
        s -= this.countMoves(-p) * 40;
        if (CORNERS.indexOf(m) >= 0) s += 400;
        this.unmake(p, m, f);
      }
      sc[base + k] = s;
    }
    for (let a = 1; a < n; a++) {
      const m = mv[base + a], s = sc[base + a]; let j = a - 1;
      while (j >= 0 && sc[base + j] < s) { mv[base + j + 1] = mv[base + j]; sc[base + j + 1] = sc[base + j]; j--; }
      mv[base + j + 1] = m; sc[base + j + 1] = s;
    }
  }

  search(p: number, d: number, alpha: number, beta: number, ply: number, exact: boolean): number {
    if ((++this.nodes & 511) === 0 && performance.now() > this.deadline) this.stop = true;
    if (this.stop) return 0;
    const n = this.gen(p, ply);
    if (n === 0) {
      if (!this.hasMove(-p)) return (this.cnt[p + 1] - this.cnt[1 - p]) * 100;
      return -this.search(-p, d, -beta, -alpha, ply + 1, exact);
    }
    if (!exact && d <= 0) return this.evaluate(p);
    const emp = this.empties;
    const useTT = !exact || emp >= 7;
    const need = exact ? EXACT_D : d;
    let idx = 0, chk = 0, ttm = -1;
    if (useTT) {
      idx = (this.hA ^ (p === 1 ? 0 : SIDE_A)) & TT_MASK; chk = this.hB ^ (p === 1 ? 0 : SIDE_B);
      if (tKey![idx] === chk && tFlag[idx] !== 0) {
        ttm = tMove[idx];
        if (tDepth[idx] >= need) {
          const v = tVal[idx], f = tFlag[idx];
          if (f === 1) return v;
          if (f === 2 && v > alpha) alpha = v; else if (f === 3 && v < beta) beta = v;
          if (alpha >= beta) return v;
        }
      }
    }
    const alphaIn = alpha; // after any narrowing from the table: the bound flag must be judged against the window actually searched
    if (n > 1) this.order(p, ply, n, ttm, exact ? emp >= 8 : d >= 3);
    const base = ply * STR, mv = this.mv;
    let best = -BIG, bm = mv[base];
    for (let k = 0; k < n; k++) {
      const m = mv[base + k];
      const f = this.make(p, m);
      const v = -this.search(-p, d - 1, -beta, -alpha, ply + 1, exact);
      this.unmake(p, m, f);
      if (this.stop) return 0;
      if (v > best) { best = v; bm = m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    if (useTT) {
      tKey![idx] = chk; tVal[idx] = best; tDepth[idx] = need; tMove[idx] = bm;
      tFlag[idx] = best <= alphaIn ? 3 : best >= beta ? 2 : 1;
    }
    return best;
  }
}
const engine = new Engine();
function ttInit() {
  if (tKey) return;
  const n = 1 << TT_BITS;
  tKey = new Int32Array(n); tVal = new Int16Array(n); tDepth = new Int8Array(n); tFlag = new Uint8Array(n); tMove = new Int8Array(n);
}

export interface RvResult { move: number | null; score: number; scores: Map<number, number>; depth?: number; exact?: boolean; nodes?: number; ms?: number }
export interface RvOpts { rand?: () => number; noise?: number; timeMs?: number; solve?: number }

/**
 * Pick a move for `me`. `depth` is the maximum search depth (iterative deepening up to it, within `timeMs`).
 * With few empties left (default: depends on depth; override with opts.solve) the game is solved exactly,
 * win/draw/loss first and then the perfect disc differential, as far as the time budget allows.
 */
export function bestMove(board: Int8Array, me: number, depth: number, opts: RvOpts = {}): RvResult {
  const t0 = performance.now();
  const rand = opts.rand ?? Math.random;
  const moves = legalMoves(board, me);
  const scores = new Map<number, number>();
  if (!moves.length) return { move: null, score: 0, scores };
  if (moves.length === 1 && !opts.noise) { scores.set(moves[0], 0); return { move: moves[0], score: 0, scores, depth: 0, ms: 0 }; }
  ttInit();
  const E = engine; E.load(board); E.nodes = 0; E.stop = false;
  const timeMs = opts.timeMs ?? (depth >= 12 ? 2000 : Infinity);
  const empties = E.empties;
  const noise = opts.noise ?? 0;
  const solveN = opts.solve ?? (depth >= 20 ? 18 : depth >= 8 ? 14 : depth >= 6 ? 10 : depth >= 4 ? 8 : 0);
  const solving = empties <= solveN;
  const full = noise > 0;
  let order = moves.slice().sort((x, y) => W[y] - W[x]);
  const root = (d: number, exact: boolean, a0: number, b0: number): { best: number; bm: number; sc: Map<number, number> } | null => {
    const sc = new Map<number, number>();
    let alpha = a0, best = -BIG, bm = order[0];
    for (const m of order) {
      const i = SQ[m];
      const f = E.make(me, i);
      const v = -E.search(-me, d - 1, full ? -BIG : -b0, full ? BIG : -alpha, 1, exact);
      E.unmake(me, i, f);
      if (E.stop) return null;
      sc.set(m, v);
      if (v > best) { best = v; bm = m; }
      if (!full && v > alpha) alpha = v;
      if (!full && alpha >= b0) break; // window closed (e.g. a proven win in the win/draw/loss pass): never hand children an inverted window
    }
    return { best, bm, sc };
  };
  // 1) iterative deepening (heuristic)
  const idDeadline = solving ? t0 + timeMs * 0.22 : t0 + timeMs;
  E.deadline = idDeadline;
  const maxD = Math.max(1, Math.min(depth, empties, solving ? 7 : 60));
  let move = order[0], score = 0, reached = 0, exactDone = false;
  for (let d = 1; d <= maxD; d++) {
    const r = root(d, false, -BIG, BIG);
    if (!r) break;
    move = r.bm; score = r.best; reached = d;
    for (const [m, v] of r.sc) scores.set(m, v);
    order = order.slice().sort((x, y) => (x === move ? -1 : y === move ? 1 : (r.sc.get(y) ?? 0) - (r.sc.get(x) ?? 0)));
    if (performance.now() > E.deadline) break;
    if (d >= empties) break;
  }
  // 2) exact endgame solve
  if (solving) {
    E.stop = false; E.deadline = t0 + timeMs;
    const wld = full ? null : root(64, true, -1, 1);
    if (wld) {
      if (wld.best <= -1) { /* lost anyway: keep the strongest heuristic try */ }
      else { move = wld.bm; order = [move, ...order.filter((m) => m !== move)]; }
      score = wld.best > 0 ? 100 : wld.best < 0 ? -100 : 0;
    }
    if (wld || full) {
      E.stop = false;
      const ex = root(64, true, -BIG, BIG);
      if (ex) { move = ex.bm; score = ex.best; scores.clear(); for (const [m, v] of ex.sc) scores.set(m, v); exactDone = true; reached = empties; }
    }
  }
  if (noise) {
    const pool = moves.filter((m) => (scores.get(m) ?? -Infinity) >= score - noise * 60);
    if (pool.length) move = pool[Math.floor(rand() * pool.length)];
  }
  return { move, score, scores, depth: reached, exact: exactDone, nodes: E.nodes, ms: performance.now() - t0 };
}

export const LEVELS = [
  { id: 'easy', label: 'Casual', depth: 1, noise: 1.6, timeMs: 150 },
  { id: 'medium', label: 'Sharp', depth: 4, noise: 0.35, timeMs: 400 },
  { id: 'hard', label: 'Ruthless', depth: 12, noise: 0, timeMs: 1000 },
  { id: 'max', label: 'Perfectionist', depth: 60, noise: 0, timeMs: 1900 },
] as const;
