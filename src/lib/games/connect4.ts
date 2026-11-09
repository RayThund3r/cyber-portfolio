// src/lib/games/connect4.ts — Connect Four with an alpha-beta AI. Board: Int8Array(42), index = row*7+col,
// row 0 = top. Players: 1 (you, red) and 2 (AI, gold). Pure functions.
export const ROWS = 6, COLS = 7;
export type Cell = 0 | 1 | 2;

export const newBoard = () => new Int8Array(ROWS * COLS);

export function dropRow(b: Int8Array, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (!b[r * COLS + col]) return r;
  return -1;
}
export const validCols = (b: Int8Array) => [3, 2, 4, 1, 5, 0, 6].filter((c) => !b[c]);

/** The winning four cells that include (r,c), or null. */
export function winLine(b: Int8Array, r: number, c: number): number[] | null {
  const p = b[r * COLS + c];
  if (!p) return null;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [r * COLS + c];
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr * COLS + cc] === p) { line.push(rr * COLS + cc); rr += dr * s; cc += dc * s; }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

export function findWin(b: Int8Array): number[] | null {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const l = b[r * COLS + c] ? winLine(b, r, c) : null; if (l) return l; }
  return null;
}
export const isFull = (b: Int8Array) => validCols(b).length === 0;

// ---------------------------------------------------------------------------------------------------------
// Engine. Internally a padded column-major board g[(col+1)*7+row] (row 0 = bottom, row 6 = permanent empty
// sentinel) so line scans never need bounds checks. Negamax + alpha-beta, Zobrist-keyed transposition table
// (typed arrays, lazily allocated, persists between calls), iterative deepening with a time budget,
// immediate-win / forced-block detection, "never play under an opponent's winning cell" pruning,
// threat-aware move ordering and a threat/parity-aware evaluation.
// ---------------------------------------------------------------------------------------------------------
const WIN = 100000;
const INF = 1 << 28;
const STRIDE = 7;
const DIR = [1, 7, 6, 8]; // vertical, horizontal, anti-diagonal, diagonal (in padded column-major space)
const CENTRE_ORDER = [3, 2, 4, 1, 5, 0, 6];
const CENTRE_W = [0, 2, 4, 6, 4, 2, 0];

// All 69 four-cell windows, in padded indices.
const WINDOWS: Int16Array = (() => {
  const out: number[] = [];
  const cell = (c: number, r: number) => (c + 1) * STRIDE + r;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const ec = c + 3 * dc, er = r + 3 * dr;
      if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
      for (let k = 0; k < 4; k++) out.push(cell(c + k * dc, r + k * dr));
    }
  }
  return Int16Array.from(out);
})();
const NWIN = WINDOWS.length / 4;
// windows through each cell (for move ordering)
const CELL_WINS: Int16Array[] = (() => {
  const l: number[][] = Array.from({ length: 63 }, () => []);
  for (let w = 0; w < NWIN; w++) for (let k = 0; k < 4; k++) l[WINDOWS[w * 4 + k]].push(w);
  return l.map((a) => Int16Array.from(a));
})();

// Zobrist keys (two independent 32-bit halves), deterministic.
const ZA = new Int32Array(2 * 63), ZB = new Int32Array(2 * 63);
{
  let s = 0x9e3779b9 | 0;
  const nx = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) | 0; }; // mulberry32: non-linear, so XOR-combinations of keys never collapse (xorshift is GF(2)-linear and made hash collisions inevitable)
  for (let i = 0; i < ZA.length; i++) { ZA[i] = nx(); ZB[i] = nx(); }
}

// Transposition table (lazy). key check = second hash half.
const TT_BITS = 20, TT_MASK = (1 << TT_BITS) - 1;
let ttKey: Int32Array | null = null, ttVal: Int32Array, ttDepth: Int8Array, ttFlag: Uint8Array, ttMove: Int8Array, ttGen: Uint8Array;
let generation = 0;
function ttInit() {
  if (ttKey) return;
  ttKey = new Int32Array(1 << TT_BITS); ttVal = new Int32Array(1 << TT_BITS); ttDepth = new Int8Array(1 << TT_BITS);
  ttFlag = new Uint8Array(1 << TT_BITS); ttMove = new Int8Array(1 << TT_BITS); ttGen = new Uint8Array(1 << TT_BITS);
}

class Engine {
  g = new Int8Array(63);
  h = new Int8Array(COLS);
  n = 0;
  hA = 0; hB = 0;
  nodes = 0;
  stop = false;
  deadline = Infinity;
  // scratch per ply
  ordCols = new Int8Array(64 * 8);
  ordSc = new Int32Array(64 * 8);

  load(board: Int8Array) {
    this.g.fill(0); this.h.fill(0); this.n = 0; this.hA = 0; this.hB = 0;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const v = board[(ROWS - 1 - r) * COLS + c];
      if (v) { this.g[(c + 1) * STRIDE + r] = v; this.h[c] = r + 1; this.n++; const k = (v - 1) * 63 + (c + 1) * STRIDE + r; this.hA ^= ZA[k]; this.hB ^= ZB[k]; }
    }
  }
  /** Would player p complete four by occupying padded cell i (cell itself may still be empty)? */
  wins(i: number, p: number): boolean {
    const g = this.g;
    for (let k = 0; k < 4; k++) {
      const d = DIR[k];
      let cnt = 1, j = i + d;
      while (g[j] === p) { cnt++; j += d; }
      j = i - d;
      while (g[j] === p) { cnt++; j -= d; }
      if (cnt >= 4) return true;
    }
    return false;
  }
  put(c: number, p: number) {
    const i = (c + 1) * STRIDE + this.h[c];
    this.g[i] = p; this.h[c]++; this.n++;
    const k = (p - 1) * 63 + i; this.hA ^= ZA[k]; this.hB ^= ZB[k];
  }
  take(c: number, p: number) {
    this.h[c]--; this.n--;
    const i = (c + 1) * STRIDE + this.h[c];
    this.g[i] = 0;
    const k = (p - 1) * 63 + i; this.hA ^= ZA[k]; this.hB ^= ZB[k];
  }
  /** number of 3-of-p + 1 empty windows through cell i (after p occupies it) */
  threatsAt(i: number, p: number): number {
    const g = this.g, ws = CELL_WINS[i];
    let t = 0;
    for (let a = 0; a < ws.length; a++) {
      const b = ws[a] * 4;
      let m = 0, e = 0;
      for (let k = 0; k < 4; k++) { const v = g[WINDOWS[b + k]]; if (v === p) m++; else if (v === 0) e++; }
      if (m === 2 && e === 2) t += 1; // current cell counts as empty here: i is still empty during ordering, so 2 + this = 3
    }
    return t;
  }

  /** Static evaluation from the viewpoint of `p` (side to move). */
  evaluate(p: number): number {
    const g = this.g, o = 3 - p;
    const firstIsP = (this.n & 1) === 0; // side to move at an even move count is the first player
    let s = 0;
    for (let w = 0; w < NWIN; w++) {
      const b = w * 4;
      let m = 0, q = 0, e = -1;
      for (let k = 0; k < 4; k++) { const i = WINDOWS[b + k], v = g[i]; if (v === p) m++; else if (v === o) q++; else e = i; }
      if (m && q) continue;
      if (m) {
        if (m === 3) { s += this.threatValue(e, firstIsP); }
        else if (m === 2) s += 4;
        else s += 1;
      } else if (q) {
        if (q === 3) { s -= this.threatValue(e, !firstIsP); }
        else if (q === 2) s -= 4;
        else s -= 1;
      }
    }
    for (let c = 1; c < 6; c++) {
      const w = c === 3 ? 4 : c === 2 || c === 4 ? 2 : 1;
      for (let r = 0; r < this.h[c]; r++) { const v = g[(c + 1) * STRIDE + r]; s += v === p ? w : -w; }
    }
    return s;
  }
  /** Value of a three-with-one-gap whose gap is padded cell e, owned by the first (true) or second player. */
  threatValue(e: number, ownerIsFirst: boolean): number {
    const row1 = (e % STRIDE) + 1; // 1-based row from the bottom
    const odd = (row1 & 1) === 1;
    if (ownerIsFirst) return odd ? 70 : 14; // first player wants odd-row threats
    return odd ? 14 : 55;                    // second player wants even-row threats
  }

  search(p: number, ply: number, d: number, alpha: number, beta: number): number {
    if ((++this.nodes & 1023) === 0 && performance.now() > this.deadline) this.stop = true;
    if (this.stop) return 0;
    const o = 3 - p, h = this.h;
    // immediate win / opponent threats
    let nOppWin = 0, forced = -1, nCand = 0;
    const base = ply * 8, oc = this.ordCols, os = this.ordSc;
    for (let c = 0; c < COLS; c++) {
      if (h[c] >= ROWS) continue;
      const i = (c + 1) * STRIDE + h[c];
      if (this.wins(i, p)) return WIN - ply - 1;
    }
    if (this.n >= 42) return 0;
    for (let c = 0; c < COLS; c++) {
      if (h[c] >= ROWS) continue;
      if (this.wins((c + 1) * STRIDE + h[c], o)) { nOppWin++; forced = c; }
    }
    if (nOppWin >= 2) return -(WIN - ply - 2);
    if (d <= 0) return this.evaluate(p);
    const maxD = 42 - this.n; if (d > maxD) d = maxD;
    // TT probe
    const idx = this.hA & TT_MASK, chk = this.hB;
    let ttm = -1;
    const alpha0 = alpha;
    if (ttKey![idx] === chk && ttGen[idx] !== 0) {
      ttm = ttMove[idx];
      if (ttDepth[idx] >= d) {
        let v = ttVal[idx];
        if (v > WIN - 1000) v -= ply; else if (v < -WIN + 1000) v += ply;
        const f = ttFlag[idx];
        if (f === 1) return v;
        if (f === 2 && v > alpha) alpha = v;
        else if (f === 3 && v < beta) beta = v;
        if (alpha >= beta) return v;
      }
    }
    // candidate moves
    if (nOppWin === 1) { oc[base] = forced; os[base] = 0; nCand = 1; }
    else {
      for (let c = 0; c < COLS; c++) {
        if (h[c] >= ROWS) continue;
        const i = (c + 1) * STRIDE + h[c];
        if (h[c] < ROWS - 1 && this.wins(i + 1, o)) continue; // would hand the opponent a winning cell
        const sc = CENTRE_W[c] * 4 + this.threatsAt(i, p) * 24 + (c === ttm ? 1000 : 0);
        // insertion sort, descending
        let j = nCand++;
        while (j > 0 && os[base + j - 1] < sc) { os[base + j] = os[base + j - 1]; oc[base + j] = oc[base + j - 1]; j--; }
        os[base + j] = sc; oc[base + j] = c;
      }
      if (nCand === 0) return -(WIN - ply - 2);
    }
    let best = -INF, bestC = oc[base];
    const nd = nCand === 1 ? d : d - 1; // single forced reply: extend
    for (let k = 0; k < nCand; k++) {
      const c = oc[base + k];
      this.put(c, p);
      const v = -this.search(o, ply + 1, nd, -beta, -alpha);
      this.take(c, p);
      if (this.stop) return 0;
      if (v > best) { best = v; bestC = c; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    // store
    let sv = best;
    if (sv > WIN - 1000) sv += ply; else if (sv < -WIN + 1000) sv -= ply;
    if (ttKey![idx] !== chk || ttGen[idx] !== generation || ttDepth[idx] <= d) {
      ttKey![idx] = chk; ttVal[idx] = sv; ttDepth[idx] = d; ttMove[idx] = bestC; ttGen[idx] = generation;
      ttFlag[idx] = best <= alpha0 ? 3 : best >= beta ? 2 : 1;
    }
    return best;
  }
}

const engine = new Engine();

export interface C4Result { col: number; score: number; scores: number[]; depth: number; reached?: number; nodes?: number; ms?: number }
export interface C4Opts { rand?: () => number; noise?: number; timeMs?: number; full?: boolean }

/** Negamax / iterative deepening. Returns the best column for `me` (`me` is the side to move). */
export function bestColumn(board: Int8Array, me: number, depth: number, opts: C4Opts = {}): C4Result {
  const t0 = performance.now();
  const rand = opts.rand ?? Math.random;
  const E = engine;
  ttInit();
  generation = (generation % 253) + 1;
  E.load(board);
  E.nodes = 0; E.stop = false;
  const timeMs = opts.timeMs ?? (depth >= 14 ? 2500 : Infinity);
  E.deadline = t0 + timeMs;
  const cols = CENTRE_ORDER.filter((c) => E.h[c] < ROWS);
  const scores = Array<number>(COLS).fill(-Infinity);
  if (!cols.length) return { col: -1, score: 0, scores, depth };
  if (E.n === 0) { scores[3] = 0; return { col: 3, score: 0, scores, depth, reached: 0, nodes: 0, ms: 0 }; }
  const o = 3 - me;
  // a forced block (single reply) needs no long think
  { let f = 0; for (const c of cols) if (E.wins((c + 1) * STRIDE + E.h[c], o)) f++; if (f && !cols.some((c) => E.wins((c + 1) * STRIDE + E.h[c], me))) E.deadline = Math.min(E.deadline, t0 + 120); }
  const full = !!(opts.full || opts.noise);
  const maxD = Math.max(1, Math.min(depth, 42 - E.n));
  let order = cols.slice();
  let bestCol = order[0], bestScore = -INF, reached = 0;
  for (let d = 1; d <= maxD; d++) {
    const cur = Array<number>(COLS).fill(-Infinity);
    let alpha = -INF, itBest = -1, itScore = -INF;
    for (const c of order) {
      const i = (c + 1) * STRIDE + E.h[c];
      let v: number;
      if (E.wins(i, me)) v = WIN - 1;
      else {
        E.put(c, me);
        v = -E.search(o, 1, d - 1, -INF, full ? INF : -alpha);
        E.take(c, me);
        if (E.stop) break;
      }
      cur[c] = v;
      if (v > itScore) { itScore = v; itBest = c; }
      if (!full && v > alpha) alpha = v;
    }
    if (E.stop) break;
    for (let c = 0; c < COLS; c++) scores[c] = cur[c];
    bestCol = itBest; bestScore = itScore; reached = d;
    order = order.slice().sort((a, b) => (a === bestCol ? -1 : b === bestCol ? 1 : cur[b] - cur[a]));
    if (itScore > WIN - 1000 || itScore < -WIN + 1000) break; // proven result
    if (performance.now() > E.deadline) break;
  }
  let col = bestCol;
  if (opts.noise && bestScore < WIN - 1000) {
    const pool = cols.filter((c) => scores[c] >= bestScore - opts.noise! * 40 && scores[c] > -WIN + 1000);
    if (pool.length) col = pool[Math.floor(rand() * pool.length)];
  }
  return { col, score: bestScore, scores, depth, reached, nodes: E.nodes, ms: performance.now() - t0 };
}

export const LEVELS = [
  { id: 'easy', label: 'Casual', depth: 2, noise: 2.5, timeMs: 150 },
  { id: 'medium', label: 'Sharp', depth: 5, noise: 0.5, timeMs: 400 },
  { id: 'hard', label: 'Ruthless', depth: 10, noise: 0, timeMs: 900 },
  { id: 'max', label: 'Perfectionist', depth: 42, noise: 0, timeMs: 1900 },
] as const;
