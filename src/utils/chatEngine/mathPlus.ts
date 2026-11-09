// src/utils/chatEngine/mathPlus.ts
//
// Everything numeric that the basic calculator (calc.ts) does not do, with no model involved:
//   - follow-ups on the last result ("and 20% of that", "times 3", "half of that")
//   - discounts / increases / "what percent is a of b" / tip / splitting a bill
//   - functions and constants: sqrt(144)+3^2, "square root of 81", "7 squared", "5 factorial", pi
//   - averages and sums of lists
//   - unit conversion: length, weight, volume, speed, time, data size, temperature
// Pure functions. The engine calls tryMathPlus() after calc.ts has declined the message.

import { formatNumber } from './calc';

export interface MathAnswer {
  human: string;
  expert: string;
  /** Single numeric result (remembered so "and 20% of that" works). */
  value?: number;
  suggestions?: string[];
}

const fmt = (n: number) => formatNumber(Number(n.toPrecision(10)));
const num = (s: string) => parseFloat(s.replace(/,/g, ''));
const NUM = String.raw`(-?\d[\d,]*(?:\.\d+)?)`;

/* ------------------------------------------------------------------ expression parser */

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function lex(s: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') i++;
    else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      if ((raw.match(/\./g) || []).length > 1 || raw === '.') return null;
      out.push({ t: 'num', v: parseFloat(raw) });
      i = j;
    } else if (/[a-z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-z]/.test(s[j])) j++;
      out.push({ t: 'id', v: s.slice(i, j) });
      i = j;
    } else if ('+-*/^%(),!'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else return null;
  }
  return out;
}

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  ln: Math.log, log: Math.log10, exp: Math.exp,
};
const CONSTS: Record<string, number> = { pi: Math.PI };

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error('factorial range');
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function evaluate(tokens: Tok[]): number {
  let pos = 0;
  let depth = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as any).v === v;

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
    if (isOp('-')) { pos++; return -unary(); }
    if (isOp('+')) { pos++; return unary(); }
    return power();
  }
  function power(): number {
    let base = postfix();
    if (isOp('^')) { pos++; base = Math.pow(base, unary()); }
    return base;
  }
  function postfix(): number {
    let v = atom();
    while (isOp('!')) { pos++; v = factorial(v); }
    return v;
  }
  function atom(): number {
    const tk = peek();
    if (!tk) throw new Error('end');
    if (tk.t === 'num') { pos++; return tk.v; }
    if (tk.t === 'id') {
      pos++;
      if (tk.v in CONSTS) return CONSTS[tk.v];
      const fn = FUNCS[tk.v];
      if (!fn) throw new Error('unknown ' + tk.v);
      if (!isOp('(')) throw new Error('( expected');
      pos++;
      if (++depth > 20) throw new Error('too deep');
      const v = expr();
      depth--;
      if (!isOp(')')) throw new Error(') expected');
      pos++;
      return fn(v);
    }
    if (isOp('(')) {
      pos++;
      if (++depth > 20) throw new Error('too deep');
      const v = expr();
      depth--;
      if (!isOp(')')) throw new Error(') expected');
      pos++;
      return v;
    }
    throw new Error('unexpected');
  }
  const result = expr();
  if (pos !== tokens.length) throw new Error('trailing');
  return result;
}

function wordsToMath(s: string): string {
  return s
    .replace(/\bsquare root of\s+(\d[\d.,]*|\([^)]*\))/g, 'sqrt($1)')
    .replace(/\bcube root of\s+(\d[\d.,]*|\([^)]*\))/g, 'cbrt($1)')
    .replace(/(\d[\d.,]*|\([^)]*\))\s+(?:squared|to the power of 2)\b/g, '($1)^2')
    .replace(/(\d[\d.,]*|\([^)]*\))\s+cubed\b/g, '($1)^3')
    .replace(/(\d[\d.,]*)\s+factorial\b/g, '$1!')
    .replace(/\bmultiplied by\b|\btimes\b/g, '*')
    .replace(/\bdivided by\b|\bover\b/g, '/')
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\bto the power of\b/g, '^')
    .replace(/÷/g, '/')
    .replace(/(\d)\s*[x×]\s*(?=[\d(])/g, '$1*')
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1');
}

/** Expressions that need functions / constants / factorial (plain arithmetic is calc.ts's job). */
function tryExpression(s: string): MathAnswer | null {
  if (s.length > 100) return null;
  const e = wordsToMath(s);
  const toks = lex(e);
  if (!toks || !toks.length) return null;
  const hasId = toks.some((t) => t.t === 'id');
  const hasFact = toks.some((t) => t.t === 'op' && t.v === '!');
  const wordy = /\b(squared|cubed|factorial|to the power of|root of)\b/.test(s);
  if (!hasId && !hasFact && !wordy) return null;
  if (!toks.some((t) => t.t === 'num') && !toks.some((t) => t.t === 'id' && t.v === 'pi')) return null;
  try {
    const value = evaluate(toks);
    if (!Number.isFinite(value)) return null;
    const shown = s.replace(/\s+/g, ' ');
    return { human: `${shown} = **${fmt(value)}** 🧮`, expert: `CALC // ${shown} = ${fmt(value)}`, value };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ percentages, lists, splitting */

function tryPercent(s: string): MathAnswer | null {
  let m: RegExpExecArray | null;
  // "20% off 150"  /  "20 percent discount on 150"
  if ((m = new RegExp(`^${NUM}\\s*(?:%|percent|per cent)\\s*(?:off|discount(?: on| off)?)\\s*${NUM}$`).exec(s))) {
    const p = num(m[1]), base = num(m[2]);
    const saved = (p / 100) * base, value = base - saved;
    return { human: `${fmt(p)}% off ${fmt(base)}: you save **${fmt(saved)}** and pay **${fmt(value)}** 🏷️`, expert: `DISCOUNT // ${fmt(base)} - ${fmt(p)}% = ${fmt(value)} (saving ${fmt(saved)})`, value };
  }
  // "add 18% to 200" / "200 plus 18%" / "increase 200 by 18%" / "decrease 200 by 10%"
  if ((m = new RegExp(`^(?:add|plus)\\s*${NUM}\\s*(?:%|percent)\\s*to\\s*${NUM}$`).exec(s)) || (m = new RegExp(`^${NUM}\\s*(?:\\+|plus)\\s*${NUM}\\s*(?:%|percent)$`).exec(s))) {
    const first = num(m[1]), second = num(m[2]);
    const isAddFirst = /^(?:add|plus)/.test(s);
    const base = isAddFirst ? second : first, p = isAddFirst ? first : second;
    const value = base * (1 + p / 100);
    return { human: `${fmt(base)} plus ${fmt(p)}% = **${fmt(value)}** 🧮`, expert: `CALC // ${fmt(base)} * ${fmt(1 + p / 100)} = ${fmt(value)}`, value };
  }
  if ((m = new RegExp(`^(increase|decrease|reduce|raise|lower)\\s*${NUM}\\s*by\\s*${NUM}\\s*(?:%|percent)$`).exec(s))) {
    const base = num(m[2]), p = num(m[3]);
    const up = /^(increase|raise)/.test(m[1]);
    const value = base * (1 + (up ? 1 : -1) * (p / 100));
    return { human: `${m[1]} ${fmt(base)} by ${fmt(p)}% → **${fmt(value)}** 🧮`, expert: `CALC // ${fmt(base)} ${up ? '+' : '-'} ${fmt(p)}% = ${fmt(value)}`, value };
  }
  // "what percent is 30 of 120" / "30 is what percent of 120" / "30 out of 120 as a percentage"
  if (
    (m = new RegExp(`^(?:what )?(?:percent|percentage|%)\\s*is\\s*${NUM}\\s*of\\s*${NUM}$`).exec(s)) ||
    (m = new RegExp(`^${NUM}\\s*is\\s*what\\s*(?:percent|percentage|%)\\s*of\\s*${NUM}$`).exec(s)) ||
    (m = new RegExp(`^${NUM}\\s*(?:out of|/)\\s*${NUM}\\s*(?:as a )?(?:percent|percentage|%)$`).exec(s))
  ) {
    const a = num(m[1]), b = num(m[2]);
    if (b === 0) return null;
    const value = (a / b) * 100;
    return { human: `${fmt(a)} is **${fmt(value)}%** of ${fmt(b)} 🧮`, expert: `CALC // ${fmt(a)} / ${fmt(b)} = ${fmt(value)}%`, value };
  }
  // "tip 15% on 80" / "15% tip on 80"
  if ((m = new RegExp(`^(?:tip\\s*${NUM}\\s*(?:%|percent)\\s*(?:on|of|for)\\s*${NUM}|${NUM}\\s*(?:%|percent)\\s*tip\\s*(?:on|of|for)\\s*${NUM})$`).exec(s))) {
    const p = num(m[1] ?? m[3]), base = num(m[2] ?? m[4]);
    const tip = (p / 100) * base;
    return { human: `A ${fmt(p)}% tip on ${fmt(base)} is **${fmt(tip)}** — total **${fmt(base + tip)}** 🧾`, expert: `TIP // ${fmt(tip)} (total ${fmt(base + tip)})`, value: tip };
  }
  // "split 120 between 4" / "120 split 3 ways" / "divide 90 among 3"
  if ((m = new RegExp(`^(?:split|divide|share)\\s*${NUM}\\s*(?:between|among|by|into|\\()?\\s*(\\d+)(?:\\s*(?:ways|people|persons|friends))?\\)?$`).exec(s)) || (m = new RegExp(`^${NUM}\\s*split\\s*(\\d+)\\s*ways?$`).exec(s))) {
    const total = num(m[1]), people = parseInt(m[2], 10);
    if (people < 1 || people > 100000) return null;
    const value = total / people;
    return { human: `${fmt(total)} split ${people} ways is **${fmt(value)}** each 🍕`, expert: `SPLIT // ${fmt(total)} / ${people} = ${fmt(value)}`, value };
  }
  return null;
}

function tryList(s: string): MathAnswer | null {
  const m = /^(average|mean|sum|total|add up|min|minimum|max|maximum|smallest|largest|biggest|median)(?: of)?\s+([\d.,\s]+(?:(?:,|and|&)\s*[\d.,\s]*)*)$/.exec(s);
  if (!m) return null;
  const nums = (m[2].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  if (nums.length < 2 || nums.length > 200 || nums.some((n) => !Number.isFinite(n))) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const kind = m[1];
  let value: number, label: string;
  if (/^(average|mean)/.test(kind)) { value = nums.reduce((a, b) => a + b, 0) / nums.length; label = 'average'; }
  else if (/^(sum|total|add up)/.test(kind)) { value = nums.reduce((a, b) => a + b, 0); label = 'total'; }
  else if (/^(min|minimum|smallest)/.test(kind)) { value = sorted[0]; label = 'smallest'; }
  else if (/^(max|maximum|largest|biggest)/.test(kind)) { value = sorted[sorted.length - 1]; label = 'largest'; }
  else { const mid = Math.floor(sorted.length / 2); value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; label = 'median'; }
  return { human: `The ${label} of ${nums.length} numbers is **${fmt(value)}** 🧮`, expert: `LIST // ${label} (${nums.length} values) = ${fmt(value)}`, value };
}

/** "and 20% of that", "times 3", "half of that", "double it" ... acting on the previous result. */
function tryFollowUp(s: string, last: number): MathAnswer | null {
  const t = s.replace(/^(and|then|now|ok|okay|so)\s+/, '');
  const ref = '(?:that|it|this|the (?:result|answer|total))';
  let m: RegExpExecArray | null;
  const reply = (value: number, text: string): MathAnswer => ({ human: `${text} = **${fmt(value)}** 🧮`, expert: `CALC // ${text} = ${fmt(value)}`, value });
  if ((m = new RegExp(`^${NUM}\\s*(?:%|percent)\\s*of\\s*${ref}$`).exec(t))) return reply((num(m[1]) / 100) * last, `${m[1]}% of ${fmt(last)}`);
  if ((m = new RegExp(`^${NUM}\\s*(?:%|percent)\\s*off\\s*${ref}$`).exec(t))) return reply(last * (1 - num(m[1]) / 100), `${fmt(last)} minus ${m[1]}%`);
  if ((m = new RegExp(`^(?:add|plus|\\+)\\s*${NUM}\\s*(?:%|percent)$`).exec(t))) return reply(last * (1 + num(m[1]) / 100), `${fmt(last)} plus ${m[1]}%`);
  if ((m = new RegExp(`^(?:times|x|multiplied by|multiply (?:it |that )?by|\\*)\\s*${NUM}(?:\\s*${ref})?$`).exec(t))) return reply(last * num(m[1]), `${fmt(last)} × ${m[1]}`);
  if ((m = new RegExp(`^(?:divided by|divide (?:it |that )?by|/|÷)\\s*${NUM}(?:\\s*${ref})?$`).exec(t))) {
    const d = num(m[1]);
    return d === 0 ? null : reply(last / d, `${fmt(last)} ÷ ${m[1]}`);
  }
  if ((m = new RegExp(`^(?:plus|add|\\+)\\s*${NUM}$`).exec(t))) return reply(last + num(m[1]), `${fmt(last)} + ${m[1]}`);
  if ((m = new RegExp(`^(?:minus|subtract|take away|-)\\s*${NUM}$`).exec(t))) return reply(last - num(m[1]), `${fmt(last)} − ${m[1]}`);
  if (new RegExp(`^(?:half(?: of)? ${ref}|halve ${ref})$`).test(t)) return reply(last / 2, `half of ${fmt(last)}`);
  if (new RegExp(`^(?:double ${ref}|twice ${ref}|twice as much)$`).test(t)) return reply(last * 2, `double ${fmt(last)}`);
  if (new RegExp(`^(?:triple ${ref})$`).test(t)) return reply(last * 3, `triple ${fmt(last)}`);
  if (new RegExp(`^(?:square ${ref}|${ref} squared)$`).test(t)) return reply(last * last, `${fmt(last)}²`);
  if (new RegExp(`^(?:square root of ${ref}|root of ${ref})$`).test(t) && last >= 0) return reply(Math.sqrt(last), `√${fmt(last)}`);
  return null;
}

/* ------------------------------------------------------------------ unit conversion */

interface Unit { dim: string; f: number; name: string }
const U: Record<string, Unit> = {};
function def(dim: string, name: string, f: number, aliases: string[]) {
  const u = { dim, f, name };
  U[name] = u;
  aliases.forEach((a) => (U[a] = u));
}
// length (base metre)
def('length', 'mm', 0.001, ['millimeter', 'millimeters', 'millimetre', 'millimetres']);
def('length', 'cm', 0.01, ['centimeter', 'centimeters', 'centimetre', 'centimetres']);
def('length', 'm', 1, ['meter', 'meters', 'metre', 'metres']);
def('length', 'km', 1000, ['kilometer', 'kilometers', 'kilometre', 'kilometres', 'kms']);
def('length', 'inches', 0.0254, ['inch', 'inches', '"', 'in.']);
def('length', 'feet', 0.3048, ['ft', 'foot', 'feet']);
def('length', 'yards', 0.9144, ['yd', 'yds', 'yard', 'yards']);
def('length', 'miles', 1609.344, ['mi', 'mile', 'miles']);
// mass (base gram)
def('mass', 'mg', 0.001, ['milligram', 'milligrams']);
def('mass', 'g', 1, ['gram', 'grams', 'gm']);
def('mass', 'kg', 1000, ['kilogram', 'kilograms', 'kilo', 'kilos', 'kgs']);
def('mass', 'oz', 28.349523125, ['ounce', 'ounces']);
def('mass', 'lb', 453.59237, ['lbs', 'pound', 'pounds']);
// volume (base litre)
def('volume', 'ml', 0.001, ['milliliter', 'milliliters', 'millilitre', 'millilitres']);
def('volume', 'l', 1, ['liter', 'liters', 'litre', 'litres']);
def('volume', 'gallons (US)', 3.785411784, ['gal', 'gallon', 'gallons']);
def('volume', 'cups (US)', 0.2365882365, ['cup', 'cups']);
// speed (base m/s)
def('speed', 'km/h', 1 / 3.6, ['kmh', 'kph', 'kmph', 'km/hr']);
def('speed', 'mph', 0.44704, ['miles per hour', 'mi/h']);
def('speed', 'm/s', 1, ['mps']);
// time (base second)
def('time', 'seconds', 1, ['s', 'sec', 'secs', 'second']);
def('time', 'minutes', 60, ['min', 'mins', 'minute']);
def('time', 'hours', 3600, ['h', 'hr', 'hrs', 'hour']);
def('time', 'days', 86400, ['day']);
def('time', 'weeks', 604800, ['week', 'wk', 'wks']);
// data (base byte, binary 1024)
def('data', 'KB', 1024, ['kb', 'kilobyte', 'kilobytes']);
def('data', 'MB', 1024 ** 2, ['mb', 'megabyte', 'megabytes', 'meg', 'megs']);
def('data', 'GB', 1024 ** 3, ['gb', 'gigabyte', 'gigabytes', 'gig', 'gigs']);
def('data', 'TB', 1024 ** 4, ['tb', 'terabyte', 'terabytes']);
def('data', 'bytes', 1, ['b', 'byte']);
// temperature handled separately
const TEMP: Record<string, 'c' | 'f' | 'k'> = {
  c: 'c', '°c': 'c', celsius: 'c', centigrade: 'c', 'degrees c': 'c', 'degrees celsius': 'c', 'deg c': 'c',
  f: 'f', '°f': 'f', fahrenheit: 'f', 'degrees f': 'f', 'degrees fahrenheit': 'f', 'deg f': 'f',
  k: 'k', kelvin: 'k',
};
const DIM_NOUN: Record<string, string> = { length: 'distance', mass: 'weight', volume: 'volume', speed: 'speed', time: 'time', data: 'data size', temp: 'temperature' };

function unitKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^(a|an|the)\s+/, '').replace(/\?$/, '');
}
function lookupUnit(raw: string): Unit | null {
  const k = unitKey(raw);
  return U[k] || U[k.replace(/s$/, '')] || null;
}

function tempConvert(v: number, from: 'c' | 'f' | 'k', to: 'c' | 'f' | 'k'): number {
  const c = from === 'c' ? v : from === 'f' ? ((v - 32) * 5) / 9 : v - 273.15;
  return to === 'c' ? c : to === 'f' ? (c * 9) / 5 + 32 : c + 273.15;
}
const TEMP_LABEL = { c: '°C', f: '°F', k: 'K' } as const;

function convertAnswer(value: number, fromRaw: string, toRaw: string): MathAnswer | null {
  const fk = unitKey(fromRaw), tk = unitKey(toRaw);
  const ft = TEMP[fk], tt = TEMP[tk];
  if (ft && tt) {
    if (ft === 'k' && value < 0) return null;
    const r = tempConvert(value, ft, tt);
    const shown = Number(r.toFixed(2));
    return { human: `${fmt(value)}${TEMP_LABEL[ft]} is **${fmt(shown)}${TEMP_LABEL[tt]}** 🌡️`, expert: `CONVERT // ${fmt(value)}${TEMP_LABEL[ft]} = ${fmt(shown)}${TEMP_LABEL[tt]}`, value: shown };
  }
  const a = lookupUnit(fromRaw), b = lookupUnit(toRaw);
  if (!a || !b) {
    if ((ft && b) || (a && tt)) {
      const left = ft ? 'temperature' : DIM_NOUN[a!.dim], right = tt ? 'temperature' : DIM_NOUN[b!.dim];
      return { human: `Those don't match — one measures ${left}, the other ${right}, so there's nothing to convert. 🙂`, expert: `CONVERT // Dimension mismatch (${left} vs ${right}).` };
    }
    return null;
  }
  if (a.dim !== b.dim) {
    return { human: `Those don't match — **${a.name}** measures ${DIM_NOUN[a.dim]} and **${b.name}** measures ${DIM_NOUN[b.dim]}, so there's nothing to convert. 🙂`, expert: `CONVERT // Dimension mismatch (${DIM_NOUN[a.dim]} vs ${DIM_NOUN[b.dim]}).` };
  }
  const r = (value * a.f) / b.f;
  const shown = Number(r.toPrecision(7));
  let human = `${fmt(value)} ${a.name} = **${fmt(shown)} ${b.name}** 📐`;
  let expert = `CONVERT // ${fmt(value)} ${a.name} = ${fmt(shown)} ${b.name}`;
  if (a.dim === 'data') {
    // Drive makers use 1,000-based units while Windows/Android use 1,024-based ones: show both, it explains
    // why a "1 TB" drive shows up as about 931 GB.
    const dec = Number(((value * 1000 ** idx(a.name)) / 1000 ** idx(b.name)).toPrecision(7));
    if (a.name !== 'bytes' && b.name !== 'bytes' && dec !== shown) {
      human += `\n(Using 1,024 per step, which is how Windows and phones count. Drive makers count in 1,000s, so ${fmt(value)} ${a.name} as marketed ≈ **${fmt(dec)} ${b.name}**.)`;
      expert += `\nNOTE // decimal (marketing) basis: ${fmt(dec)} ${b.name}`;
    }
  }
  return { human, expert, value: shown };
}
function idx(name: string): number {
  return { bytes: 0, KB: 1, MB: 2, GB: 3, TB: 4 }[name as 'KB'] ?? 0;
}

const UNIT_WORD = String.raw`[a-z°"/ ]{1,22}?`;

function tryConvert(s: string): MathAnswer | null {
  let m: RegExpExecArray | null;
  // "how many gb in 2 tb" / "how many minutes are in 3 hours" / "how many mb in a gb"
  if ((m = new RegExp(`^how many (${UNIT_WORD}) (?:are |is )?(?:there )?(?:in|per) (?:${NUM}\\s*)?(?:an? |one )?(${UNIT_WORD})$`).exec(s))) {
    const amount = m[2] !== undefined ? num(m[2]) : 1;
    return convertAnswer(amount, m[3], m[1]);
  }
  // "5 km in miles" / "convert 72 f to c" / "100 kg = lb"
  if ((m = new RegExp(`^(?:convert |change |what(?:'s| is) )?${NUM}\\s*(${UNIT_WORD})\\s*(?:to|in|into|as|=|equals?)\\s*(${UNIT_WORD})$`).exec(s))) {
    return convertAnswer(num(m[1]), m[2], m[3]);
  }
  return null;
}

/* ------------------------------------------------------------------ entry point */

export function tryMathPlus(input: string, lastNum?: number): MathAnswer | null {
  let s = input.toLowerCase().trim().replace(/[?!.]+$/, '').trim();
  if (!s || s.length > 120) return null;
  s = s.replace(/^(what(?:'s| is)|whats|calculate|calc|compute|solve|work out|how much is|evaluate|convert)\s+/, (m) => (m.trim() === 'convert' ? 'convert ' : ''));
  s = s.replace(/\s+/g, ' ').trim();

  const conv = tryConvert(s);
  if (conv) return conv;
  const pct = tryPercent(s);
  if (pct) return pct;
  const list = tryList(s);
  if (list) return list;
  if (typeof lastNum === 'number' && Number.isFinite(lastNum)) {
    const fu = tryFollowUp(s, lastNum);
    if (fu) return fu;
  }
  return tryExpression(s);
}
