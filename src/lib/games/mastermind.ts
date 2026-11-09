// src/lib/games/mastermind.ts — Mastermind / Code-breaker. Includes Knuth's minimax solver (worst case 5 guesses
// for the classic 4 pegs × 6 colours) and a consistent-guess solver for bigger variants.
export interface MmConfig { pegs: number; colors: number }
export const CLASSIC: MmConfig = { pegs: 4, colors: 6 };
export type Code = number[];
export interface Fb { black: number; white: number }

export function score(secret: Code, guess: Code, colors = 8): Fb {
  let black = 0;
  const cs = new Array(colors).fill(0), cg = new Array(colors).fill(0);
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) black++;
    else { cs[secret[i]]++; cg[guess[i]]++; }
  }
  let white = 0;
  for (let c = 0; c < colors; c++) white += Math.min(cs[c], cg[c]);
  return { black, white };
}
const fbKey = (f: Fb) => f.black * 10 + f.white;

export function allCodes(cfg: MmConfig): Code[] {
  const out: Code[] = [];
  const rec = (cur: Code) => {
    if (cur.length === cfg.pegs) { out.push(cur.slice()); return; }
    for (let c = 0; c < cfg.colors; c++) { cur.push(c); rec(cur); cur.pop(); }
  };
  rec([]);
  return out;
}
export const randomCode = (cfg: MmConfig, rand: () => number = Math.random): Code => Array.from({ length: cfg.pegs }, () => Math.floor(rand() * cfg.colors));

/** Candidates still consistent with every (guess, feedback) pair so far. */
export function filterCandidates(cands: Code[], guess: Code, fb: Fb, colors: number): Code[] {
  return cands.filter((c) => { const f = score(c, guess, colors); return f.black === fb.black && f.white === fb.white; });
}

/** Worst-case partition size of `guess` against `cands` (smaller is better). */
function worstCase(guess: Code, cands: Code[], colors: number): number {
  const buckets = new Map<number, number>();
  let worst = 0;
  for (const c of cands) { const k = fbKey(score(c, guess, colors)); const n = (buckets.get(k) ?? 0) + 1; buckets.set(k, n); if (n > worst) worst = n; }
  return worst;
}

/** Next guess for the AI codebreaker (Knuth minimax when the search is small, a consistent guess otherwise). */
export function nextGuess(cfg: MmConfig, cands: Code[], turn: number): Code {
  if (turn === 0) { const g = Array.from({ length: cfg.pegs }, (_, i) => Math.floor(i / Math.ceil(cfg.pegs / 2)) % cfg.colors); return g; }
  if (cands.length <= 2) return cands[0];
  const space = cfg.colors ** cfg.pegs;
  let pool: Code[];
  if (cands.length * space <= 4_000_000) pool = allCodes(cfg);
  else { // too big to try every code: evaluate a spread of the remaining candidates (still always consistent)
    const cap = Math.max(30, Math.floor(3_000_000 / cands.length));
    pool = cands.length <= cap ? cands : Array.from({ length: cap }, (_, i) => cands[Math.floor((i * cands.length) / cap)]);
  }
  const inC = new Set(cands.map((c) => c.join('')));
  let best = cands[0], bw = Infinity, bIn = false;
  for (const g of pool) {
    const w = worstCase(g, cands, cfg.colors), isIn = inC.has(g.join(''));
    if (w < bw || (w === bw && isIn && !bIn)) { bw = w; best = g; bIn = isIn; }
  }
  return best;
}

/** Best guess for a human who asked for a hint, given their history. */
export function hintGuess(cfg: MmConfig, history: Array<{ guess: Code; fb: Fb }>): { guess: Code; remaining: number } {
  let cands = allCodes(cfg);
  for (const h of history) cands = filterCandidates(cands, h.guess, h.fb, cfg.colors);
  return { guess: nextGuess(cfg, cands, history.length), remaining: cands.length };
}
export const LEVELS = [
  { id: 'easy', label: 'Relaxed', rows: 12 },
  { id: 'medium', label: 'Standard', rows: 10 },
  { id: 'hard', label: 'Tight', rows: 8 },
] as const;
export type MmLevel = (typeof LEVELS)[number]['id'];
