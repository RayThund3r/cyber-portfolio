// src/lib/snakeDemo.ts — tiny self-playing snake for the home-page games preview (pure, deterministic, tested).
export interface DemoState { w: number; h: number; snake: Array<[number, number]>; food: [number, number]; seed: number; score: number }

function rnd(seed: number): [number, number] { let t = (seed + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (seed + 0x6d2b79f5) | 0]; }

export function newDemo(w = 16, h = 9): DemoState {
  const s: DemoState = { w, h, snake: [[3, Math.floor(h / 2)], [2, Math.floor(h / 2)], [1, Math.floor(h / 2)]], food: [0, 0], seed: 7, score: 0 };
  placeFood(s);
  return s;
}

function placeFood(s: DemoState) {
  for (let i = 0; i < 200; i++) {
    const [a, n1] = rnd(s.seed); const [b, n2] = rnd(n1); s.seed = n2;
    const x = Math.floor(a * s.w), y = Math.floor(b * s.h);
    if (!s.snake.some(([sx, sy]) => sx === x && sy === y)) { s.food = [x, y]; return; }
  }
}

const DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Breadth-first path to the food, avoiding the body; falls back to the roomiest safe move. */
function nextMove(s: DemoState): [number, number] | null {
  const key = (x: number, y: number) => y * s.w + x;
  const blocked = new Set(s.snake.slice(0, -1).map(([x, y]) => key(x, y)));
  const [hx, hy] = s.snake[0];
  const prev = new Map<number, number>();
  const q: Array<[number, number]> = [[hx, hy]];
  prev.set(key(hx, hy), -1);
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === s.food[0] && y === s.food[1]) {
      let k = key(x, y), first = k;
      while (prev.get(k) !== key(hx, hy) && prev.get(k) !== -1) { first = k; k = prev.get(k)!; }
      if (k === key(hx, hy)) first = key(x, y) === key(hx, hy) ? first : first;
      return [first % s.w, Math.floor(first / s.w)];
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
      const k = key(nx, ny);
      if (blocked.has(k) || prev.has(k)) continue;
      prev.set(k, key(x, y));
      q.push([nx, ny]);
    }
  }
  for (const [dx, dy] of DIRS) {
    const nx = hx + dx, ny = hy + dy;
    if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h && !blocked.has(key(nx, ny))) return [nx, ny];
  }
  return null;
}

/** One step. Restarts a fresh game when the snake is stuck or fills a good part of the board. */
export function stepDemo(s: DemoState): DemoState {
  const m = nextMove(s);
  if (!m || s.snake.length > s.w * s.h * 0.45) return { ...newDemo(s.w, s.h), seed: s.seed + 13 };
  const ate = m[0] === s.food[0] && m[1] === s.food[1];
  const snake: Array<[number, number]> = [m, ...s.snake];
  if (!ate) snake.pop();
  const n: DemoState = { ...s, snake, score: s.score + (ate ? 1 : 0) };
  if (ate) placeFood(n);
  return n;
}
