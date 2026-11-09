// src/lib/games/mathsprint.ts — mental-arithmetic question generator. Always whole-number answers.
export type MathLevel = 'warmup' | 'normal' | 'brutal';
export interface Question { text: string; answer: number }

export function question(level: MathLevel, rand: () => number = Math.random): Question {
  const r = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const ops = level === 'warmup' ? ['+', '-'] : level === 'normal' ? ['+', '-', '×', '÷'] : ['+', '-', '×', '÷', '²', 'mix'];
  const op = ops[r(0, ops.length - 1)];
  const big = level === 'warmup' ? 20 : level === 'normal' ? 60 : 150;
  const mul = level === 'warmup' ? 5 : level === 'normal' ? 12 : 19;
  switch (op) {
    case '+': { const a = r(2, big), b = r(2, big); return { text: `${a} + ${b}`, answer: a + b }; }
    case '-': { const a = r(2, big), b = r(1, a); return { text: `${a} − ${b}`, answer: a - b }; }
    case '×': { const a = r(2, mul), b = r(2, mul); return { text: `${a} × ${b}`, answer: a * b }; }
    case '÷': { const b = r(2, mul), q = r(2, mul); return { text: `${b * q} ÷ ${b}`, answer: q }; }
    case '²': { const a = r(3, 15); return { text: `${a}²`, answer: a * a }; }
    default: { const a = r(2, 12), b = r(2, 12), c = r(2, 30); return { text: `${a} × ${b} + ${c}`, answer: a * b + c }; }
  }
}
export const SECONDS = 60;
export function points(streak: number, level: MathLevel): number {
  return Math.round((10 + Math.min(streak, 10) * 2) * (level === 'warmup' ? 1 : level === 'normal' ? 1.5 : 2));
}
