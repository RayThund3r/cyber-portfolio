// src/lib/games/tictactoe.ts — Tic-Tac-Toe with a full minimax AI (cannot be beaten on "Perfect").
export type Mark = 'X' | 'O' | '';
export const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function winner(b: Mark[]): { mark: 'X' | 'O'; line: number[] } | null {
  for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { mark: b[l[0]] as 'X' | 'O', line: l };
  return null;
}
export const full = (b: Mark[]) => b.every(Boolean);

/** Minimax score for `me`: +1 win, 0 draw, -1 loss, preferring faster wins / slower losses. */
function minimax(b: Mark[], turn: 'X' | 'O', me: 'X' | 'O', depth: number): number {
  const w = winner(b);
  if (w) return w.mark === me ? 10 - depth : depth - 10;
  if (full(b)) return 0;
  let best = turn === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const sc = minimax(b, turn === 'X' ? 'O' : 'X', me, depth + 1);
    b[i] = '';
    best = turn === me ? Math.max(best, sc) : Math.min(best, sc);
  }
  return best;
}

export function moveScores(b: Mark[], me: 'X' | 'O'): Record<number, number> {
  const out: Record<number, number> = {};
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = me;
    out[i] = minimax(b, me === 'X' ? 'O' : 'X', me, 1);
    b[i] = '';
  }
  return out;
}

export type TttLevel = 'easy' | 'medium' | 'perfect';

export function aiMove(board: Mark[], me: 'X' | 'O', level: TttLevel, rand: () => number = Math.random): number {
  const free = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (level === 'easy' && rand() < 0.75) {
    // still takes a win in one so it does not look broken
    const sc = moveScores(board, me);
    const win = free.find((i) => sc[i] >= 9);
    return win ?? free[Math.floor(rand() * free.length)];
  }
  if (level === 'medium' && rand() < 0.35) return free[Math.floor(rand() * free.length)];
  const sc = moveScores(board, me);
  const best = Math.max(...free.map((i) => sc[i]));
  const pool = free.filter((i) => sc[i] === best);
  return pool[Math.floor(rand() * pool.length)];
}
