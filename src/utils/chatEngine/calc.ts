// src/utils/chatEngine/calc.ts
//
// Safe calculator (no eval). Handles things like:
//   "what is 15% of 450"   "12*(3+4)"   "2^10"   "5 plus 7"   "1,200 / 4"
// Small language models are unreliable at arithmetic, so this runs BEFORE the AI.

export interface CalcResult {
  expr: string;
  value: number;
}

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string };

function lex(s: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      if ((raw.match(/\./g) || []).length > 1 || raw === '.') return null;
      out.push({ t: 'num', v: parseFloat(raw) });
      i = j;
    } else if ('+-*/^%()'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else {
      return null;
    }
  }
  return out;
}

function evaluate(tokens: Tok[]): number {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as any).v === v;

  // expr   := term (('+' | '-') term)*
  // term   := unary (('*' | '/' | '%') unary)*
  // unary  := '-' unary | power
  // power  := atom ('^' unary)?
  // atom   := number | '(' expr ')'
  function expr(): number {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as any).v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = (tokens[pos++] as any).v;
      const r = unary();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  }
  function unary(): number {
    if (isOp('-')) {
      pos++;
      return -unary();
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return power();
  }
  function power(): number {
    const base = atom();
    if (isOp('^')) {
      pos++;
      return Math.pow(base, unary());
    }
    return base;
  }
  function atom(): number {
    const tk = peek();
    if (!tk) throw new Error('unexpected end');
    if (tk.t === 'num') {
      pos++;
      return tk.v;
    }
    if (isOp('(')) {
      pos++;
      const v = expr();
      if (!isOp(')')) throw new Error('missing )');
      pos++;
      return v;
    }
    throw new Error('unexpected token');
  }

  const result = expr();
  if (pos !== tokens.length) throw new Error('trailing tokens');
  return result;
}

const CUE = /^(?:what(?:'s| is)|whats|calculate|calc|compute|solve|work out|how much is|evaluate)\s+/;

export function tryCalculate(input: string): CalcResult | null {
  let s = input.toLowerCase().trim().replace(/[?!]+$/, '').trim();
  const hadCue = CUE.test(s);
  s = s.replace(CUE, '').replace(/=\s*$/, '').trim();
  if (!s || s.length > 80) return null;

  // "15% of 450" / "15 percent of 450"
  const pm = s.match(/^(\d+(?:\.\d+)?)\s*(?:%|percent|per cent)\s+of\s+(\d[\d,]*(?:\.\d+)?)$/);
  if (pm) {
    const pct = parseFloat(pm[1]);
    const base = parseFloat(pm[2].replace(/,/g, ''));
    return { expr: `${pm[1]}% of ${pm[2]}`, value: (pct / 100) * base };
  }

  const shown = s;
  s = s
    .replace(/\bmultiplied by\b|\btimes\b/g, '*')
    .replace(/\bdivided by\b|\bover\b/g, '/')
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\bto the power of\b|\bpower\b/g, '^')
    .replace(/\bmod(?:ulo)?\b/g, '%')
    .replace(/÷/g, '/')
    .replace(/(\d)\s*[x×]\s*(?=[\d(])/g, '$1*')
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1');

  if (!/^[\d\s+\-*/().^%]+$/.test(s) || !/\d/.test(s)) return null;

  // Not a calculation: dates (10/14/2026), phone-ish strings, plain numbers.
  if (/^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/.test(s)) return null;
  const hasOperator =
    /[+*/^%()]/.test(s) || /\s-\s/.test(s) || (hadCue && /\d\s*-\s*\d/.test(s)) || /\d\s*-\s*\(/.test(s);
  if (!hasOperator) return null;

  const toks = lex(s);
  if (!toks) return null;
  try {
    const value = evaluate(toks);
    return { expr: shown.replace(/\s+/g, ' '), value };
  } catch {
    return null;
  }
}

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return Number(n.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: 10 });
}
