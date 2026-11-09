// src/lib/games/nim.ts — Nim (normal or misère) with the exact XOR strategy, plus weaker "human-like" levels.
export interface NimMove { pile: number; take: number }
export const nimSum = (piles: number[]) => piles.reduce((a, b) => a ^ b, 0);
export const total = (piles: number[]) => piles.reduce((a, b) => a + b, 0);
export function legal(piles: number[]): NimMove[] {
  const out: NimMove[] = [];
  piles.forEach((p, pile) => { for (let take = 1; take <= p; take++) out.push({ pile, take }); });
  return out;
}
export const apply = (piles: number[], m: NimMove) => piles.map((p, i) => (i === m.pile ? p - m.take : p));

/** A winning move for the player to move, or null if every move loses against perfect play. */
export function perfectMove(piles: number[], misere: boolean): NimMove | null {
  const big = piles.filter((p) => p > 1).length;
  if (misere && big <= 1) {
    // endgame: leave an odd number of 1-piles
    const ones = piles.filter((p) => p === 1).length;
    const bi = piles.findIndex((p) => p > 1);
    if (bi >= 0) return { pile: bi, take: piles[bi] - (ones % 2 === 0 ? 1 : 0) };
    if (ones % 2 === 1) return null; // an odd number of single stones left: whoever moves must take the last one
    return { pile: piles.findIndex((p) => p === 1), take: 1 };
  }
  const x = nimSum(piles);
  if (x === 0) return null;
  for (let i = 0; i < piles.length; i++) { const t = piles[i] ^ x; if (t < piles[i]) return { pile: i, take: piles[i] - t }; }
  return null;
}
export function aiMove(piles: number[], misere: boolean, accuracy: number, rand: () => number = Math.random): NimMove {
  const p = perfectMove(piles, misere);
  if (p && rand() < accuracy) return p;
  const ms = legal(piles);
  return ms[Math.floor(rand() * ms.length)];
}
export const LEVELS = [
  { id: 'easy', label: 'Casual', accuracy: 0.25 },
  { id: 'medium', label: 'Sharp', accuracy: 0.75 },
  { id: 'hard', label: 'Perfect', accuracy: 1 },
] as const;
export type NimLevel = (typeof LEVELS)[number]['id'];
export const randomPiles = (rand: () => number = Math.random): number[] => {
  for (;;) { const k = 3 + Math.floor(rand() * 2); const p = Array.from({ length: k }, () => 1 + Math.floor(rand() * 7)); if (nimSum(p) !== 0) return p; }
};
