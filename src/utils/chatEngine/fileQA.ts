// src/utils/chatEngine/fileQA.ts
//
// Answers questions about the TEXT of a shared document (PDF, Word, Excel, PowerPoint, plain text) with no model:
// extractive summaries and "what does it say about X" by finding the passages that best match the question.
// Everything it returns is quoted from the file, never invented. Spreadsheets/logs with their own handlers are skipped.
import type { FileInsight } from './types';

const STOP = new Set('a an the is are was were of in on at to for do does did what whats which who whom how tell me about please can you could i my give explain it its this that there and or but if then so with from by as be been have has had will would should not no yes any some all more most very just also than into out up down over under again here when where why file files document documents doc pdf report attachment attached say says said mention mentions mentioned according sheet slide page text'.split(' '));
const stem = (w: string) => w.replace(/(?:ies)$/, 'y').replace(/(?:ing|ed|es|s)$/, (m) => (w.length - m.length >= 4 ? '' : m));
const toks = (s: string) => (s.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) => !STOP.has(w)).map(stem);

const SUMMARY = /^(?:please |can you |could you )?(?:(?:summari[sz]e|summary of|sum up)(?: it| this| that| the (?:file|document|pdf|doc|report|deck|sheet))?|summary|tl;?dr|give me (?:the )?(?:gist|summary|key points|main points)|key points|main points|highlights|what(?:'s| is| are) (?:it|this|the (?:file|document|pdf|doc|report)) (?:about|saying)|what does (?:it|this|the (?:file|document|pdf|doc|report)) say|what(?:'s| is) (?:in|inside) (?:it|this|the (?:file|document|pdf|doc|report)))(?: please)?\s*\??$/;
const CUE = /\b(file|document|doc|pdf|report|attachment|workbook|spreadsheet|slides?|deck|it say|does it|in it|in this|this say|mention|according to)\b/;

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 25 || /\d/.test(s) && s.length >= 8).map((s) => (s.length > 320 ? s.slice(0, 320).trimEnd() + '…' : s));
}

export function extractiveSummary(text: string, max = 5): string[] {
  const ss = sentences(text).slice(0, 400);
  if (ss.length <= max) return ss;
  const tf = new Map<string, number>();
  for (const s of ss) for (const t of toks(s)) tf.set(t, (tf.get(t) || 0) + 1);
  const scored = ss.map((s, i) => {
    const t = toks(s);
    const base = t.reduce((n, w) => n + Math.min(tf.get(w) || 0, 6), 0) / Math.max(6, t.length);
    return { s, i, score: base + (i < 3 ? 0.6 : 0) + (/\d/.test(s) ? 0.15 : 0) - (s.length < 40 ? 0.3 : 0) };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, max).sort((a, b) => a.i - b.i).map((x) => x.s);
}

const quote = (s: string) => s.replace(/[\[\]*_`<>]/g, '');

export function fileTextAnswer(files: FileInsight[], raw: string): string | null {
  const q = raw.toLowerCase().replace(/[^\w\s'?;-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  const docs = [...files].reverse().filter((f) => f.text && f.text.length > 40 && !/\.(?:csv|tsv|log)$/i.test(f.name));
  if (!docs.length) return null;

  if (SUMMARY.test(q)) {
    const f = docs[0];
    const pts = extractiveSummary(f.text!, /key points|main points|highlights/.test(q) ? 6 : 5);
    if (!pts.length) return null;
    const words = (f.text!.match(/\S+/g) || []).length;
    return `**${f.name}** (${f.summary}). Here are the main points, taken straight from the file:\n${pts.map((p) => `- ${quote(p)}`).join('\n')}\n\nAsk about anything specific in it, or I can send it to the owner.`;
  }

  const qt = [...new Set(toks(q))];
  if (!qt.length || qt.length > 12) return null;
  const cue = CUE.test(q);
  let best: { f: FileInsight; s: string; ctx: string; hit: number } | null = null;
  for (const f of docs) {
    const ss = sentences(f.text!.slice(0, 80_000));
    const df = new Map<string, number>();
    for (const s of ss) for (const t of new Set(toks(s))) df.set(t, (df.get(t) || 0) + 1);
    ss.forEach((s, i) => {
      const st = new Set(toks(s));
      const matched = qt.filter((t) => st.has(t));
      if (!matched.length) return;
      const weight = matched.reduce((n, t) => n + 1 + Math.log((ss.length + 1) / ((df.get(t) || 0) + 1)), 0);
      if (!best || weight > best.hit) best = { f, s, ctx: [ss[i - 1], s, ss[i + 1]].filter(Boolean).join(' '), hit: weight };
    });
  }
  const need = cue ? 1 : Math.min(2, qt.length);
  if (best) {
    const b: { f: FileInsight; s: string; ctx: string; hit: number } = best;
    const st = new Set(toks(b.ctx));
    const distinct = qt.filter((t) => st.has(t)).length;
    if (distinct >= need && (cue || distinct / qt.length >= 0.5)) {
      const body = b.ctx.length > 520 ? b.s : b.ctx;
      return `From **${b.f.name}**:\n> ${quote(body)}\n\nThat is the closest passage to what you asked. I only quote the file, so check it for the full context.`;
    }
  }
  if (cue && !/^(?:what|how|why|who|which|is|are|does|do|can|any)\b.{0,12}\b(?:wrong|problem|issue|error)/.test(q)) {
    return `I read **${docs[0].name}** but didn't find anything about “${qt.slice(0, 4).join(' ')}” in it. Try other words, or ask me to **summarize** it.`;
  }
  return null;
}
