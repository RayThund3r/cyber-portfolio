// src/lib/games/chess.ts
//
// A complete chess engine in plain TypeScript: full rules (castling, en passant, promotion, check,
// checkmate, stalemate, 50-move and insufficient-material draws), SAN notation, and an AI (see
// chessEngine.ts: PVS + null-move + LMR + transposition table + tapered evaluation, plus an opening
// book defined here). Pure functions, no DOM.
//
// Board: Int8Array(64), index 0 = a8 ... 63 = h1. White pieces 1..6 (P N B R Q K), black negative.

import { search as engineSearch, evaluateState, perftFast as enginePerft, clearEngine } from './chessEngine';

export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
export type Color = 'w' | 'b';

export interface Move {
  from: number;
  to: number;
  promo?: number; // N B R Q (positive)
  ep?: boolean;
  castle?: 'K' | 'Q';
}

export interface State {
  board: Int8Array;
  turn: Color;
  castling: { K: boolean; Q: boolean; k: boolean; q: boolean };
  ep: number; // en-passant target square or -1
  half: number;
  full: number;
}

const FEN_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];

export const sq = (file: number, rank: number) => (7 - rank) * 8 + file; // rank 0 = 1st rank
export const fileOf = (s: number) => s & 7;
export const rankOf = (s: number) => 7 - (s >> 3);
export const name = (s: number) => 'abcdefgh'[fileOf(s)] + (rankOf(s) + 1);
export const parseSquare = (t: string) => sq(t.charCodeAt(0) - 97, parseInt(t[1], 10) - 1);

export function fromFEN(fen: string = FEN_START): State {
  const [pos, turn, cast, ep, half, full] = fen.trim().split(/\s+/);
  const board = new Int8Array(64);
  let i = 0;
  for (const ch of pos) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) { i += parseInt(ch, 10); continue; }
    const idx = 'pnbrqk'.indexOf(ch.toLowerCase()) + 1;
    board[i++] = ch === ch.toLowerCase() ? -idx : idx;
  }
  return {
    board,
    turn: turn === 'b' ? 'b' : 'w',
    castling: { K: cast?.includes('K') ?? false, Q: cast?.includes('Q') ?? false, k: cast?.includes('k') ?? false, q: cast?.includes('q') ?? false },
    ep: ep && ep !== '-' ? parseSquare(ep) : -1,
    half: parseInt(half || '0', 10) || 0,
    full: parseInt(full || '1', 10) || 1,
  };
}

export function toFEN(s: State): string {
  let out = '';
  for (let r = 0; r < 8; r++) {
    let e = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.board[r * 8 + f];
      if (!p) { e++; continue; }
      if (e) { out += e; e = 0; }
      const l = LETTER[Math.abs(p)];
      out += p > 0 ? l : l.toLowerCase();
    }
    if (e) out += e;
    if (r < 7) out += '/';
  }
  const c = (s.castling.K ? 'K' : '') + (s.castling.Q ? 'Q' : '') + (s.castling.k ? 'k' : '') + (s.castling.q ? 'q' : '');
  return `${out} ${s.turn} ${c || '-'} ${s.ep >= 0 ? name(s.ep) : '-'} ${s.half} ${s.full}`;
}

/** Position key for repetition detection (no move counters). */
export const positionKey = (s: State) => toFEN(s).split(' ').slice(0, 4).join(' ');

const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIAG = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function attacked(b: Int8Array, target: number, by: Color): boolean {
  const sign = by === 'w' ? 1 : -1;
  const f = fileOf(target), r = rankOf(target);
  // pawns: a white pawn attacks up-board (rank+1), so it sits one rank below the target
  const pr = by === 'w' ? r - 1 : r + 1;
  if (pr >= 0 && pr < 8) for (const df of [-1, 1]) { const pf = f + df; if (pf >= 0 && pf < 8 && b[sq(pf, pr)] === sign * P) return true; }
  for (const [df, dr] of KN) { const ff = f + df, rr = r + dr; if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && b[sq(ff, rr)] === sign * N) return true; }
  for (const [df, dr] of KG) { const ff = f + df, rr = r + dr; if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && b[sq(ff, rr)] === sign * K) return true; }
  for (const [df, dr] of DIAG) { let ff = f + df, rr = r + dr; while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) { const p = b[sq(ff, rr)]; if (p) { if (p === sign * B || p === sign * Q) return true; break; } ff += df; rr += dr; } }
  for (const [df, dr] of ORTH) { let ff = f + df, rr = r + dr; while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) { const p = b[sq(ff, rr)]; if (p) { if (p === sign * R || p === sign * Q) return true; break; } ff += df; rr += dr; } }
  return false;
}

const kingSq = (b: Int8Array, c: Color) => b.indexOf(c === 'w' ? K : -K);
export const inCheck = (s: State, c: Color = s.turn) => attacked(s.board, kingSq(s.board, c), c === 'w' ? 'b' : 'w');

function pseudo(s: State, capturesOnly = false): Move[] {
  const out: Move[] = [];
  const b = s.board, w = s.turn === 'w', sign = w ? 1 : -1;
  for (let from = 0; from < 64; from++) {
    const p = b[from];
    if (!p || (p > 0) !== w) continue;
    const t = Math.abs(p), f = fileOf(from), r = rankOf(from);
    if (t === P) {
      const dir = w ? 1 : -1, startR = w ? 1 : 6, promoR = w ? 7 : 0;
      const r1 = r + dir;
      if (r1 < 0 || r1 > 7) continue;
      const push = (to: number, extra: Partial<Move> = {}) => {
        if (rankOf(to) === promoR) for (const pr of [Q, R, B, N]) out.push({ from, to, promo: pr });
        else out.push({ from, to, ...extra });
      };
      const one = sq(f, r1);
      if (!b[one] && (!capturesOnly || rankOf(one) === promoR)) {
        push(one);
        if (r === startR && !b[sq(f, r + 2 * dir)] && !capturesOnly) out.push({ from, to: sq(f, r + 2 * dir) });
      }
      for (const df of [-1, 1]) {
        const ff = f + df;
        if (ff < 0 || ff > 7) continue;
        const to = sq(ff, r1), tp = b[to];
        if (tp && (tp > 0) !== w) push(to);
        else if (to === s.ep) out.push({ from, to, ep: true });
      }
    } else if (t === N || t === K) {
      for (const [df, dr] of t === N ? KN : KG) {
        const ff = f + df, rr = r + dr;
        if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue;
        const to = sq(ff, rr), tp = b[to];
        if (tp && (tp > 0) === w) continue;
        if (capturesOnly && !tp) continue;
        out.push({ from, to });
      }
      if (t === K && !capturesOnly) {
        const rank = w ? 0 : 7, enemy: Color = w ? 'b' : 'w';
        if (from === sq(4, rank) && !attacked(b, from, enemy)) {
          if ((w ? s.castling.K : s.castling.k) && !b[sq(5, rank)] && !b[sq(6, rank)] && b[sq(7, rank)] === sign * R && !attacked(b, sq(5, rank), enemy) && !attacked(b, sq(6, rank), enemy))
            out.push({ from, to: sq(6, rank), castle: 'K' });
          if ((w ? s.castling.Q : s.castling.q) && !b[sq(3, rank)] && !b[sq(2, rank)] && !b[sq(1, rank)] && b[sq(0, rank)] === sign * R && !attacked(b, sq(3, rank), enemy) && !attacked(b, sq(2, rank), enemy))
            out.push({ from, to: sq(2, rank), castle: 'Q' });
        }
      }
    } else {
      for (const [df, dr] of t === B ? DIAG : t === R ? ORTH : [...DIAG, ...ORTH]) {
        let ff = f + df, rr = r + dr;
        while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
          const to = sq(ff, rr), tp = b[to];
          if (tp) { if ((tp > 0) !== w) out.push({ from, to }); break; }
          if (!capturesOnly) out.push({ from, to });
          ff += df; rr += dr;
        }
      }
    }
  }
  return out;
}

export function makeMove(s: State, m: Move): State {
  const b = new Int8Array(s.board);
  const p = b[m.from], w = p > 0, t = Math.abs(p);
  const captured = b[m.to];
  b[m.to] = m.promo ? (w ? m.promo : -m.promo) : p;
  b[m.from] = 0;
  if (m.ep) b[sq(fileOf(m.to), rankOf(m.from))] = 0;
  if (m.castle) {
    const rank = w ? 0 : 7;
    if (m.castle === 'K') { b[sq(5, rank)] = b[sq(7, rank)]; b[sq(7, rank)] = 0; }
    else { b[sq(3, rank)] = b[sq(0, rank)]; b[sq(0, rank)] = 0; }
  }
  const c = { ...s.castling };
  if (t === K) { if (w) { c.K = false; c.Q = false; } else { c.k = false; c.q = false; } }
  for (const [square, key] of [[sq(0, 0), 'Q'], [sq(7, 0), 'K'], [sq(0, 7), 'q'], [sq(7, 7), 'k']] as const) if (m.from === square || m.to === square) c[key] = false;
  let ep = -1;
  if (t === P && Math.abs(rankOf(m.to) - rankOf(m.from)) === 2) ep = sq(fileOf(m.from), (rankOf(m.from) + rankOf(m.to)) / 2);
  return { board: b, turn: w ? 'b' : 'w', castling: c, ep, half: t === P || captured ? 0 : s.half + 1, full: s.full + (w ? 0 : 1) };
}

export function legalMoves(s: State): Move[] {
  const me = s.turn, you: Color = me === 'w' ? 'b' : 'w';
  return pseudo(s).filter((m) => {
    const n = makeMove(s, m);
    return !attacked(n.board, kingSq(n.board, me), you);
  });
}

export type Status = 'playing' | 'checkmate' | 'stalemate' | 'draw50' | 'insufficient';

function insufficient(b: Int8Array): boolean {
  const minors: number[] = [];
  for (const p of b) { const t = Math.abs(p); if (t === P || t === R || t === Q) return false; if (t === N || t === B) minors.push(t); }
  return minors.length <= 1;
}

export function status(s: State): Status {
  if (!legalMoves(s).length) return inCheck(s) ? 'checkmate' : 'stalemate';
  if (s.half >= 100) return 'draw50';
  if (insufficient(s.board)) return 'insufficient';
  return 'playing';
}

/** Standard algebraic notation for `m` in position `s`. */
export function toSAN(s: State, m: Move): string {
  const p = Math.abs(s.board[m.from]);
  let san: string;
  if (m.castle) san = m.castle === 'K' ? 'O-O' : 'O-O-O';
  else {
    const cap = !!s.board[m.to] || !!m.ep;
    if (p === P) san = (cap ? 'abcdefgh'[fileOf(m.from)] + 'x' : '') + name(m.to) + (m.promo ? '=' + LETTER[m.promo] : '');
    else {
      const others = legalMoves(s).filter((o) => o.to === m.to && o.from !== m.from && Math.abs(s.board[o.from]) === p);
      let dis = '';
      if (others.length) {
        if (!others.some((o) => fileOf(o.from) === fileOf(m.from))) dis = 'abcdefgh'[fileOf(m.from)];
        else if (!others.some((o) => rankOf(o.from) === rankOf(m.from))) dis = String(rankOf(m.from) + 1);
        else dis = name(m.from);
      }
      san = LETTER[p] + dis + (cap ? 'x' : '') + name(m.to);
    }
  }
  const n = makeMove(s, m);
  if (inCheck(n)) san += legalMoves(n).length ? '+' : '#';
  return san;
}

export function perft(s: State, depth: number): number {
  if (depth === 0) return 1;
  const ms = legalMoves(s);
  if (depth === 1) return ms.length;
  let n = 0;
  for (const m of ms) n += perft(makeMove(s, m), depth - 1);
  return n;
}

/* ------------------------------------------------------------------------------------------------
 * Evaluation + search (implemented in chessEngine.ts)
 * ---------------------------------------------------------------------------------------------- */
/** Score from the side-to-move's point of view, in centipawns. */
export function evaluate(s: State): number {
  return evaluateState(s);
}

/** Same numbers as `perft`, computed with the engine's fast make/unmake generator. */
export const perftFast = enginePerft;
/** Forget the transposition table and history heuristics (call when a new game starts). */
export const resetEngine = clearEngine;

const MATE = 100000;

export interface SearchOptions {
  maxDepth?: number;
  timeMs?: number;
  /** 0..: weakening. Picks among near-best moves at lower levels. */
  noise?: number;
  rand?: () => number;
  /** positionKey() of every earlier position in the game (for repetition awareness). */
  history?: string[];
  /** Use the opening book while the position is still in it. */
  book?: boolean;
}
export interface SearchResult {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
  /** Root moves with scores (exact when `noise` > 0, otherwise only the first is exact). */
  scored: Array<{ move: Move; score: number }>;
  /** True when the move came from the opening book. */
  book?: boolean;
  ms?: number;
}

/* ---- opening book ---- */
const BOOK_LINES = [
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8',
  'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5 d6f5',
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6 e1g1 e8g8',
  'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5 c2c3 d7d6',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 b1c3 f8b4 d4c6 b7c6 f1d3',
  'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5 f1d3 f8e7 e1g1 b8c6',
  'e2e4 e7e5 b1c3 g8f6 g2g3 d7d5 e4d5 f6d5 f1g2 d5b6',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3 c8e6',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6 f1e2 g7g6',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 f1d3 g8f6 e1g1 d8c7',
  'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3 d7d6',
  'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7',
  'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 a2a3 c5c4',
  'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7 f1d3 c7c5 c2c3 b8c6',
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3 b8d7',
  'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 c6c5',
  'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c7c6',
  'e2e4 g7g6 d2d4 f8g7 b1c3 d7d6 g1f3 g8f6 f1e2 e8g8',
  'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1 c7c6',
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6 g5h4 b7b6',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3 e7e6 f1c4 f8b4',
  'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5 e1g1 a7a6',
  'd2d4 d7d5 g1f3 g8f6 c2c4 e7e6 b1c3 f8e7 c1f4 e8g8 e2e3 c7c5',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5 e1g1 b8c6',
  'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7 e1g1 e8g8 b1c3 f6e4',
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6',
  'd2d4 g8f6 c2c4 e7e6 g1f3 d7d5 b1c3 f8e7 c1g5 e8g8 e2e3 h7h6',
  'd2d4 g8f6 g1f3 g7g6 g2g3 f8g7 f1g2 e8g8 e1g1 d7d6 c2c4 b8d7',
  'd2d4 f7f5 g2g3 g8f6 f1g2 g7g6 g1f3 f8g7 e1g1 e8g8',
  'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5 f1g2 d5b6 e1g1 f8e7',
  'c2c4 g8f6 b1c3 e7e6 g1f3 d7d5 d2d4 f8e7 c1f4 e8g8 e2e3 c7c5',
  'c2c4 c7c5 g1f3 g8f6 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 e1g1 e8g8',
  'g1f3 d7d5 g2g3 g8f6 f1g2 e7e6 e1g1 f8e7 d2d4 e8g8 c2c4 d5c4',
  'g1f3 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 d2d4 e8g8 f1e2 e7e5',
  'g1f3 c7c5 c2c4 b8c6 b1c3 g8f6 g2g3 d7d5 c4d5 f6d5 f1g2 d5c7',
  'f2f4 d7d5 g1f3 g8f6 e2e3 g7g6 f1e2 f8g7 e1g1 e8g8',
];
let bookMap: Map<string, Set<string>> | null = null;
const uci = (m: Move) => name(m.from) + name(m.to) + (m.promo ? 'nbrq'[m.promo - 2] : '');
function buildBook() {
  const map = new Map<string, Set<string>>();
  for (const line of BOOK_LINES) {
    let s = fromFEN();
    for (const tok of line.split(' ')) {
      const m = legalMoves(s).find((x) => uci(x) === tok);
      if (!m) break;
      const key = positionKey(s);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(tok);
      s = makeMove(s, m);
    }
  }
  return map;
}
/** Every UCI move the book has for this position (empty when out of book). */
export function bookMoves(s: State): string[] {
  if (!bookMap) bookMap = buildBook();
  return [...(bookMap.get(positionKey(s)) ?? [])];
}
/** Check that every book line is legal; returns the first illegal token, or null. (Used by tests.) */
export function validateBook(): string | null {
  for (const line of BOOK_LINES) {
    let s = fromFEN();
    for (const tok of line.split(' ')) {
      const m = legalMoves(s).find((x) => uci(x) === tok);
      if (!m) return `${line} :: ${tok}`;
      s = makeMove(s, m);
    }
  }
  return null;
}

export function bestMove(root: State, opts: SearchOptions = {}): SearchResult {
  const t0 = Date.now();
  const rand = opts.rand ?? Math.random;
  if (opts.book && root.full <= 14) {
    const cands = bookMoves(root);
    if (cands.length) {
      const legal = legalMoves(root);
      const pick = cands[Math.floor(rand() * cands.length)];
      const mv = legal.find((x) => uci(x) === pick);
      if (mv) return { move: mv, score: 0, depth: 0, nodes: 0, scored: legal.map((m) => ({ move: m, score: m === mv ? 0 : -10 })), book: true, ms: Date.now() - t0 };
    }
  }
  const history = (opts.history ?? []).map((k) => fromFEN(k + ' 0 1'));
  const r = engineSearch(root, {
    maxDepth: opts.maxDepth ?? 4,
    timeMs: opts.timeMs ?? 800,
    noise: opts.noise ?? 0,
    rand,
    history,
  });
  const out: SearchResult = { ...r, ms: Date.now() - t0 };
  // Weaker levels: choose among moves within a margin of the best, so mistakes look human.
  if (opts.noise && opts.noise > 0 && out.scored.length > 1 && Math.abs(out.score) < MATE - 100) {
    const margin = opts.noise * 220;
    const pool = out.scored.filter((x) => x.score >= out.score - margin);
    if (pool.length > 1) out.move = pool[Math.floor(rand() * pool.length)].move;
  }
  return out;
}

export const LEVELS = [
  { id: 'easy', label: 'Beginner', depth: 2, timeMs: 250, noise: 1.6, book: false },
  { id: 'medium', label: 'Club', depth: 4, timeMs: 600, noise: 0.45, book: true },
  { id: 'hard', label: 'Expert', depth: 9, timeMs: 1500, noise: 0, book: true },
  { id: 'max', label: 'Master', depth: 24, timeMs: 3500, noise: 0, book: true },
] as const;
export type LevelId = (typeof LEVELS)[number]['id'];
