// src/lib/games/g2048.ts — 2048 rules plus a fast expectimax AI (used for hints and auto-play).
// The AI packs the board into four 16-bit rows (4 bits per tile exponent) and uses precomputed
// row tables for moves and for the heuristic (monotonicity, smoothness, empties, merges, corner).
export type Dir = 'left' | 'right' | 'up' | 'down';
export type Board = number[]; // 16 cells, row-major, 0 = empty

export function slideLine(line: number[]): { line: number[]; gain: number } {
  const t = line.filter(Boolean);
  const out: number[] = [];
  let gain = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === t[i + 1]) { out.push(t[i] * 2); gain += t[i] * 2; i++; } else out.push(t[i]);
  }
  while (out.length < 4) out.push(0);
  return { line: out, gain };
}

export function move(b: Board, dir: Dir): { board: Board; gain: number; moved: boolean } {
  const out = b.slice();
  let gain = 0;
  for (let k = 0; k < 4; k++) {
    const idx = [0, 1, 2, 3].map((j) => (dir === 'left' ? k * 4 + j : dir === 'right' ? k * 4 + 3 - j : dir === 'up' ? j * 4 + k : (3 - j) * 4 + k));
    const r = slideLine(idx.map((i) => b[i]));
    gain += r.gain;
    idx.forEach((i, j) => (out[i] = r.line[j]));
  }
  return { board: out, gain, moved: out.some((v, i) => v !== b[i]) };
}

export const emptyCells = (b: Board) => b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
export const canMove = (b: Board) => (['left', 'right', 'up', 'down'] as Dir[]).some((d) => move(b, d).moved);
export const maxTile = (b: Board) => Math.max(...b);

export function spawn(b: Board, rand: () => number = Math.random): Board {
  const e = emptyCells(b);
  if (!e.length) return b;
  const out = b.slice();
  out[e[Math.floor(rand() * e.length)]] = rand() < 0.9 ? 2 : 4;
  return out;
}

export const newBoard = (rand: () => number = Math.random): Board => spawn(spawn(Array(16).fill(0), rand), rand);


// ---------------------------------------------------------------------------------------------
// Fast engine: board = 4 rows, each a 16-bit int with the tile exponent (0 = empty) in 4-bit nibbles,
// column 0 in the lowest nibble.
type Rows = number[];
const DIRS: Dir[] = ['left', 'right', 'up', 'down'];

const MOVE_L = new Uint16Array(65536), MOVE_R = new Uint16Array(65536);
const GAIN_L = new Uint32Array(65536), GAIN_R = new Uint32Array(65536);
const HEUR = new Float64Array(65536);
let tablesReady = false;

const LOST_PENALTY = 200000, MONO_POWER = 4, MONO_WEIGHT = 47, SUM_POWER = 3.5, SUM_WEIGHT = 11, MERGE_WEIGHT = 700, EMPTY_WEIGHT = 270;

function buildTables() {
  if (tablesReady) return;
  for (let row = 0; row < 65536; row++) {
    const line = [row & 15, (row >> 4) & 15, (row >> 8) & 15, (row >> 12) & 15];
    // heuristic
    let sum = 0, empty = 0, merges = 0, prev = 0, counter = 0;
    for (let i = 0; i < 4; i++) {
      const r = line[i];
      sum += Math.pow(r, SUM_POWER);
      if (r === 0) empty++;
      else { if (prev === r) counter++; else if (counter > 0) { merges += 1 + counter; counter = 0; } prev = r; }
    }
    if (counter > 0) merges += 1 + counter;
    let monL = 0, monR = 0;
    for (let i = 1; i < 4; i++) {
      if (line[i - 1] > line[i]) monL += Math.pow(line[i - 1], MONO_POWER) - Math.pow(line[i], MONO_POWER);
      else monR += Math.pow(line[i], MONO_POWER) - Math.pow(line[i - 1], MONO_POWER);
    }
    HEUR[row] = LOST_PENALTY + EMPTY_WEIGHT * empty + MERGE_WEIGHT * merges - MONO_WEIGHT * Math.min(monL, monR) - SUM_WEIGHT * sum;
    // slide left
    const t = line.filter(Boolean), out: number[] = [];
    let gain = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === t[i + 1] && t[i] < 15) { out.push(t[i] + 1); gain += 2 ** (t[i] + 1); i++; } else out.push(t[i]);
    }
    while (out.length < 4) out.push(0);
    const packed = out[0] | (out[1] << 4) | (out[2] << 8) | (out[3] << 12);
    MOVE_L[row] = packed; GAIN_L[row] = gain;
    // slide right = reverse, slide left, reverse (filled lazily below)
  }
  const rev = (r: number) => ((r & 15) << 12) | (((r >> 4) & 15) << 8) | (((r >> 8) & 15) << 4) | ((r >> 12) & 15);
  for (let row = 0; row < 65536; row++) { const rr = rev(row); MOVE_R[row] = rev(MOVE_L[rr]); GAIN_R[row] = GAIN_L[rr]; }
  tablesReady = true;
}

function pack(b: Board): Rows {
  const rows = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const v = b[r * 4 + c];
    rows[r] |= (v ? Math.min(15, Math.round(Math.log2(v))) : 0) << (4 * c);
  }
  return rows;
}

function transpose(r: Rows): Rows {
  const a = r[0], b = r[1], c = r[2], d = r[3];
  const col = (k: number) => { const s = 4 * k; return ((a >> s) & 15) | (((b >> s) & 15) << 4) | (((c >> s) & 15) << 8) | (((d >> s) & 15) << 12); };
  return [col(0), col(1), col(2), col(3)];
}

function moveRows(r: Rows, dir: Dir): { rows: Rows; gain: number; moved: boolean } | null {
  let out: Rows, gain = 0;
  if (dir === 'left') {
    out = [MOVE_L[r[0]], MOVE_L[r[1]], MOVE_L[r[2]], MOVE_L[r[3]]]; gain = GAIN_L[r[0]] + GAIN_L[r[1]] + GAIN_L[r[2]] + GAIN_L[r[3]];
  } else if (dir === 'right') {
    out = [MOVE_R[r[0]], MOVE_R[r[1]], MOVE_R[r[2]], MOVE_R[r[3]]]; gain = GAIN_R[r[0]] + GAIN_R[r[1]] + GAIN_R[r[2]] + GAIN_R[r[3]];
  } else {
    const t = transpose(r);
    const up = dir === 'up';
    const T = up ? MOVE_L : MOVE_R, G = up ? GAIN_L : GAIN_R;
    out = transpose([T[t[0]], T[t[1]], T[t[2]], T[t[3]]]); gain = G[t[0]] + G[t[1]] + G[t[2]] + G[t[3]];
  }
  if (out[0] === r[0] && out[1] === r[1] && out[2] === r[2] && out[3] === r[3]) return null;
  return { rows: out, gain, moved: true };
}

function evalRows(r: Rows): number {
  const t = transpose(r);
  let s = HEUR[r[0]] + HEUR[r[1]] + HEUR[r[2]] + HEUR[r[3]] + HEUR[t[0]] + HEUR[t[1]] + HEUR[t[2]] + HEUR[t[3]];
  // corner / snake: reward keeping the largest tile in a corner
  let mx = 0;
  for (let i = 0; i < 4; i++) for (let k = 0; k < 16; k += 4) { const v = (r[i] >> k) & 15; if (v > mx) mx = v; }
  const cm = Math.max(r[0] & 15, (r[0] >> 12) & 15, r[3] & 15, (r[3] >> 12) & 15);
  if (cm === mx) s += 2000 + mx * 400;
  return s;
}

export interface SearchOptions {
  /** Wall-clock budget in ms for the whole decision (adaptive depth only). Default 40. */
  timeMs?: number;
  /** Random source used to sample chance nodes. Default Math.random. */
  rand?: () => number;
  /** Cap on the deepest depth tried by the adaptive search. Default 6. */
  maxDepth?: number;
}

class Timeout extends Error {}

interface Ctx { cache: Map<number, Map<number, number>>[]; deadline: number; rand: () => number; nodes: number }

function searchMax(r: Rows, depth: number, ctx: Ctx): number {
  let best = 0;
  for (const d of DIRS) {
    const m = moveRows(r, d);
    if (!m) continue;
    const v = searchChance(m.rows, depth, ctx);
    if (v > best) best = v;
  }
  return best; // 0 = dead position (worse than any heuristic value)
}

function searchChance(r: Rows, depth: number, ctx: Ctx): number {
  if (depth <= 0) return evalRows(r);
  if ((++ctx.nodes & 1023) === 0 && ctx.deadline && Date.now() > ctx.deadline) throw new Timeout();
  const k1 = r[0] * 65536 + r[1], k2 = r[2] * 65536 + r[3];
  const layer = ctx.cache[depth] || (ctx.cache[depth] = new Map());
  let inner = layer.get(k1);
  if (inner) { const hit = inner.get(k2); if (hit !== undefined) return hit; } else { inner = new Map(); layer.set(k1, inner); }
  // empty cells
  const cells: number[] = [];
  for (let i = 0; i < 4; i++) for (let c = 0; c < 4; c++) if (((r[i] >> (4 * c)) & 15) === 0) cells.push(i * 4 + c);
  if (!cells.length) { const v = searchMax(r, depth - 1, ctx); inner.set(k2, v); return v; }
  // Sample at most `cap` cells: fewer at deeper (cheaper) levels and when the board is open.
  const cap = depth >= 3 ? 4 : depth === 2 ? 6 : 16;
  let pick = cells;
  if (cells.length > cap) {
    pick = cells.slice();
    for (let i = 0; i < cap; i++) { const j = i + Math.floor(ctx.rand() * (pick.length - i)); const t = pick[i]; pick[i] = pick[j]; pick[j] = t; }
    pick = pick.slice(0, cap);
  }
  let total = 0;
  for (const cell of pick) {
    const ri = cell >> 2, sh = 4 * (cell & 3);
    const nr = r.slice();
    nr[ri] |= 1 << sh;
    const v2 = searchMax(nr, depth - 1, ctx);
    let v4 = v2; // deeper layers: approximate the rare 4-spawn by the 2-spawn value
    if (depth <= 2 || cells.length <= 4) { const n4 = r.slice(); n4[ri] |= 2 << sh; v4 = searchMax(n4, depth - 1, ctx); }
    total += 0.9 * v2 + 0.1 * v4;
  }
  const res = total / pick.length;
  inner.set(k2, res);
  return res;
}

function scoreDirs(b: Board, depth: number, opts: SearchOptions, deadline: number): Record<Dir, number> {
  const rows = pack(b);
  const ctx: Ctx = { cache: [], deadline, rand: opts.rand || Math.random, nodes: 0 };
  const scores = { left: -Infinity, right: -Infinity, up: -Infinity, down: -Infinity } as Record<Dir, number>;
  for (const d of DIRS) {
    const m = moveRows(rows, d);
    if (m) scores[d] = searchChance(m.rows, depth, ctx);
  }
  return scores;
}

/**
 * Expectimax move choice. With `depth` given it searches exactly that many spawn layers (compatible with the
 * old API). Without it the depth adapts to the number of empty cells and a time budget (iterative deepening).
 */
export function bestMove(b: Board, depth?: number, opts: SearchOptions = {}): { dir: Dir | null; scores: Record<Dir, number> } {
  buildTables();
  const pickBest = (scores: Record<Dir, number>) => {
    let dir: Dir | null = null, best = -Infinity;
    for (const d of DIRS) if (scores[d] > best) { best = scores[d]; dir = d; }
    return dir;
  };
  if (depth !== undefined) {
    const scores = scoreDirs(b, Math.max(1, depth), opts, 0);
    return { dir: pickBest(scores), scores };
  }
  const empties = emptyCells(b).length;
  const target = Math.min(opts.maxDepth ?? 6, empties >= 9 ? 2 : empties >= 6 ? 3 : empties >= 3 ? 4 : 5);
  const start = Date.now(), budget = opts.timeMs ?? 40;
  let scores = scoreDirs(b, 1, opts, 0);
  for (let d = 2; d <= target; d++) {
    try { scores = scoreDirs(b, d, opts, start + budget); } catch (e) { if (e instanceof Timeout) break; throw e; }
    if (Date.now() - start > budget * 0.5) break;
  }
  return { dir: pickBest(scores), scores };
}

export interface AutoplayResult { board: Board; score: number; moves: number; max: number; dead: boolean }

/** Plays the AI against random spawns until the board is dead (or `maxMoves`). Handy for tests and demos. */
export function autoplay(
  start: Board = newBoard(),
  opts: SearchOptions & { rand?: () => number; maxMoves?: number; depth?: number; onMove?: (b: Board, dir: Dir, score: number) => void } = {},
): AutoplayResult {
  const rand = opts.rand || Math.random;
  let b = start, score = 0, moves = 0;
  const limit = opts.maxMoves ?? 100000;
  while (moves < limit) {
    const { dir } = bestMove(b, opts.depth, { ...opts, rand });
    if (!dir) break;
    const m = move(b, dir);
    score += m.gain;
    b = spawn(m.board, rand);
    moves++;
    opts.onMove?.(b, dir, score);
  }
  return { board: b, score, moves, max: maxTile(b), dead: !canMove(b) };
}
