// src/lib/games/whack.ts — pure Whack-a-Mole: nine holes, moles/golden moles/bombs pop up for a short time.
import { Rng, randInt } from './rng';

export const HOLES = 9;
export const DURATION = 30;
export type Kind = 'mole' | 'golden' | 'bomb';
export interface Popup { hole: number; kind: Kind; ttl: number; whacked: boolean }
export interface WhackState { time: number; popups: Popup[]; score: number; streak: number; bestStreak: number; hits: number; misses: number; bombs: number; spawnIn: number; over: boolean }
export type WhackEvent = 'spawn' | 'hit' | 'golden' | 'bomb' | 'miss' | 'escaped' | 'over';

export const newGame = (): WhackState => ({ time: DURATION, popups: [], score: 0, streak: 0, bestStreak: 0, hits: 0, misses: 0, bombs: 0, spawnIn: 0.4, over: false });

/** Pop-up life shrinks and spawn gaps tighten as the clock runs down. */
export function pace(time: number): { ttl: number; gap: number } {
  const k = 1 - time / DURATION; // 0 -> 1
  return { ttl: 1.15 - k * 0.55, gap: 0.75 - k * 0.45 };
}

export function step(s: WhackState, dt: number, rng: Rng): WhackEvent[] {
  const ev: WhackEvent[] = [];
  if (s.over) return ev;
  dt = Math.min(dt, 0.1);
  s.time = Math.max(0, s.time - dt);
  for (const p of s.popups) p.ttl -= dt;
  const gone = s.popups.filter((p) => p.ttl <= 0);
  for (const p of gone) if (!p.whacked && p.kind !== 'bomb') { s.streak = 0; ev.push('escaped'); }
  s.popups = s.popups.filter((p) => p.ttl > 0);
  s.spawnIn -= dt;
  if (s.spawnIn <= 0 && s.time > 0) {
    const pc = pace(s.time);
    const free = Array.from({ length: HOLES }, (_, i) => i).filter((i) => !s.popups.some((p) => p.hole === i));
    if (free.length) {
      const r = rng();
      const kind: Kind = r < 0.14 ? 'bomb' : r < 0.22 ? 'golden' : 'mole';
      s.popups.push({ hole: free[randInt(rng, free.length)], kind, ttl: pc.ttl, whacked: false });
      ev.push('spawn');
    }
    s.spawnIn = pc.gap * (0.7 + rng() * 0.6);
  }
  if (s.time <= 0) { s.over = true; ev.push('over'); }
  return ev;
}

export function whack(s: WhackState, hole: number): WhackEvent {
  if (s.over) return 'miss';
  const p = s.popups.find((x) => x.hole === hole && !x.whacked);
  if (!p) { s.misses += 1; s.streak = 0; return 'miss'; }
  p.whacked = true; p.ttl = Math.min(p.ttl, 0.18);
  if (p.kind === 'bomb') { s.score = Math.max(0, s.score - 20); s.streak = 0; s.bombs += 1; return 'bomb'; }
  const mult = 1 + Math.min(4, Math.floor(s.streak / 5)) * 0.25;
  s.score += Math.round((p.kind === 'golden' ? 30 : 10) * mult);
  s.streak += 1; s.hits += 1; s.bestStreak = Math.max(s.bestStreak, s.streak);
  return p.kind === 'golden' ? 'golden' : 'hit';
}
