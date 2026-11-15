// src/lib/games/flappy.ts — pure Flappy-style runner. `step` mutates the state and returns events.
import { Rng } from './rng';

export const W = 288;
export const H = 420;
export const GROUND = 36;
export const BIRD_X = 70;
export const BIRD_R = 11;
export const PIPE_W = 52;
export type FlappyEvent = 'flap' | 'score' | 'crash';

export interface Pipe { x: number; gapY: number; gap: number; passed: boolean }
export interface FlappyState { y: number; vy: number; pipes: Pipe[]; score: number; over: boolean; started: boolean; t: number; sinceFlap: number }

export const GRAVITY = 1250;
export const FLAP_V = -370;
const SPEED = 110;
const SPACING = 170;

export const newGame = (): FlappyState => ({ y: H / 2 - 20, vy: 0, pipes: [], score: 0, over: false, started: false, t: 0, sinceFlap: 9 });

export function flap(s: FlappyState): FlappyEvent[] {
  if (s.over) return [];
  s.started = true; s.vy = FLAP_V; s.sinceFlap = 0;
  return ['flap'];
}

function addPipe(s: FlappyState, x: number, rng: Rng) {
  const gap = Math.max(104, 138 - Math.floor(s.score / 5) * 4);
  const min = 60 + gap / 2, max = H - GROUND - 60 - gap / 2;
  s.pipes.push({ x, gapY: min + rng() * (max - min), gap, passed: false });
}

export function step(s: FlappyState, dt: number, rng: Rng): FlappyEvent[] {
  const ev: FlappyEvent[] = [];
  if (s.over) return ev;
  dt = Math.min(dt, 0.033);
  s.t += dt; s.sinceFlap += dt;
  if (!s.started) { s.y = H / 2 - 20 + Math.sin(s.t * 5) * 6; return ev; } // idle bob
  s.vy += GRAVITY * dt; s.y += s.vy * dt;
  const speed = SPEED + Math.min(50, s.score * 2);
  for (const p of s.pipes) p.x -= speed * dt;
  s.pipes = s.pipes.filter((p) => p.x > -PIPE_W - 4);
  if (!s.pipes.length || s.pipes[s.pipes.length - 1].x < W - SPACING) addPipe(s, s.pipes.length ? W + 20 : W + 80, rng);
  for (const p of s.pipes) {
    if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) { p.passed = true; s.score += 1; ev.push('score'); }
    const overlapX = BIRD_X + BIRD_R - 2 > p.x && BIRD_X - BIRD_R + 2 < p.x + PIPE_W;
    if (overlapX && (s.y - BIRD_R + 2 < p.gapY - p.gap / 2 || s.y + BIRD_R - 2 > p.gapY + p.gap / 2)) { s.over = true; }
  }
  if (s.y + BIRD_R > H - GROUND) { s.y = H - GROUND - BIRD_R; s.over = true; }
  if (s.y - BIRD_R < -20) { s.y = -20 + BIRD_R; s.vy = 0; }
  if (s.over) ev.push('crash');
  return ev;
}
