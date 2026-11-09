// src/lib/games/lightsout.ts — Lights Out on an n×n grid. Toggling a cell flips it and its 4 neighbours.
// The optimal solution is found by Gaussian elimination over GF(2); free variables are enumerated so the
// fewest-press solution is returned.
export type Grid = Uint8Array;
export const press = (g: Grid, n: number, i: number): Grid => {
  const o = new Uint8Array(g); const r = (i / n) | 0, c = i % n;
  o[i] ^= 1;
  if (r > 0) o[i - n] ^= 1; if (r < n - 1) o[i + n] ^= 1; if (c > 0) o[i - 1] ^= 1; if (c < n - 1) o[i + 1] ^= 1;
  return o;
};
export const isSolved = (g: Grid) => g.every((v) => v === 0);
export const lit = (g: Grid) => g.reduce((a, v) => a + v, 0);

/** Minimal set of cells to press (indexes), or null if the position is unsolvable. */
export function solve(g: Grid, n: number): number[] | null {
  const m = n * n;
  // Row j of the matrix: which presses affect light j. Augmented column = light state.
  const rows: number[][] = [];
  for (let j = 0; j < m; j++) {
    const row = new Array(m + 1).fill(0);
    const r = (j / n) | 0, c = j % n;
    row[j] = 1;
    if (r > 0) row[j - n] = 1; if (r < n - 1) row[j + n] = 1; if (c > 0) row[j - 1] = 1; if (c < n - 1) row[j + 1] = 1;
    row[m] = g[j];
    rows.push(row);
  }
  const pivotCol: number[] = []; let rank = 0;
  for (let col = 0; col < m && rank < m; col++) {
    let p = -1;
    for (let r = rank; r < m; r++) if (rows[r][col]) { p = r; break; }
    if (p < 0) continue;
    [rows[rank], rows[p]] = [rows[p], rows[rank]];
    for (let r = 0; r < m; r++) if (r !== rank && rows[r][col]) for (let k = col; k <= m; k++) rows[r][k] ^= rows[rank][k];
    pivotCol.push(col); rank++;
  }
  for (let r = rank; r < m; r++) if (rows[r][m]) return null;
  const isPivot = new Set(pivotCol);
  const free = []; for (let c = 0; c < m; c++) if (!isPivot.has(c)) free.push(c);
  if (free.length > 12) return null;
  let best: number[] | null = null;
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const x = new Array(m).fill(0);
    free.forEach((f, k) => { x[f] = (mask >> k) & 1; });
    for (let r = 0; r < rank; r++) {
      let v = rows[r][m];
      for (const f of free) if (rows[r][f] && x[f]) v ^= 1;
      x[pivotCol[r]] = v;
    }
    const presses = x.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    if (!best || presses.length < best.length) best = presses;
  }
  return best;
}

/** A solvable random puzzle of difficulty `presses` random presses from the solved board. */
export function scramble(n: number, presses: number, rand: () => number = Math.random): Grid {
  let g: Grid = new Uint8Array(n * n);
  const chosen = new Set<number>();
  while (chosen.size < Math.min(presses, n * n)) chosen.add(Math.floor(rand() * n * n));
  for (const i of chosen) g = press(g, n, i);
  return isSolved(g) ? scramble(n, presses, rand) : g;
}
export const SIZES = [{ id: '3', label: '3×3', n: 3, presses: 4 }, { id: '5', label: '5×5', n: 5, presses: 9 }, { id: '7', label: '7×7', n: 7, presses: 16 }] as const;
