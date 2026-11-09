// src/lib/games/twentyfour.ts — The 24 game: combine four numbers with + − × ÷ and parentheses to make 24.
// Includes an exhaustive solver (exact rational arithmetic) and a safe expression parser (no eval).
export const TARGET = 24;
type Frac = { n: number; d: number };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const mk = (n: number, d: number): Frac => { const g = gcd(n, d) || 1; return d < 0 ? { n: -n / g, d: -d / g } : { n: n / g, d: d / g }; };

export function solve(nums: number[], target = TARGET): string | null {
  type Item = { v: Frac; s: string };
  const rec = (items: Item[]): string | null => {
    if (items.length === 1) return items[0].v.n === target * items[0].v.d ? items[0].s : null;
    for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const a = items[i], b = items[j];
      const rest = items.filter((_, k) => k !== i && k !== j);
      const ops: Array<[Frac, string] | null> = [
        j > i ? [mk(a.v.n * b.v.d + b.v.n * a.v.d, a.v.d * b.v.d), '+'] : null,
        [mk(a.v.n * b.v.d - b.v.n * a.v.d, a.v.d * b.v.d), '-'],
        j > i ? [mk(a.v.n * b.v.n, a.v.d * b.v.d), '×'] : null,
        b.v.n !== 0 ? [mk(a.v.n * b.v.d, a.v.d * b.v.n), '÷'] : null,
      ];
      for (const o of ops) { if (!o) continue; const r = rec([...rest, { v: o[0], s: `(${a.s} ${o[1]} ${b.s})` }]); if (r) return r; }
    }
    return null;
  };
  const r = rec(nums.map((x) => ({ v: mk(x, 1), s: String(x) })));
  return r && r.length > 2 && r.startsWith('(') && r.endsWith(')') ? r.slice(1, -1) : r;
}

/** Evaluate a typed expression using exactly the given numbers. Returns {ok, value} or an error message. */
export function check(expr: string, nums: number[]): { ok: boolean; value?: number; error?: string } {
  const src = expr.replace(/×|x|\*/g, '*').replace(/÷|:/g, '/').replace(/−|–/g, '-').replace(/\s+/g, '');
  if (!src) return { ok: false, error: 'Type an expression, e.g. (8 ÷ (3 − 8 ÷ 3))' };
  if (/[^0-9+\-*/().]/.test(src)) return { ok: false, error: 'Only numbers, + − × ÷ and brackets are allowed.' };
  const used: number[] = [];
  let pos = 0; let err = '';
  const peek = () => src[pos];
  const num = (): Frac => {
    const m = /^\d+/.exec(src.slice(pos));
    if (!m) { err = err || 'Expected a number.'; return mk(0, 1); }
    pos += m[0].length; used.push(parseInt(m[0], 10)); return mk(parseInt(m[0], 10), 1);
  };
  const atom = (): Frac => {
    if (peek() === '(') { pos++; const v = add(); if (peek() === ')') pos++; else err = err || 'Missing )'; return v; }
    if (peek() === '-') { pos++; const v = atom(); return mk(-v.n, v.d); }
    return num();
  };
  const mul = (): Frac => {
    let v = atom();
    while (peek() === '*' || peek() === '/') {
      const op = src[pos++]; const w = atom();
      if (op === '*') v = mk(v.n * w.n, v.d * w.d);
      else if (w.n === 0) { err = err || 'Division by zero.'; } else v = mk(v.n * w.d, v.d * w.n);
    }
    return v;
  };
  const add = (): Frac => {
    let v = mul();
    while (peek() === '+' || peek() === '-') { const op = src[pos++]; const w = mul(); v = op === '+' ? mk(v.n * w.d + w.n * v.d, v.d * w.d) : mk(v.n * w.d - w.n * v.d, v.d * w.d); }
    return v;
  };
  const v = add();
  if (!err && pos < src.length) err = 'Unexpected "' + src[pos] + '".';
  if (err) return { ok: false, error: err };
  const a = [...used].sort((x, y) => x - y).join(), b = [...nums].sort((x, y) => x - y).join();
  if (a !== b) return { ok: false, error: `Use each of ${nums.join(', ')} exactly once.` };
  const value = v.n / v.d;
  return { ok: v.n === TARGET * v.d, value };
}

/** A random solvable set. `hard` favours sets with a single solution form (harder to spot). */
export function deal(rand: () => number = Math.random, hard = false): { nums: number[]; solution: string } {
  for (let tries = 0; tries < 400; tries++) {
    const nums = Array.from({ length: 4 }, () => 1 + Math.floor(rand() * 13));
    const sol = solve(nums);
    if (!sol) continue;
    if (hard && /^\(?\d+ [+×] \d+\)? [+×]/.test(sol) && tries < 300) continue;
    return { nums, solution: sol };
  }
  return { nums: [4, 7, 8, 8], solution: '(7 - 8 ÷ 8) × 4' };
}
