// src/lib/games/sudoku.ts — Sudoku generator (always a UNIQUE solution, graded by the human techniques needed),
// a technique-aware logic solver (singles, locked candidates, pairs, triples, X-Wing) and explained hints.
// Grid = number[81], 0 = empty.
export type Grid = number[];
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export const CLUES: Record<Difficulty, number> = { easy: 40, medium: 34, hard: 30, expert: 26 };

const ROW = (i: number) => Math.floor(i / 9), COL = (i: number) => i % 9, BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
export const peers: number[][] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>();
  for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j);
  return [...s];
});

export function candidates(g: Grid, i: number): number[] {
  if (g[i]) return [];
  const used = new Set<number>();
  for (const p of peers[i]) if (g[p]) used.add(g[p]);
  const out: number[] = [];
  for (let n = 1; n <= 9; n++) if (!used.has(n)) out.push(n);
  return out;
}

/** Counts solutions up to `limit` (2 is enough to prove uniqueness). Fills `out` with the first one found. */
export function countSolutions(g: Grid, limit = 2, out?: Grid, rand?: () => number): number {
  const grid = g.slice();
  let found = 0;
  const go = (): void => {
    if (found >= limit) return;
    let best = -1, bestC: number[] | null = null;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const c = candidates(grid, i);
      if (!c.length) return;
      if (!bestC || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
    }
    if (best < 0) { found++; if (out && found === 1) for (let i = 0; i < 81; i++) out[i] = grid[i]; return; }
    const order = bestC!.slice();
    if (rand) for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    for (const n of order) { grid[best] = n; go(); if (found >= limit) { grid[best] = 0; return; } }
    grid[best] = 0;
  };
  go();
  return found;
}

export const solve = (g: Grid): Grid | null => { const out: Grid = Array(81).fill(0); return countSolutions(g, 1, out) ? out : null; };

export function isValidFull(g: Grid): boolean {
  for (let i = 0; i < 81; i++) { if (!g[i]) return false; for (const p of peers[i]) if (g[p] === g[i]) return false; }
  return true;
}


/* ------------------------------------------------------------------------------------------------
 * Human-technique solver
 * ---------------------------------------------------------------------------------------------- */
export type Tech = 'naked-single' | 'hidden-single' | 'locked-candidates' | 'naked-pair' | 'hidden-pair' | 'naked-triple' | 'x-wing';
export const TECH_LEVEL: Record<Tech, number> = { 'naked-single': 1, 'hidden-single': 2, 'locked-candidates': 3, 'naked-pair': 4, 'hidden-pair': 4, 'naked-triple': 5, 'x-wing': 6 };
export const TECH_NAME: Record<Tech, string> = {
  'naked-single': 'Naked single', 'hidden-single': 'Hidden single', 'locked-candidates': 'Locked candidates', 'naked-pair': 'Naked pair',
  'hidden-pair': 'Hidden pair', 'naked-triple': 'Naked triple', 'x-wing': 'X-Wing',
};

export interface Step {
  tech: Tech;
  level: number;
  place?: { index: number; value: number };
  elim?: Array<{ index: number; value: number }>;
  /** Cells that make the pattern (to highlight). */
  cells: number[];
  why: string;
}

const UNITS: number[][] = [];
const UNIT_NAME: string[] = [];
for (let k = 0; k < 9; k++) { UNITS.push(Array.from({ length: 9 }, (_, c) => k * 9 + c)); UNIT_NAME.push(`row ${k + 1}`); }
for (let k = 0; k < 9; k++) { UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + k)); UNIT_NAME.push(`column ${k + 1}`); }
for (let k = 0; k < 9; k++) {
  const br = Math.floor(k / 3) * 3, bc = (k % 3) * 3;
  UNITS.push(Array.from({ length: 9 }, (_, j) => (br + Math.floor(j / 3)) * 9 + bc + (j % 3)));
  UNIT_NAME.push(`box ${k + 1}`);
}
const POP = new Uint8Array(512);
for (let i = 1; i < 512; i++) POP[i] = POP[i >> 1] + (i & 1);
const bit = (n: number) => 1 << (n - 1);
const digitsOf = (mask: number) => { const o: number[] = []; for (let n = 1; n <= 9; n++) if (mask & bit(n)) o.push(n); return o; };
const cellName = (i: number) => `R${ROW(i) + 1}C${COL(i) + 1}`;
const list = (xs: Array<string | number>) => (xs.length <= 2 ? xs.join(' and ') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

/** Candidate bitmasks (bit n-1 = digit n) from the numbers on the grid alone. */
export function candidateMasks(g: Grid): Uint16Array {
  const c = new Uint16Array(81);
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    let m = 511;
    for (const p of peers[i]) if (g[p]) m &= ~bit(g[p]);
    c[i] = m;
  }
  return c;
}

/** Finds the easiest applicable technique (up to `maxLevel`). Candidate masks `c` are not modified. */
export function findStep(g: Grid, c: Uint16Array, maxLevel = 9): Step | null {
  // 1. naked single
  for (let i = 0; i < 81; i++) if (!g[i] && POP[c[i]] === 1) {
    const v = digitsOf(c[i])[0];
    return { tech: 'naked-single', level: 1, place: { index: i, value: v }, cells: [i], why: `${cellName(i)} can only be ${v}: every other number already appears in its row, column or box.` };
  }
  if (maxLevel < 2) return null;
  // 2. hidden single
  for (let u = 0; u < 27; u++) for (let n = 1; n <= 9; n++) {
    let only = -1, count = 0, placed = false;
    for (const i of UNITS[u]) { if (g[i] === n) { placed = true; break; } if (!g[i] && c[i] & bit(n)) { count++; only = i; } }
    if (!placed && count === 1) return { tech: 'hidden-single', level: 2, place: { index: only, value: n }, cells: [only], why: `In ${UNIT_NAME[u]}, the ${n} has nowhere else to go: ${cellName(only)} is the only cell that can hold it.` };
  }
  if (maxLevel < 3) return null;
  // 3. locked candidates (pointing and claiming)
  for (let n = 1; n <= 9; n++) {
    for (let b = 18; b < 27; b++) {
      const spots = UNITS[b].filter((i) => !g[i] && c[i] & bit(n));
      if (spots.length < 2) continue;
      for (const [kind, key, off] of [['row', ROW, 0], ['column', COL, 9]] as const) {
        const line = key(spots[0]);
        if (!spots.every((i) => key(i) === line)) continue;
        const elim = UNITS[off + line].filter((i) => BOX(i) !== b - 18 && !g[i] && c[i] & bit(n)).map((i) => ({ index: i, value: n }));
        if (elim.length) return { tech: 'locked-candidates', level: 3, elim, cells: spots, why: `In ${UNIT_NAME[b]}, the ${n} must go in ${kind} ${line + 1} (${list(spots.map(cellName))}), so no other cell of that ${kind} can be ${n}.` };
      }
    }
    for (let u = 0; u < 18; u++) {
      const spots = UNITS[u].filter((i) => !g[i] && c[i] & bit(n));
      if (spots.length < 2) continue;
      const box = BOX(spots[0]);
      if (!spots.every((i) => BOX(i) === box)) continue;
      const elim = UNITS[18 + box].filter((i) => !UNITS[u].includes(i) && !g[i] && c[i] & bit(n)).map((i) => ({ index: i, value: n }));
      if (elim.length) return { tech: 'locked-candidates', level: 3, elim, cells: spots, why: `In ${UNIT_NAME[u]}, the ${n} can only be inside box ${box + 1} (${list(spots.map(cellName))}), so the rest of that box cannot be ${n}.` };
    }
  }
  if (maxLevel < 4) return null;
  // 4. naked pair, hidden pair
  for (let u = 0; u < 27; u++) {
    const cells = UNITS[u].filter((i) => !g[i] && POP[c[i]] === 2);
    for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
      if (c[cells[a]] !== c[cells[b]]) continue;
      const m = c[cells[a]];
      const elim: Array<{ index: number; value: number }> = [];
      for (const i of UNITS[u]) if (i !== cells[a] && i !== cells[b] && !g[i]) for (const d of digitsOf(m & c[i])) elim.push({ index: i, value: d });
      if (elim.length) { const d = digitsOf(m); return { tech: 'naked-pair', level: 4, elim, cells: [cells[a], cells[b]], why: `${cellName(cells[a])} and ${cellName(cells[b])} can only hold ${d[0]} and ${d[1]} between them, so those two numbers can be removed from the other cells in ${UNIT_NAME[u]}.` }; }
    }
  }
  for (let u = 0; u < 27; u++) {
    const where: number[][] = Array.from({ length: 10 }, () => []);
    for (const i of UNITS[u]) if (!g[i]) for (const d of digitsOf(c[i])) where[d].push(i);
    for (let d1 = 1; d1 <= 9; d1++) for (let d2 = d1 + 1; d2 <= 9; d2++) {
      const w1 = where[d1], w2 = where[d2];
      if (w1.length !== 2 || w2.length !== 2 || w1[0] !== w2[0] || w1[1] !== w2[1]) continue;
      const keep = bit(d1) | bit(d2);
      const elim: Array<{ index: number; value: number }> = [];
      for (const i of w1) for (const d of digitsOf(c[i] & ~keep)) elim.push({ index: i, value: d });
      if (elim.length) return { tech: 'hidden-pair', level: 4, elim, cells: [...w1], why: `In ${UNIT_NAME[u]}, ${d1} and ${d2} only fit in ${cellName(w1[0])} and ${cellName(w1[1])}, so those two cells can hold nothing else.` };
    }
  }
  if (maxLevel < 5) return null;
  // 5. naked triple
  for (let u = 0; u < 27; u++) {
    const cells = UNITS[u].filter((i) => !g[i] && POP[c[i]] >= 2 && POP[c[i]] <= 3);
    for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) for (let d = b + 1; d < cells.length; d++) {
      const m = c[cells[a]] | c[cells[b]] | c[cells[d]];
      if (POP[m] !== 3) continue;
      const elim: Array<{ index: number; value: number }> = [];
      for (const i of UNITS[u]) if (i !== cells[a] && i !== cells[b] && i !== cells[d] && !g[i]) for (const x of digitsOf(m & c[i])) elim.push({ index: i, value: x });
      if (elim.length) return { tech: 'naked-triple', level: 5, elim, cells: [cells[a], cells[b], cells[d]], why: `${list([cells[a], cells[b], cells[d]].map(cellName))} share only the numbers ${list(digitsOf(m))}, so those can be removed from the rest of ${UNIT_NAME[u]}.` };
    }
  }
  if (maxLevel < 6) return null;
  // 6. X-Wing (rows and columns)
  for (let n = 1; n <= 9; n++) for (const [byRow, off] of [[true, 0], [false, 9]] as const) {
    const lines: Array<{ k: number; pos: number[] }> = [];
    for (let k = 0; k < 9; k++) {
      const pos = UNITS[off + k].filter((i) => !g[i] && c[i] & bit(n)).map((i) => (byRow ? COL(i) : ROW(i)));
      if (pos.length === 2) lines.push({ k, pos });
    }
    for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
      if (lines[a].pos[0] !== lines[b].pos[0] || lines[a].pos[1] !== lines[b].pos[1]) continue;
      const elim: Array<{ index: number; value: number }> = [];
      for (const p of lines[a].pos) {
        const crossing = UNITS[(byRow ? 9 : 0) + p];
        for (const i of crossing) {
          const lineIdx = byRow ? ROW(i) : COL(i);
          if (lineIdx !== lines[a].k && lineIdx !== lines[b].k && !g[i] && c[i] & bit(n)) elim.push({ index: i, value: n });
        }
      }
      if (elim.length) {
        const corners = [lines[a].k, lines[b].k].flatMap((k) => lines[a].pos.map((p) => (byRow ? k * 9 + p : p * 9 + k)));
        const kind = byRow ? 'rows' : 'columns', cross = byRow ? 'columns' : 'rows';
        return { tech: 'x-wing', level: 6, elim, cells: corners, why: `X-Wing on ${n}: in ${kind} ${lines[a].k + 1} and ${lines[b].k + 1} the ${n} can only sit in ${cross} ${lines[a].pos[0] + 1} and ${lines[a].pos[1] + 1}, so it can be removed from the rest of those ${cross}.` };
      }
    }
  }
  return null;
}

function applyStep(g: Grid, c: Uint16Array, st: Step) {
  if (st.place) {
    const { index, value } = st.place;
    g[index] = value; c[index] = 0;
    for (const p of peers[index]) c[p] &= ~bit(value);
  }
  if (st.elim) for (const e of st.elim) c[e.index] &= ~bit(e.value);
}

export interface Rating { solved: boolean; level: number; steps: number; techs: Tech[] }
/** Solves with human techniques only; reports the hardest technique needed. */
export function rate(puzzle: Grid, maxLevel = 9): Rating {
  const g = puzzle.slice(), c = candidateMasks(g);
  let level = 0, steps = 0;
  const used = new Set<Tech>();
  for (let guard = 0; guard < 400; guard++) {
    if (g.every(Boolean)) return { solved: true, level, steps, techs: [...used] };
    const st = findStep(g, c, maxLevel);
    if (!st) return { solved: false, level, steps, techs: [...used] };
    applyStep(g, c, st);
    level = Math.max(level, st.level); steps++; used.add(st.tech);
  }
  return { solved: false, level, steps, techs: [...used] };
}

/** [maximum technique level allowed, minimum level required, clue floor] per difficulty. */
const GRADE: Record<Difficulty, { max: number; min: number; floor: number }> = {
  easy: { max: 2, min: 1, floor: 36 },
  medium: { max: 3, min: 3, floor: 30 },
  hard: { max: 5, min: 4, floor: 26 },
  expert: { max: 6, min: 5, floor: 22 },
};

export function generate(diff: Difficulty, rand: () => number = Math.random, budgetMs = 1500): { puzzle: Grid; solution: Grid; rating: Rating } {
  const G = GRADE[diff];
  const t0 = Date.now();
  let fallback: { puzzle: Grid; solution: Grid; rating: Rating; score: number } | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const solution: Grid = Array(81).fill(0);
    countSolutions(Array(81).fill(0), 1, solution, rand);
    const puzzle = solution.slice();
    const order = Array.from({ length: 81 }, (_, i) => i);
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    let clues = 81;
    const tryRemove = (cells: number[]) => {
      const kept = cells.map((i) => puzzle[i]);
      cells.forEach((i) => (puzzle[i] = 0));
      if (countSolutions(puzzle, 2) === 1 && rate(puzzle, G.max).solved) return true;
      cells.forEach((i, k) => (puzzle[i] = kept[k]));
      return false;
    };
    for (const i of order) {
      if (clues <= G.floor) break;
      if (!puzzle[i]) continue;
      const mirror = 80 - i;
      if (mirror !== i && puzzle[mirror] && clues - 2 >= G.floor && tryRemove([i, mirror])) { clues -= 2; continue; }
      if (tryRemove([i])) clues -= 1;
    }
    const rating = rate(puzzle, 9);
    const fits = rating.solved && rating.level >= G.min && rating.level <= G.max;
    if (fits) return { puzzle, solution, rating };
    const score = rating.solved ? -Math.abs(rating.level - G.min) : -99;
    if (!fallback || score > fallback.score) fallback = { puzzle: puzzle.slice(), solution, rating, score };
    if (Date.now() - t0 > budgetMs) break;
  }
  return { puzzle: fallback!.puzzle, solution: fallback!.solution, rating: fallback!.rating };
}

export interface Hint {
  index: number;
  value: number;
  why: string;
  /** 'place' puts `value` in `index`; 'eliminate' removes candidates; 'mistake' flags a wrong number; 'reveal' is the last resort. */
  kind?: 'place' | 'eliminate' | 'mistake' | 'reveal';
  technique?: string;
  cells?: number[];
  elim?: Array<{ index: number; value: number }>;
}

/**
 * A human-style hint. Wrong numbers are reported first (logic from a wrong grid is meaningless); then the
 * easiest technique that makes progress is explained: naked/hidden single, locked candidates, pairs, triples,
 * X-Wing. Only when none applies does it fall back to revealing a solution value.
 */
export function hint(g: Grid, solution: Grid, givens?: Grid): Hint | null {
  for (let i = 0; i < 81; i++) if (g[i] && g[i] !== solution[i] && !(givens && givens[i])) {
    return { index: i, value: 0, kind: 'mistake', cells: [i], technique: 'Check your work', why: `${cellName(i)} does not look right: with that number the puzzle can no longer be finished. Clear it or try another value.` };
  }
  const c = candidateMasks(g);
  const st = findStep(g, c);
  if (st) {
    if (st.place) return { index: st.place.index, value: st.place.value, kind: 'place', technique: TECH_NAME[st.tech], cells: st.cells, why: st.why };
    return { index: st.cells[0], value: 0, kind: 'eliminate', technique: TECH_NAME[st.tech], cells: st.cells, elim: st.elim, why: st.why + ' Press Apply to update your notes.' };
  }
  const i = g.findIndex((v) => !v);
  return i >= 0 ? { index: i, value: solution[i], kind: 'reveal', technique: 'Advanced', cells: [i], why: 'No standard technique applies here (this needs a longer chain or a trial), so this is the value from the solution.' } : null;
}

export function conflicts(g: Grid): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < 81; i++) if (g[i]) for (const p of peers[i]) if (g[p] === g[i]) { bad.add(i); bad.add(p); }
  return bad;
}
