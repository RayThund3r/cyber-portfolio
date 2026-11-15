// src/lib/games/snake.ts — pure Snake rules. The board is a w x h grid; the snake moves one cell per tick.
import { Rng, randInt } from './rng';

export type Dir = 'U' | 'D' | 'L' | 'R';
export interface Pt { x: number; y: number }
export interface SnakeState {
  w: number; h: number;
  /** Head first. */
  body: Pt[];
  dir: Dir;
  /** Turns waiting to be applied (max 2) so quick double taps make a U-turn. */
  queue: Dir[];
  food: Pt;
  score: number;
  eaten: number;
  alive: boolean;
  wrap: boolean;
}

const DELTA: Record<Dir, Pt> = { U: { x: 0, y: -1 }, D: { x: 0, y: 1 }, L: { x: -1, y: 0 }, R: { x: 1, y: 0 } };
export const OPPOSITE: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' };

export function placeFood(s: Pick<SnakeState, 'w' | 'h' | 'body'>, rng: Rng): Pt {
  const taken = new Set(s.body.map((p) => p.y * s.w + p.x));
  const free = s.w * s.h - taken.size;
  if (free <= 0) return { x: -1, y: -1 };
  let n = randInt(rng, free);
  for (let i = 0; i < s.w * s.h; i++) if (!taken.has(i) && n-- === 0) return { x: i % s.w, y: Math.floor(i / s.w) };
  return { x: -1, y: -1 };
}

export function newSnake(w: number, h: number, rng: Rng, wrap = false): SnakeState {
  const cy = Math.floor(h / 2), cx = Math.floor(w / 2);
  const body = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
  return { w, h, body, dir: 'R', queue: [], food: placeFood({ w, h, body }, rng), score: 0, eaten: 0, alive: true, wrap };
}

/** Queue a turn. Reversing into yourself and repeating the same direction are ignored. */
export function turn(s: SnakeState, d: Dir): SnakeState {
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  if (d === last || d === OPPOSITE[last] || s.queue.length >= 2) return s;
  return { ...s, queue: [...s.queue, d] };
}

export interface SnakeStep { state: SnakeState; ate: boolean; died: boolean }

export function step(s: SnakeState, rng: Rng): SnakeStep {
  if (!s.alive) return { state: s, ate: false, died: false };
  const dir = s.queue.length ? s.queue[0] : s.dir;
  const queue = s.queue.slice(1);
  let nx = s.body[0].x + DELTA[dir].x, ny = s.body[0].y + DELTA[dir].y;
  if (s.wrap) { nx = (nx + s.w) % s.w; ny = (ny + s.h) % s.h; }
  const out = nx < 0 || ny < 0 || nx >= s.w || ny >= s.h;
  const ate = !out && nx === s.food.x && ny === s.food.y;
  // The tail cell is vacated this tick unless we grow, so moving into it is legal.
  const solid = ate ? s.body : s.body.slice(0, -1);
  if (out || solid.some((p) => p.x === nx && p.y === ny)) return { state: { ...s, dir, queue, alive: false }, ate: false, died: true };
  const body = [{ x: nx, y: ny }, ...(ate ? s.body : s.body.slice(0, -1))];
  const next: SnakeState = { ...s, body, dir, queue, alive: true };
  if (ate) {
    next.eaten = s.eaten + 1;
    next.score = s.score + 10 + Math.min(10, Math.floor(next.eaten / 5) * 2);
    next.food = placeFood(next, rng);
    if (next.food.x < 0) next.alive = false; // board full: perfect game
  }
  return { state: next, ate, died: false };
}

/** Milliseconds per tick: starts relaxed, speeds up with each food, never faster than 55ms. */
export const tickMs = (eaten: number, base = 150) => Math.max(55, base - eaten * 3);
