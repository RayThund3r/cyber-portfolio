// src/lib/games/tetris.ts — pure Tetris rules: 7-bag randomiser, rotation with simple wall kicks, ghost piece, hold,
// line clears, levels and gravity. Immutable updates: every function returns a new state.
import { Rng, shuffle } from './rng';

export const COLS = 10;
export const ROWS = 20;
export type PieceId = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const PIECES: PieceId[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
/** Cell values on the board: 0 empty, else index+1 into PIECES. */
export const colorOf = (id: PieceId) => PIECES.indexOf(id) + 1;

const BASE: Record<PieceId, number[][]> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

export const rotateMatrix = (m: number[][]): number[][] => m[0].map((_, c) => m.map((row) => row[c]).reverse());
export function matrixFor(t: PieceId, rot: number): number[][] {
  let m = BASE[t];
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) m = rotateMatrix(m);
  return m;
}

export interface Piece { t: PieceId; r: number; x: number; y: number }
export interface TetrisState {
  board: number[][];
  cur: Piece;
  next: PieceId[];
  bag: PieceId[];
  hold: PieceId | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  over: boolean;
  /** Lines cleared by the last lock (for UI/banter) and a running count of consecutive clearing locks. */
  lastClear: number;
  combo: number;
}

export function cellsOf(p: Piece): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  matrixFor(p.t, p.r).forEach((row, ry) => row.forEach((v, rx) => v && out.push([p.x + rx, p.y + ry])));
  return out;
}

export function collides(board: number[][], p: Piece): boolean {
  return cellsOf(p).some(([x, y]) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== 0));
}

const emptyBoard = () => Array.from({ length: ROWS }, () => Array<number>(COLS).fill(0));

function draw(bag: PieceId[], rng: Rng): [PieceId, PieceId[]] {
  const b = bag.length ? bag : shuffle(PIECES, rng);
  return [b[0], b.slice(1)];
}
const spawn = (t: PieceId): Piece => ({ t, r: 0, x: Math.floor((COLS - matrixFor(t, 0)[0].length) / 2), y: t === 'I' ? -1 : 0 });

export function newGame(rng: Rng, startLevel = 1): TetrisState {
  let bag: PieceId[] = [];
  const queue: PieceId[] = [];
  for (let i = 0; i < 4; i++) { const [p, nb] = draw(bag, rng); queue.push(p); bag = nb; }
  const first = queue.shift() as PieceId;
  return { board: emptyBoard(), cur: spawn(first), next: queue, bag, hold: null, canHold: true, score: 0, lines: 0, level: startLevel, over: false, lastClear: 0, combo: 0 };
}

export const gravityMs = (level: number) => Math.max(70, 820 - (level - 1) * 75);
export const LINE_POINTS = [0, 100, 300, 500, 800];

export function ghostY(s: Pick<TetrisState, 'board' | 'cur'>): number {
  let p = s.cur;
  while (!collides(s.board, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
  return p.y;
}

export function move(s: TetrisState, dx: number): TetrisState {
  if (s.over) return s;
  const p = { ...s.cur, x: s.cur.x + dx };
  return collides(s.board, p) ? s : { ...s, cur: p };
}

/** Rotate clockwise (dir 1) or back (dir -1); tries small horizontal/up kicks. */
export function rotate(s: TetrisState, dir: 1 | -1 = 1): TetrisState {
  if (s.over || s.cur.t === 'O') return s;
  const r = (s.cur.r + dir + 4) % 4;
  for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
    const p = { ...s.cur, r, x: s.cur.x + kx, y: s.cur.y + ky };
    if (!collides(s.board, p)) return { ...s, cur: p };
  }
  return s;
}

function lockAndSpawn(s: TetrisState, rng: Rng): TetrisState {
  const board = s.board.map((row) => row.slice());
  let topOut = false;
  for (const [x, y] of cellsOf(s.cur)) { if (y < 0) topOut = true; else board[y][x] = colorOf(s.cur.t); }
  const kept = board.filter((row) => row.some((v) => v === 0));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(Array<number>(COLS).fill(0));
  const lines = s.lines + cleared;
  const level = Math.max(s.level, 1 + Math.floor(lines / 10));
  const combo = cleared ? s.combo + 1 : 0;
  const score = s.score + LINE_POINTS[cleared] * s.level + (combo > 1 ? 50 * (combo - 1) * s.level : 0);
  const [nextPiece, bag] = draw(s.bag, rng);
  const queue = [...s.next, nextPiece];
  const t = queue.shift() as PieceId;
  const cur = spawn(t);
  const over = topOut || collides(kept, cur);
  return { board: kept, cur, next: queue, bag, hold: s.hold, canHold: true, score, lines, level, over, lastClear: cleared, combo };
}

/** One gravity step: fall one row, or lock if resting. `locked` says whether a lock happened. */
export function tick(s: TetrisState, rng: Rng): { state: TetrisState; locked: boolean } {
  if (s.over) return { state: s, locked: false };
  const p = { ...s.cur, y: s.cur.y + 1 };
  if (!collides(s.board, p)) return { state: { ...s, cur: p, lastClear: 0 }, locked: false };
  return { state: lockAndSpawn(s, rng), locked: true };
}

export function softDrop(s: TetrisState, rng: Rng): { state: TetrisState; locked: boolean } {
  const r = tick(s, rng);
  return { state: r.locked ? r.state : { ...r.state, score: r.state.score + 1 }, locked: r.locked };
}

export function hardDrop(s: TetrisState, rng: Rng): TetrisState {
  if (s.over) return s;
  const y = ghostY(s);
  const dist = y - s.cur.y;
  return lockAndSpawn({ ...s, cur: { ...s.cur, y }, score: s.score + dist * 2 }, rng);
}

export function holdPiece(s: TetrisState, rng: Rng): TetrisState {
  if (s.over || !s.canHold) return s;
  if (s.hold === null) {
    const [np, bag] = draw(s.bag, rng);
    const queue = [...s.next, np];
    const t = queue.shift() as PieceId;
    return { ...s, hold: s.cur.t, cur: spawn(t), next: queue, bag, canHold: false };
  }
  return { ...s, hold: s.cur.t, cur: spawn(s.hold), canHold: false };
}
