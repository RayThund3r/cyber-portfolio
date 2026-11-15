// src/lib/games/pong.ts — pure Pong vs an AI with four difficulty levels. `step` mutates and returns events.
import { Rng } from './rng';

export const W = 400;
export const H = 260;
export const PW = 8;
export const PH = 56;
export const WIN_SCORE = 7;
export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane';
export type PongEvent = 'hit' | 'wall' | 'player-score' | 'ai-score' | 'win' | 'lose';

/** AI strength: paddle speed (px/s), reaction delay (s) between re-aiming, aim error (px). */
export const LEVELS: Record<Difficulty, { speed: number; react: number; error: number }> = {
  easy: { speed: 110, react: 0.28, error: 38 },
  medium: { speed: 170, react: 0.16, error: 22 },
  hard: { speed: 240, react: 0.08, error: 9 },
  insane: { speed: 330, react: 0.03, error: 2 },
};

export interface PongState {
  player: number; // paddle centre y (left)
  ai: number;     // paddle centre y (right)
  ball: { x: number; y: number; vx: number; vy: number };
  score: { player: number; ai: number };
  level: Difficulty;
  over: boolean;
  aimY: number;
  aimIn: number;
  /** Seconds the ball is frozen after a point. */
  serve: number;
  rallies: number;
}

const baseSpeed = 200;

function serveBall(s: PongState, dir: 1 | -1, rng: Rng) {
  s.ball = { x: W / 2, y: H / 2, vx: baseSpeed * dir, vy: (rng() - 0.5) * 160 };
  s.serve = 0.8; s.rallies = 0;
}

export function newGame(level: Difficulty, rng: Rng): PongState {
  const s: PongState = { player: H / 2, ai: H / 2, ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, score: { player: 0, ai: 0 }, level, over: false, aimY: H / 2, aimIn: 0, serve: 0.8, rallies: 0 };
  serveBall(s, rng() < 0.5 ? 1 : -1, rng);
  return s;
}

const clampPad = (y: number) => Math.max(PH / 2, Math.min(H - PH / 2, y));

/** Where the ball will cross x (with wall bounces), ignoring paddle hits. */
export function predictY(b: { x: number; y: number; vx: number; vy: number }, x: number): number {
  if (b.vx === 0) return b.y;
  const t = (x - b.x) / b.vx;
  if (t < 0) return H / 2;
  let y = b.y + b.vy * t;
  const span = H * 2;
  y = ((y % span) + span) % span;
  return y > H ? span - y : y;
}

/** `playerTarget`: wanted player paddle centre (mouse/touch) or `dir` -1/0/1 for the keyboard. */
export function step(s: PongState, dt: number, input: { target?: number; dir?: number }, rng: Rng): PongEvent[] {
  const ev: PongEvent[] = [];
  if (s.over) return ev;
  dt = Math.min(dt, 0.033);
  if (input.target !== undefined) s.player = clampPad(input.target);
  else if (input.dir) s.player = clampPad(s.player + input.dir * 300 * dt);

  const L = LEVELS[s.level];
  // AI: re-aim every `react` seconds toward the predicted impact point (plus error), then glide at limited speed.
  s.aimIn -= dt;
  if (s.aimIn <= 0) {
    s.aimIn = L.react;
    s.aimY = s.ball.vx > 0 ? predictY(s.ball, W - 20 - PW) + (rng() - 0.5) * 2 * L.error : H / 2 + (rng() - 0.5) * 30;
  }
  const d = s.aimY - s.ai;
  s.ai = clampPad(s.ai + Math.max(-L.speed * dt, Math.min(L.speed * dt, d)));

  if (s.serve > 0) { s.serve -= dt; return ev; }
  const b = s.ball;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.y < 4) { b.y = 4; b.vy = Math.abs(b.vy); ev.push('wall'); }
  if (b.y > H - 4) { b.y = H - 4; b.vy = -Math.abs(b.vy); ev.push('wall'); }
  const hit = (padY: number, left: boolean) => {
    const off = Math.max(-1, Math.min(1, (b.y - padY) / (PH / 2)));
    const sp = Math.min(520, Math.hypot(b.vx, b.vy) * 1.06 + 4);
    const ang = off * (Math.PI / 3.2);
    b.vx = Math.cos(ang) * sp * (left ? 1 : -1);
    b.vy = Math.sin(ang) * sp;
    s.rallies += 1;
    ev.push('hit');
  };
  if (b.vx < 0 && b.x <= 20 + PW && b.x >= 14 && Math.abs(b.y - s.player) <= PH / 2 + 4) { b.x = 20 + PW + 1; hit(s.player, true); }
  else if (b.vx > 0 && b.x >= W - 20 - PW && b.x <= W - 14 && Math.abs(b.y - s.ai) <= PH / 2 + 4) { b.x = W - 20 - PW - 1; hit(s.ai, false); }
  if (b.x < -6) { s.score.ai += 1; ev.push('ai-score'); serveBall(s, 1, rng); }
  else if (b.x > W + 6) { s.score.player += 1; ev.push('player-score'); serveBall(s, -1, rng); }
  if (s.score.player >= WIN_SCORE) { s.over = true; ev.push('win'); }
  else if (s.score.ai >= WIN_SCORE) { s.over = true; ev.push('lose'); }
  return ev;
}
