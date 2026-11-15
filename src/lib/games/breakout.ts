// src/lib/games/breakout.ts — pure Breakout physics in a fixed logical space (W x H). `step` mutates the state in place
// (it runs every frame) and returns the events that happened, so the UI can play sounds and publish them to the chat.
export const W = 320;
export const H = 420;
export const PADDLE_Y = H - 28;
export const PADDLE_H = 10;
export type BreakoutEvent = 'brick' | 'wall' | 'paddle' | 'lost-ball' | 'game-over' | 'level-clear';

export interface Brick { x: number; y: number; w: number; h: number; row: number; alive: boolean }
export interface BreakoutState {
  paddle: { x: number; w: number };
  ball: { x: number; y: number; vx: number; vy: number; r: number; stuck: boolean };
  bricks: Brick[];
  lives: number;
  score: number;
  level: number;
  over: boolean;
  /** Bricks broken since the ball last touched the paddle (combo). */
  chain: number;
}

export function makeBricks(level: number): Brick[] {
  const rows = Math.min(8, 4 + Math.floor((level - 1) / 2)), cols = 8, gap = 3;
  const bw = (W - gap * (cols + 1)) / cols, bh = 14;
  const out: Brick[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: gap + c * (bw + gap), y: 50 + r * (bh + gap), w: bw, h: bh, row: r, alive: true });
  return out;
}

export const ballSpeed = (level: number) => 230 + (level - 1) * 25;

export function newGame(level = 1, lives = 3, score = 0): BreakoutState {
  const w = Math.max(48, 76 - (level - 1) * 4);
  return { paddle: { x: W / 2, w }, ball: { x: W / 2, y: PADDLE_Y - 6, vx: 0, vy: 0, r: 5, stuck: true }, bricks: makeBricks(level), lives, score, level, over: false, chain: 0 };
}

export function launch(s: BreakoutState): void {
  if (!s.ball.stuck || s.over) return;
  const sp = ballSpeed(s.level);
  s.ball.stuck = false; s.ball.vx = sp * 0.35; s.ball.vy = -sp * 0.94;
}

export const brickPoints = (row: number, rows = 8) => 10 + (rows - 1 - Math.min(row, rows - 1)) * 5;

/** Advance by dt seconds. `paddleTarget` is the wanted paddle centre (clamped); pass undefined to leave it. */
export function step(s: BreakoutState, dt: number, paddleTarget?: number): BreakoutEvent[] {
  const ev: BreakoutEvent[] = [];
  if (s.over) return ev;
  dt = Math.min(dt, 0.033);
  if (paddleTarget !== undefined) s.paddle.x = Math.max(s.paddle.w / 2, Math.min(W - s.paddle.w / 2, paddleTarget));
  const b = s.ball;
  if (b.stuck) { b.x = s.paddle.x; b.y = PADDLE_Y - b.r - 1; return ev; }
  // Sub-step so a fast ball cannot tunnel through a brick.
  const n = Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 4) || 1;
  for (let i = 0; i < n; i++) {
    b.x += (b.vx * dt) / n; b.y += (b.vy * dt) / n;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); ev.push('wall'); }
    if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); ev.push('wall'); }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); ev.push('wall'); }
    // paddle
    const px0 = s.paddle.x - s.paddle.w / 2;
    if (b.vy > 0 && b.y + b.r >= PADDLE_Y && b.y + b.r <= PADDLE_Y + PADDLE_H + 6 && b.x >= px0 - b.r && b.x <= px0 + s.paddle.w + b.r) {
      const off = Math.max(-1, Math.min(1, (b.x - s.paddle.x) / (s.paddle.w / 2)));
      const sp = ballSpeed(s.level) * (1 + Math.min(0.35, s.chain * 0.01));
      const ang = off * (Math.PI / 3); // up to 60 degrees from vertical
      b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp; b.y = PADDLE_Y - b.r;
      s.chain = 0; ev.push('paddle');
    }
    // bricks (one per sub-step)
    for (const k of s.bricks) {
      if (!k.alive || b.x + b.r < k.x || b.x - b.r > k.x + k.w || b.y + b.r < k.y || b.y - b.r > k.y + k.h) continue;
      k.alive = false;
      const ox = Math.min(b.x + b.r - k.x, k.x + k.w - (b.x - b.r)), oy = Math.min(b.y + b.r - k.y, k.y + k.h - (b.y - b.r));
      if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
      s.chain += 1; s.score += brickPoints(k.row); ev.push('brick');
      break;
    }
    if (b.y - b.r > H) {
      s.lives -= 1; s.chain = 0; ev.push('lost-ball');
      if (s.lives <= 0) { s.over = true; ev.push('game-over'); } else { b.stuck = true; b.vx = 0; b.vy = 0; }
      return ev;
    }
  }
  if (s.bricks.every((k) => !k.alive)) {
    const next = newGame(s.level + 1, s.lives, s.score + 50 * s.level);
    Object.assign(s, next);
    ev.push('level-clear');
  }
  return ev;
}
