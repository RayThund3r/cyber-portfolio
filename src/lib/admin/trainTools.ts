// src/lib/admin/trainTools.ts — pure helpers for the "home training" screen (no React, no network, unit-testable).
import type { Taught } from './brain';

/**
 * Bulk text -> taught answers. Two layouts are understood, mix them freely:
 *   Q: opening hours | when are you open | open on sunday
 *   A: We are open **Mon–Sat 8am–7pm**.
 * (blank line between blocks; an answer may run over several lines)  — or one per line:
 *   opening hours | when are you open => We are open Mon–Sat 8am–7pm.
 */
export function parseBulk(text: string): Array<{ q: string[]; a: string }> {
  const out: Array<{ q: string[]; a: string }> = [];
  const split = (s: string) => s.split(/\s*\|\s*|\s*;\s*(?=[a-z0-9])/i).map((x) => x.trim().replace(/^["“]|["”]$/g, '')).filter((x) => x.length >= 2);
  let q: string[] = [];
  let a: string[] = [];
  let inA = false;
  const flush = () => { const ans = a.join('\n').trim(); if (q.length && ans.length >= 2) out.push({ q: q.slice(0, 12), a: ans.slice(0, 1800) }); q = []; a = []; inA = false; };
  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trimEnd();
    const mq = /^\s*(?:q|question|ask)\s*[:：]\s*(.*)$/i.exec(line);
    const ma = /^\s*(?:a|answer|reply)\s*[:：]\s*(.*)$/i.exec(line);
    const arrow = /^(.+?)\s*(?:=>|->|→)\s*(.+)$/.exec(line);
    if (mq) { if (inA || (q.length && !a.length && false)) flush(); else if (q.length && a.length) flush(); q = q.concat(split(mq[1])); continue; }
    if (ma) { inA = true; a.push(ma[1]); continue; }
    if (arrow && !inA && !line.trim().startsWith('-')) { flush(); const qs = split(arrow[1]); if (qs.length) { q = qs; a = [arrow[2]]; flush(); } continue; }
    if (!line.trim()) { if (inA) flush(); continue; }
    if (inA) a.push(line);
  }
  flush();
  return out;
}

const SWAPS: Array<[RegExp, string[]]> = [
  [/\bprice\b/, ['cost', 'rate']], [/\bcost\b/, ['price', 'charge']], [/\bhow much\b/, ['what is the price of', 'what does it cost for']],
  [/\bfix\b/, ['repair']], [/\brepair\b/, ['fix']], [/\bopen\b/, ['opening hours', 'working hours']], [/\blocation\b/, ['where are you', 'address']],
  [/\bphone\b/, ['mobile', 'smartphone']], [/\blaptop\b/, ['notebook', 'computer']], [/\bwebsite\b/, ['web site', 'web page']],
  [/\bwarranty\b/, ['guarantee']], [/\bpay\b/, ['pay for it', 'payment']], [/\bdeliver\b/, ['bring it to me', 'send it to me']],
];

/** A few extra ways to ask the same thing, from the first phrasing. Rule-based, instant, offline. */
export function suggestPhrasings(first: string, have: string[] = []): string[] {
  const base = first.toLowerCase().replace(/[?!.]+$/g, '').replace(/\s+/g, ' ').trim();
  if (base.length < 3) return [];
  const set = new Set<string>();
  const add = (s: string) => { const t = s.replace(/\s+/g, ' ').trim(); if (t.length >= 3 && t.length <= 100) set.add(t); };
  const core = base.replace(/^(?:please |pls |hi |hello |hey )+/, '').replace(/^(?:do you|can you|could you|will you|can i|could i|do i|is there|are there|what is|whats|what's|what are|how do i|how can i|how do you)\s+/, '');
  add(core);
  if (/^(?:do you|can you|could you|will you)\b/.test(base)) { add('can i ' + core); add('is it possible to ' + core); add('are you able to ' + core); }
  if (/^(?:what is|whats|what's|what are)\b/.test(base)) { add('tell me ' + core); add('i want to know ' + core); add(core + '?'); }
  if (/^(?:how do i|how can i)\b/.test(base)) { add('how to ' + core); add('steps to ' + core); add('help me ' + core); }
  add('please ' + base); add('i need to know ' + core); add(base + ' please');
  for (const [rx, alts] of SWAPS) if (rx.test(base)) for (const alt of alts) add(base.replace(rx, alt));
  const taken = new Set(have.map((h) => h.toLowerCase().replace(/[?!.]+$/g, '').trim()));
  taken.add(base);
  return [...set].filter((s) => !taken.has(s)).slice(0, 8);
}

/** Merge new entries into the list without duplicating questions that are already taught. */
export function mergeNew(list: Taught[], add: Array<{ q: string[]; a: string }>): { next: Taught[]; added: number; skipped: number } {
  const have = new Set(list.flatMap((e) => e.q.map((x) => x.toLowerCase().trim())));
  const fresh: Taught[] = [];
  let skipped = 0;
  add.forEach((x, i) => {
    const q = x.q.filter((p) => !have.has(p.toLowerCase().trim()));
    if (!q.length) { skipped++; return; }
    q.forEach((p) => have.add(p.toLowerCase().trim()));
    fresh.push({ id: 'b' + Date.now().toString(36) + i.toString(36), q, a: x.a, t: Date.now() });
  });
  return { next: [...fresh, ...list], added: fresh.length, skipped };
}
