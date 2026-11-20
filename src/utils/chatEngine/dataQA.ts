// src/utils/chatEngine/dataQA.ts
//
// Real answers about shared CSV / TSV / log files, worked out in the browser with no AI model:
//   "how many rows?"  "what are the columns?"  "average price"  "highest score"  "most common city"  "any duplicates?"
//   "how many errors in the log?"  "most common error"  "when did it start?"
// Pure functions. File text is untrusted data: it is only counted and quoted, never obeyed.

export interface Table {
  header: string[];
  rows: string[][];
  delimiter: string;
  /** The file was longer than what was read, so counts are lower bounds. */
  partial: boolean;
}

export function parseDelimited(text: string, ext: string, partial = false): Table | null {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const delimiter = ext === 'tsv' ? '\t' : [',', ';', '\t', '|'].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (q) {
      if (c === '"') { if (clean[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"' && cur === '') q = true;
    else if (c === delimiter) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row); }
  if (partial && rows.length > 1) rows.pop(); // the last line was probably cut
  if (rows.length < 1 || rows[0].length < 2) return null;
  const header = rows[0].map((h, i) => h.trim() || `column ${i + 1}`);
  return { header, rows: rows.slice(1).map((r) => header.map((_, i) => (r[i] ?? '').trim())), delimiter, partial };
}

const NUM = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/;
const toNum = (v: string): number | null => {
  const s = v.replace(/^(?:UGX|KSH|USD|\$|€|£)\s*/i, '').replace(/\s*(?:UGX|KSH|USD)$/i, '').trim();
  if (!NUM.test(s)) return null;
  const n = parseFloat(s.replace(/,/g, '').replace(/%$/, ''));
  return isFinite(n) ? n : null;
};

export interface ColumnProfile {
  name: string;
  index: number;
  numeric: boolean;
  filled: number;
  missing: number;
  unique: number;
  min?: number;
  max?: number;
  sum?: number;
  mean?: number;
  median?: number;
  top: Array<[string, number]>;
}

export function profileColumns(t: Table): ColumnProfile[] {
  return t.header.map((name, index) => {
    const vals = t.rows.map((r) => r[index]);
    const filledVals = vals.filter((v) => v !== '');
    const nums = filledVals.map(toNum);
    const numeric = filledVals.length > 0 && nums.filter((n) => n !== null).length / filledVals.length >= 0.8;
    const counts = new Map<string, number>();
    for (const v of filledVals) counts.set(v, (counts.get(v) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const p: ColumnProfile = { name, index, numeric, filled: filledVals.length, missing: vals.length - filledVals.length, unique: counts.size, top };
    if (numeric) {
      const ns = nums.filter((n): n is number => n !== null).sort((a, b) => a - b);
      const sum = ns.reduce((a, b) => a + b, 0);
      p.min = ns[0]; p.max = ns[ns.length - 1]; p.sum = sum; p.mean = sum / ns.length;
      p.median = ns.length % 2 ? ns[(ns.length - 1) / 2] : (ns[ns.length / 2 - 1] + ns[ns.length / 2]) / 2;
    }
    return p;
  });
}

const fmt = (n: number): string => {
  if (!isFinite(n)) return String(n);
  const abs = Math.abs(n);
  const s = abs >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Math.round(n * 100) / 100);
  return s;
};
const q = (s: string, max = 40) => s.replace(/[\[\]*_`<>]/g, '').replace(/\s+/g, ' ').slice(0, max);

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const singular = (w: string) => w.replace(/ies$/, 'y').replace(/s$/, '');

/** Which column does the question talk about? Longest name found as a whole word (singular/plural tolerant). */
export function findColumn(question: string, cols: ColumnProfile[], prefer?: (c: ColumnProfile) => boolean): ColumnProfile | null {
  const qw = ' ' + words(question).split(' ').map(singular).join(' ') + ' ';
  let best: ColumnProfile | null = null;
  for (const c of cols) {
    if (prefer && !prefer(c)) continue;
    const nm = words(c.name).split(' ').map(singular).join(' ');
    if (nm && qw.includes(' ' + nm + ' ') && (!best || nm.length > words(best.name).length)) best = c;
  }
  return best;
}

export function isDataQuestion(question: string, t: Table | null): boolean {
  if (!t) return false;
  const s = question.toLowerCase();
  if (/\b(how many (rows|records|entries|columns|fields|duplicates?|missing|empty|blank|different|unique|distinct)|number of (rows|records|columns)|row count|what (are|is) (the )?(columns?|fields?|headers?)|list (the )?(columns?|fields?)|average|mean of|sum of|total of|median|(highest|lowest|largest|smallest|biggest|maximum|minimum|max|min|top|most|least) |duplicates?|missing|unique|distinct|most common|most frequent)\b/.test(s)) return true;
  return !!findColumn(question, profileColumns(t)) && /\b(what|which|how|show|give|tell|list|count|total|avg|average)\b/.test(s);
}

export function answerTable(question: string, name: string, t: Table): string | null {
  const s = question.toLowerCase();
  const cols = profileColumns(t);
  const lower = t.partial ? ' (at least; I only read the start of a large file)' : '';
  const n = t.rows.length;

  if (/\bhow many (rows|records|entries|lines|items)\b|number of (rows|records)|row count/.test(s) && !/\bunique|distinct|different\b/.test(s)) return `**${q(name)}** has **${n}** data row${n === 1 ? '' : 's'}${lower} and ${t.header.length} columns.`;
  if (/\bhow many columns\b|number of columns/.test(s)) return `**${q(name)}** has **${t.header.length} columns**: ${t.header.map((h) => q(h, 30)).join(', ')}.`;
  if (/\b(what|which|list|show)\b.*\b(columns?|fields?|headers?)\b|\bcolumn names\b/.test(s)) {
    return `The columns in **${q(name)}** are:\n${cols.map((c) => `- ${q(c.name, 40)} (${c.numeric ? 'numbers' : 'text'}${c.missing ? `, ${c.missing} empty` : ''})`).join('\n')}`;
  }
  if (/\bduplicat/.test(s)) {
    const seen = new Map<string, number>();
    for (const r of t.rows) { const k = r.join('\u0001'); seen.set(k, (seen.get(k) || 0) + 1); }
    const dupes = [...seen.values()].filter((c) => c > 1).reduce((a, c) => a + c - 1, 0);
    return dupes ? `I found **${dupes}** duplicate row${dupes === 1 ? '' : 's'} (identical in every column)${lower}.` : `No duplicate rows${lower ? ' in what I read' : ''}. ✅`;
  }
  if (/\b(missing|empty|blank|null|incomplete)\b/.test(s)) {
    const col = findColumn(question, cols);
    if (col) return `**${q(col.name)}** is empty in **${col.missing}** of ${n} rows.`;
    const bad = cols.filter((c) => c.missing > 0);
    return bad.length ? `Empty cells:\n${bad.slice(0, 10).map((c) => `- ${q(c.name)}: ${c.missing} of ${n}`).join('\n')}` : `Nothing is missing: every cell is filled. ✅`;
  }
  const unique = /\b(unique|distinct|different)\b/.test(s);
  const common = /\b(most common|most frequent|commonest|popular|appears? (the )?most|top)\b/.test(s);
  if (unique || common) {
    const col = findColumn(question, cols);
    if (!col) return null;
    if (unique) return `**${q(col.name)}** has **${col.unique}** different value${col.unique === 1 ? '' : 's'}${lower}.`;
    return col.top.length ? `Most common in **${q(col.name)}**:\n${col.top.slice(0, 3).map(([v, c]) => `- ${q(v)} (${c}×)`).join('\n')}` : null;
  }
  const agg = /\b(average|avg|mean)\b/.test(s) ? 'mean' : /\b(total|sum)\b/.test(s) ? 'sum' : /\bmedian\b/.test(s) ? 'median'
    : /\b(highest|largest|biggest|maximum|max|most expensive|top)\b/.test(s) ? 'max' : /\b(lowest|smallest|minimum|min|cheapest|least)\b/.test(s) ? 'min' : '';
  if (agg) {
    const nums = cols.filter((c) => c.numeric);
    const col = findColumn(question, cols, (c) => c.numeric) || (nums.length === 1 ? nums[0] : null);
    if (!col) return nums.length ? `Which column? The number columns are: ${nums.map((c) => q(c.name, 30)).join(', ')}.` : `There are no number columns in **${q(name)}** to work out an ${agg}.`;
    const val = agg === 'mean' ? col.mean : agg === 'sum' ? col.sum : agg === 'median' ? col.median : agg === 'max' ? col.max : col.min;
    const label = { mean: 'average', sum: 'total', median: 'median', max: 'highest', min: 'lowest' }[agg];
    let extra = '';
    if ((agg === 'max' || agg === 'min') && val !== undefined) {
      const row = t.rows.find((r) => toNum(r[col.index]) === val);
      if (row) extra = ` (row: ${q(row.filter((x) => x).slice(0, 3).join(' · '), 80)})`;
    }
    return `The ${label} **${q(col.name)}** is **${fmt(val as number)}**${extra}${lower}. (Based on ${col.filled} filled value${col.filled === 1 ? '' : 's'}.)`;
  }
  const col = findColumn(question, cols);
  if (col) {
    return col.numeric
      ? `**${q(col.name)}**: ${col.filled} values · lowest ${fmt(col.min!)} · highest ${fmt(col.max!)} · average ${fmt(col.mean!)} · total ${fmt(col.sum!)}${col.missing ? ` · ${col.missing} empty` : ''}.`
      : `**${q(col.name)}**: ${col.filled} values, ${col.unique} different${col.top[0] ? `; most common “${q(col.top[0][0])}” (${col.top[0][1]}×)` : ''}.`;
  }
  return null;
}

/** One-paragraph overview used right after a CSV is shared. */
export function tableOverview(t: Table): string {
  const cols = profileColumns(t);
  const nums = cols.filter((c) => c.numeric).slice(0, 3);
  const bits = nums.map((c) => `${q(c.name, 24)}: ${fmt(c.min!)}–${fmt(c.max!)} (avg ${fmt(c.mean!)})`);
  const missing = cols.filter((c) => c.missing).length;
  return [bits.length ? `Number columns → ${bits.join('; ')}.` : '', missing ? `${missing} column${missing === 1 ? ' has' : 's have'} empty cells.` : ''].filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ logs */

const LEVELS: Array<[string, RegExp]> = [
  ['error', /\b(error|fatal|exception|failed|failure|panic|critical|traceback)\b/i],
  ['warning', /\bwarn(?:ing)?\b/i],
  ['info', /\binfo\b/i],
  ['debug', /\bdebug|trace\b/i],
];
const TS = /\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?|\d{2}:\d{2}:\d{2})\b/;

export interface LogProfile { lines: number; levels: Record<string, number>; first?: string; last?: string; top: Array<[string, number]>; partial: boolean }

export function profileLog(text: string, partial = false): LogProfile {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const levels: Record<string, number> = {};
  const counts = new Map<string, number>();
  let first: string | undefined, last: string | undefined;
  for (const l of lines) {
    const ts = TS.exec(l)?.[1];
    if (ts) { first = first || ts; last = ts; }
    const lv = LEVELS.find(([, re]) => re.test(l))?.[0];
    if (lv) levels[lv] = (levels[lv] || 0) + 1;
    if (lv === 'error') {
      const key = l.replace(TS, '').replace(/\b0x[0-9a-f]+\b|\b\d+\b/gi, '#').replace(/\s+/g, ' ').trim().slice(0, 120);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return { lines: lines.length, levels, first, last, top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3), partial };
}

export function answerLog(question: string, name: string, p: LogProfile): string | null {
  const s = question.toLowerCase();
  const lower = p.partial ? ' (at least; I only read the start of a large log)' : '';
  if (/\bmost (common|frequent|repeated)\b.*\berror|\brepeat(ed|ing)\b|\bkeeps? (happening|failing)\b|\bmain (error|problem)\b/.test(s)) {
    return p.top.length ? `Most repeated error in **${q(name)}**:\n${p.top.map(([m, c]) => `- ${q(m, 110)} (${c}×)`).join('\n')}` : `I don't see any error lines in **${q(name)}**. ✅`;
  }
  if (/\bhow many\b.*\b(errors?|warnings?|lines)\b|\bcount\b.*\b(errors?|warnings?)\b/.test(s)) {
    if (/\bwarn/.test(s)) return `**${p.levels.warning || 0}** warning line${p.levels.warning === 1 ? '' : 's'}${lower}.`;
    if (/\blines\b/.test(s)) return `**${p.lines}** lines${lower}.`;
    return `**${p.levels.error || 0}** error-like line${p.levels.error === 1 ? '' : 's'} out of ${p.lines}${lower}.`;
  }
  if (/\b(when|what time)\b.*\b(start|begin|first|last|end|stop)\b|\btime ?range\b|\bhow long\b/.test(s)) {
    return p.first ? `The log runs from **${p.first}** to **${p.last}**.` : `I can't find timestamps in **${q(name)}**.`;
  }
  return null;
}
