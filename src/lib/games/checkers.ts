// src/lib/games/checkers.ts — English/American draughts: forced captures, multi-jumps, kings, and an
// iterative-deepening alpha-beta AI with a time budget. Pure functions, no DOM.
//
// Board: Int8Array(64), index = row*8 + col, row 0 at the top. Dark squares are those with (row+col) odd.
// Red (1) starts at the bottom and moves up (towards row 0); Black (-1) starts at the top. Kings are ±2.

export type Side = 1 | -1;
export interface CState { board: Int8Array; turn: Side; quiet: number }
export interface CMove { from: number; to: number; path: number[]; captured: number[] }

export const rowOf = (i: number) => i >> 3;
export const colOf = (i: number) => i & 7;
export const isDark = (i: number) => ((i >> 3) + (i & 7)) % 2 === 1;

export function initial(): CState {
  const board = new Int8Array(64);
  for (let i = 0; i < 64; i++) {
    if (!isDark(i)) continue;
    if (i >> 3 < 3) board[i] = -1;
    else if (i >> 3 > 4) board[i] = 1;
  }
  return { board, turn: 1, quiet: 0 };
}

const FWD = (s: Side): Array<[number, number]> => (s === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
const ALL: Array<[number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function jumps(b: Int8Array, from: number, side: Side, king: boolean, start: number, path: number[], caps: number[], out: CMove[]): boolean {
  let any = false;
  const r = from >> 3, c = from & 7;
  for (const [dr, dc] of king ? ALL : FWD(side)) {
    const lr = r + 2 * dr, lc = c + 2 * dc;
    if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
    const mid = (r + dr) * 8 + c + dc, land = lr * 8 + lc;
    const mp = b[mid];
    if (mp === 0 || Math.sign(mp) === side || b[land] !== 0) continue;
    any = true;
    b[mid] = 0;
    path.push(land); caps.push(mid);
    const crowns = !king && lr === (side === 1 ? 0 : 7);
    const cont = crowns ? false : jumps(b, land, side, king, start, path, caps, out);
    if (!cont) out.push({ from: start, to: land, path: path.slice(), captured: caps.slice() });
    path.pop(); caps.pop();
    b[mid] = mp;
  }
  return any;
}

export function legalMoves(s: CState): CMove[] {
  const b = s.board, side = s.turn;
  const caps: CMove[] = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || Math.sign(p) !== side) continue;
    b[i] = 0; // the moving piece vacates its square while jumping
    jumps(b, i, side, Math.abs(p) === 2, i, [], [], caps);
    b[i] = p;
  }
  if (caps.length) return caps;
  const out: CMove[] = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || Math.sign(p) !== side) continue;
    const r = i >> 3, c = i & 7;
    for (const [dr, dc] of Math.abs(p) === 2 ? ALL : FWD(side)) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
      const to = nr * 8 + nc;
      if (!b[to]) out.push({ from: i, to, path: [to], captured: [] });
    }
  }
  return out;
}

export function apply(s: CState, m: CMove): CState {
  const b = new Int8Array(s.board);
  const p = b[m.from];
  b[m.from] = 0;
  for (const c of m.captured) b[c] = 0;
  const crowned = Math.abs(p) === 1 && (m.to >> 3) === (p === 1 ? 0 : 7);
  b[m.to] = crowned ? p * 2 : p;
  const quiet = m.captured.length || Math.abs(p) === 1 ? 0 : s.quiet + 1;
  return { board: b, turn: (-s.turn) as Side, quiet };
}

export type Result = 'ongoing' | 'red' | 'black' | 'draw';
export function result(s: CState, moves: CMove[] = legalMoves(s)): Result {
  if (!moves.length) return s.turn === 1 ? 'black' : 'red';
  if (s.quiet >= 80) return 'draw';
  return 'ongoing';
}

export const count = (s: CState) => {
  let red = 0, black = 0, redK = 0, blackK = 0;
  for (const p of s.board) { if (p > 0) { red++; if (p === 2) redK++; } else if (p < 0) { black++; if (p === -2) blackK++; } }
  return { red, black, redK, blackK };
};

/** Human-readable square like "c3" (columns a-h, rows 1-8 from Red's side). */
export const sqName = (i: number) => 'abcdefgh'[i & 7] + (8 - (i >> 3));
export const moveText = (m: CMove) => [m.from, ...m.path].map(sqName).join(m.captured.length ? 'x' : '-');

/* ------------------------------------------------------------------------------------------------
 * Evaluation + search
 * ---------------------------------------------------------------------------------------------- */
const MAN = 100, KING = 175, WIN = 100000;
function evaluate(b: Int8Array, side: Side): number {
  let score = 0, men = 0, kings = 0, oMen = 0, oKings = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const s = Math.sign(p), r = i >> 3, c = i & 7;
    let v: number;
    if (Math.abs(p) === 1) {
      const adv = s === 1 ? 7 - r : r; // rows advanced
      v = MAN + adv * 4;
      if (adv === 0) v += 9; // back-rank guard
      if (c === 0 || c === 7) v -= 2;
      if (r >= 2 && r <= 5 && c >= 2 && c <= 5) v += 3;
      if (s === side) men++; else oMen++;
    } else {
      v = KING;
      const cd = Math.abs(3.5 - r) + Math.abs(3.5 - c);
      v -= cd * 2;
      if (s === side) kings++; else oKings++;
    }
    score += s === side ? v : -v;
  }
  // when ahead, trade down; when behind, avoid it
  const mine = men + kings * 1.6, theirs = oMen + oKings * 1.6;
  if (mine + theirs < 10) score += (mine - theirs) * 6;
  return score;
}

export interface CSearchOptions { maxDepth?: number; timeMs?: number; noise?: number; rand?: () => number }
export interface CSearchResult { move: CMove | null; score: number; depth: number; nodes: number; scored: Array<{ move: CMove; score: number }> }

export function bestMove(root: CState, opts: CSearchOptions = {}): CSearchResult {
  const rand = opts.rand ?? Math.random;
  const maxDepth = opts.maxDepth ?? 6, deadline = Date.now() + (opts.timeMs ?? 800);
  const moves = legalMoves(root);
  if (!moves.length) return { move: null, score: -WIN, depth: 0, nodes: 0, scored: [] };
  let nodes = 0, stop = false;

  const nega = (s: CState, depth: number, alpha: number, beta: number, ply: number): number => {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    const ms = legalMoves(s);
    if (!ms.length) return -WIN + ply;
    if (s.quiet >= 80) return 0;
    // a pending capture is "forced", so keep searching it a little to avoid horizon blunders
    if (depth <= 0 && (ms[0].captured.length === 0 || ply > 24)) return evaluate(s.board, s.turn);
    ms.sort((a, b) => b.captured.length - a.captured.length);
    let best = -Infinity;
    for (const m of ms) {
      const v = -nega(apply(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (stop) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  };

  let order = moves.slice();
  let result: CSearchResult = { move: moves[0], score: 0, depth: 0, nodes: 0, scored: moves.map((m) => ({ move: m, score: 0 })) };
  const exact = (opts.noise ?? 0) > 0;
  for (let d = 1; d <= maxDepth; d++) {
    const scored: Array<{ move: CMove; score: number }> = [];
    let alpha = -Infinity;
    for (const m of order) {
      const v = -nega(apply(root, m), d - 1, -WIN * 2, exact ? WIN * 2 : -alpha, 1);
      if (stop) break;
      scored.push({ move: m, score: v });
      if (!exact && v > alpha) alpha = v;
    }
    if (stop) { if (d === 1 && scored.length) result = { ...result, move: scored.sort((a, b) => b.score - a.score)[0].move }; break; }
    scored.sort((a, b) => b.score - a.score);
    result = { move: scored[0].move, score: scored[0].score, depth: d, nodes, scored };
    order = scored.map((x) => x.move);
    if (Math.abs(scored[0].score) > WIN - 100) break;
    if (Date.now() > deadline - (opts.timeMs ?? 800) * 0.45) break;
  }
  if (exact && result.scored.length > 1 && Math.abs(result.score) < WIN - 100) {
    const margin = (opts.noise ?? 0) * 90;
    const pool = result.scored.filter((x) => x.score >= result.score - margin);
    result = { ...result, move: pool[Math.floor(rand() * pool.length)].move };
  }
  result.nodes = nodes;
  return result;
}

export const LEVELS = [
  { id: 'easy', label: 'Casual', depth: 2, timeMs: 150, noise: 1.8 },
  { id: 'medium', label: 'Club', depth: 6, timeMs: 400, noise: 0.35 },
  { id: 'hard', label: 'Expert', depth: 12, timeMs: 1000, noise: 0 },
  { id: 'max', label: 'Master', depth: 30, timeMs: 2200, noise: 0 },
] as const;
export type CLevel = (typeof LEVELS)[number]['id'];
