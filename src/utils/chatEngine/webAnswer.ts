// src/utils/chatEngine/webAnswer.ts
//
// Internet answers that stay on topic.
//
// The old lookup took the first search hit that shared ANY word with the question ("work", "best", "make"...)
// and pasted the page's opening paragraph, which is how "how do solar panels work" could return an article about
// something else. This module does it in four steps, and every step is a pure function that can be tested offline:
//
//   1. parseQuestion  – what is being asked? (topic words, kind of question, the attribute asked for)
//   2. rankCandidates – score many pages; a page is accepted only if its TITLE/opening really covers the topic
//   3. pickSentences  – quote the sentences that answer the question, not just the first paragraph
//   4. confidence     – below the bar we say "I couldn't find a reliable answer" instead of guessing

import { normalize, stem, tokens as rawTokens, tokenMatch } from './text';

/** Spellings that tokenise differently but mean the same word ("Wi-Fi" = "wifi"). */
const fold = (t: string) => t.replace(/\bwi[- ]fi\b/gi, 'wifi').replace(/\be-(mail|commerce|book|sports?)\b/gi, 'e$1').replace(/\bx-ray\b/gi, 'xray').replace(/\bcovid-19\b/gi, 'covid19').replace(/\b4-g\b/gi, '4g');
const tokens = (t: string) => rawTokens(fold(t));

export type QKind = 'define' | 'who' | 'when' | 'where' | 'howmany' | 'howto' | 'why' | 'attribute' | 'compare' | 'list' | 'other';

export interface ParsedQuestion {
  raw: string;
  kind: QKind;
  /** The thing being asked about, as a search phrase ("president of uganda", "solar panel"). */
  topic: string;
  /** Stemmed content words of the topic that a correct page must cover. */
  must: string[];
  /** Stemmed words describing WHAT about the topic is asked ("capital", "born", "height"). */
  asks: string[];
  /** The answer can go stale (office holders, records, prices). */
  volatile: boolean;
  /** For "A vs B" questions. */
  pair?: [string, string];
}

/** Words that frame a question but are not the topic. Stemmed with the same stemmer as tokens(). */
const FRAME = new Set(
  ['best', 'top', 'good', 'great', 'work', 'make', 'use', 'used', 'using', 'example', 'type', 'kind', 'way', 'thing', 'mean', 'meaning', 'define', 'definition', 'explain', 'describe', 'tell', 'know', 'find', 'show', 'give', 'long', 'much', 'many', 'first', 'last', 'old', 'new', 'big', 'small', 'famous', 'popular', 'common', 'main', 'major', 'different', 'difference', 'between', 'versus', 'compare', 'comparison', 'simple', 'simply', 'basic', 'basics', 'quick', 'fast', 'easy', 'someone', 'something', 'anyone', 'everyone', 'people', 'person', 'actually', 'exactly', 'really', 'step', 'steps', 'guide', 'tutorial', 'tip', 'tips', 'idea', 'ideas', 'reason', 'reasons', 'cause', 'causes', 'happen', 'happens', 'does', 'learn', 'start', 'started'].map(stem)
);

const VOLATILE = /\b(won|who won|current|currently|now|today|latest|newest|recent|president|prime minister|ceo|chairman|leader|champion|champions|winner|richest|biggest company|population|price|worth|net worth|record holder|captain|manager|coach|governor|mayor|minister|speaker|chief justice|king|queen)\b/i;

const ATTRS: Array<[RegExp, string[]]> = [
  [/\b(capital)\b/, ['capital']], [/\b(population|how many people)\b/, ['population']], [/\b(currency|money used)\b/, ['currency']],
  [/\b(president|prime minister|leader|head of state|head of government|king|queen|ruler)\b/, ['president']],
  [/\b(founder|founded|created|invented|inventor|creator|started|established|author|wrote|written|designed|designer|directed|composed)\b/, ['found']],
  [/\b(born|birth|birthday|age|died|death|die)\b/, ['born']], [/\b(height|tall|high|altitude|elevation)\b/, ['height']],
  [/\b(area|size|big|large)\b/, ['area']], [/\b(length|long|distance|far)\b/, ['length']], [/\b(language|languages|speak|spoken)\b/, ['language']],
  [/\b(ceo|chief executive|owner|owns)\b/, ['ceo']], [/\b(release|released|launch|launched|come out)\b/, ['release']],
  [/\b(located|location|where is|found in|situated)\b/, ['located']], [/\b(cost|price|worth)\b/, ['price']],
];

export function parseQuestion(rawIn: string): ParsedQuestion {
  const raw = rawIn.trim();
  let q = normalize(raw).replace(/\?+$/, '').trim();
  const lowered = q;
  let kind = 'other' as QKind;
  let pair: [string, string] | undefined;

  const vs = /^(?:what(?:'s| is) the )?(?:difference between |compare |comparison of |)(.+?) (?:vs\.?|versus|or|and|compared to|compared with|against) (.+?)(?: which is better| difference| comparison)?$/.exec(q);
  if (vs && /\b(vs|versus|difference|compare|compared|better|or)\b/.test(lowered) && vs[1].split(' ').length <= 4 && vs[2].split(' ').length <= 4) {
    kind = 'compare';
    pair = [vs[1].replace(/^(?:the |a |an )/, ''), vs[2].replace(/^(?:the |a |an )/, '')];
  }

  const strip = (re: RegExp, k: QKind) => { const m = re.exec(q); if (m) { q = q.slice(m[0].length).trim(); if (kind === 'other') kind = k; return true; } return false; };
  strip(/^(?:please |pls |can you |could you |hey |ok |so )+/, 'other');
  // "who invented the telephone", "who wrote hamlet", "who owns tesla": the attribute is the verb
  if (/^(?:who|what|which (?:company|person|country)) (?:invented|created|founded|discovered|wrote|built|designed|developed|directed|painted|composed|started|established|owns|runs|leads|makes|made|discovered)\s+/.test(q)) {
    const m2 = /^(?:who|what|which (?:company|person|country)) (invented|created|founded|discovered|wrote|built|designed|developed|directed|painted|composed|started|established|owns|runs|leads|makes|made)\s+(.+)$/.exec(q)!;
    const asks2 = [stem(m2[1] === 'owns' || m2[1] === 'runs' || m2[1] === 'leads' ? 'ceo' : 'found')];
    const tt = m2[2].replace(/^(?:the|a|an)\s+/, '').trim();
    const mt = tokens(tt).filter((t) => !FRAME.has(t));
    return { raw, kind: 'attribute', topic: tt, must: mt, asks: asks2, volatile: VOLATILE.test(lowered), pair };
  }
  strip(/^(?:tell me|let me know|i want to know|i wanna know|do you know|can you tell me|i would like to know)\s+/, 'other');
  strip(/^(?:what is|what's|whats|what are|what was|what were)\s+(?:the\s+)?(?:meaning of|definition of)\s+/, 'define') ||
    strip(/^(?:define|definition of|meaning of|explain|describe|what does)\s+/, 'define') ||
    strip(/^(?:who is|who was|who are|who were|who's)\s+/, 'who') ||
    strip(/^(?:when did|when was|when is|when were|what year did|what year was|in what year was|what date)\s+/, 'when') ||
    strip(/^(?:where is|where are|where was|where do|where does|where can i find)\s+/, 'where') ||
    strip(/^(?:how many|how much|how big is|how tall is|how long is|how old is|how far is|how large is|how high is)\s+/, 'howmany') ||
    strip(/^(?:how do i|how can i|how to|how do you|how should i|how does one|steps to|ways to)\s+/, 'howto') ||
    strip(/^(?:how does|how do|how did|how come)\s+/, 'why') ||
    strip(/^(?:why is|why are|why do|why does|why did|why was|why were)\s+/, 'why') ||
    strip(/^(?:list of|types of|kinds of|examples of|give me examples of|gimme some examples of|what are examples of|what are some)\s+/, 'list') ||
    strip(/^(?:what is|what's|whats|what are|what was|what were|which is|which are|which)\s+/, 'define');

  q = q.replace(/^(?:the|a|an)\s+/, '').trim();
  // "capital of kenya", "president of uganda", "height of mount everest": attribute questions keep the whole phrase
  const attrM = /^(.+?) of (?:the )?(.+)$/.exec(q);
  const asks: string[] = [];
  for (const [re, a] of ATTRS) if (re.test(lowered)) asks.push(...a.map(stem));
  if (attrM && ATTRS.some(([re]) => re.test(attrM[1])) && kind !== 'compare') kind = 'attribute';
  if (kind === 'other' && asks.length && /^(?:who|what|which|when|where|how)/.test(lowered)) kind = 'attribute';

  // "who is the president of uganda" -> topic "president of uganda"; "when was google founded" -> "google"
  let topic = q.replace(/\b(?:founded|invented|created|started|established|released|launched|born|die|died|written|built|discovered|made|published|released|come out|happened)\b$/, '').trim();
  if (kind === 'howmany') topic = topic.replace(/^(?:people |students |users |countries |states |days |hours |minutes |seconds |km |kilometres |kilometers |miles |years |players |employees )?(?:live |are |is |does |do |in |on )*(?:in |on |at |does |do |is |are |the )*/, '').trim() || topic;
  topic = topic.replace(/\s+/g, ' ').trim();

  const topicTokens = tokens(topic).filter((t) => !FRAME.has(t));
  // the attribute word itself ("capital", "president") is part of the topic only for attribute questions
  const must = Array.from(new Set(kind === 'attribute' ? topicTokens : topicTokens.filter((t) => !asks.includes(t))));
  return { raw, kind, topic: pair ? pair[0] : topic, must: must.length ? must : Array.from(new Set(topicTokens)), asks: Array.from(new Set(asks)), volatile: VOLATILE.test(lowered), pair };
}

/* ---------------------------------------------------------------- candidates */

export interface Candidate { title: string; extract: string; index?: number; url?: string; image?: string; description?: string }
export interface Ranked extends Candidate { score: number; titleCover: number; openCover: number; exact: boolean }

const BAD_TITLE = /^(?:list of|lists of|index of|outline of|timeline of|glossary of|category:|template:|wikipedia:|portal:|help:|file:)/i;

/** Strict word match for coverage: exact stem, or a typo only on long words. */
const same = (a: string, b: string) => a === b || (a.length >= 7 && b.length >= 7 && tokenMatch(a, b));

function cover(must: string[], text: string): number {
  if (!must.length) return 0;
  const words = tokens(text);
  let hit = 0;
  for (const m of must) if (words.some((w) => same(m, w))) hit++;
  return hit / must.length;
}

export function rankCandidates(pq: ParsedQuestion, cands: Candidate[]): Ranked[] {
  const topicNorm = normalize(pq.topic).replace(/^(?:the|a|an) /, '');
  const wantsList = pq.kind === 'list' || /\blist\b/.test(normalize(pq.raw));
  const out: Ranked[] = [];
  for (const c of cands) {
    if (!c.title || !c.extract || c.extract.length < 25) continue;
    if (/may refer to|can refer to|commonly refers to/.test(c.extract.slice(0, 200)) && c.extract.length < 400) continue;
    if (BAD_TITLE.test(c.title) && !wantsList) continue;
    const baseTitle = c.title.replace(/\s*\([^)]*\)\s*$/, '');
    const titleNorm = normalize(baseTitle).replace(/^(?:the|a|an) /, '');
    // "SSD" for "Solid-state drive (SSD)": the abbreviation appears in the first brackets of the opening
    const single = pq.must.length === 1 && topicNorm.length >= 2 && !topicNorm.includes(' ');
    const alias = single && new RegExp('\\((?:[^)]*[\\s,;])?' + topicNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[\\s,;][^)]*)?\\)', 'i').test(c.extract.slice(0, 240));
    const exact = alias || titleNorm === topicNorm || normalize(c.title) === topicNorm || stem(titleNorm) === stem(topicNorm);
    const titleCover = cover(pq.must, c.title);
    const openCover = cover(pq.must, c.title + ' ' + c.extract.slice(0, 420));
    const tTok = tokens(baseTitle);
    // a page whose title is mostly words the question never used is probably about something narrower or different
    const extra = tTok.length ? tTok.filter((t) => !pq.must.some((m) => same(m, t)) && !pq.asks.includes(t)).length / tTok.length : 0;
    let score = 0;
    score += exact ? 6 : 0;
    // this site is about tech: when several pages share one name ("Python", "Apple"), prefer the technology reading
    if (exact && /\((?:programming language|software|computing|company|technology|operating system|web browser|search engine|file format|protocol|video game console)\)/i.test(c.title) && !/\b(snake|fruit|animal|planet|element|film|band)\b/i.test(pq.raw)) score += 0.8;
    score += titleCover * 3 + openCover * 2;
    score -= extra * 1.6;
    score += 1.2 / (1 + (c.index ?? 5));
    if (/\b(film|album|song|band|novel|tv series|episode|video game|character)\b/i.test(c.title) && !/\b(film|movie|album|song|band|novel|series|game|character)\b/i.test(pq.raw)) score -= 1.5;
    out.push({ ...c, score, titleCover, openCover, exact });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Accept only pages that really are about the topic. Returns the page and a 0..1 confidence, or null. */
export function acceptBest(pq: ParsedQuestion, ranked: Ranked[]): { page: Ranked; confidence: number } | null {
  if (!pq.must.length) return null;
  for (const r of ranked) {
    const single = pq.must.length === 1;
    const ok =
      r.exact ||
      (r.titleCover >= 0.999 && r.openCover >= 0.999) ||
      (!single && r.titleCover >= 0.6 && r.openCover >= 0.99) ||
      (!single && pq.kind === 'attribute' && r.openCover >= 0.99 && r.titleCover >= 0.5);
    if (!ok) continue;
    const confidence = Math.max(0.3, Math.min(1, 0.45 + (r.exact ? 0.35 : 0) + r.titleCover * 0.15 + r.openCover * 0.1 - (single && !r.exact ? 0.2 : 0)));
    return { page: r, confidence };
  }
  return null;
}

/* ---------------------------------------------------------------- sentences */

export function splitSentences(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').replace(/\[\d+\]/g, '').trim();
  const parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
  const out: string[] = [];
  for (const p of parts) {
    // glue back splits caused by abbreviations ("St.", "Dr.", "U.S.", "c. 1900")
    if (out.length && /(?:\b(?:St|Dr|Mr|Mrs|Ms|Prof|Jr|Sr|vs|c|ca|No|Inc|Ltd|Co|Gen|Col|Lt|Capt|Mt|Ft)\.|\b[A-Z]\.)$/.test(out[out.length - 1])) out[out.length - 1] += ' ' + p;
    else out.push(p);
  }
  return out.filter((s) => s.length > 2);
}

/** Choose the sentences that answer the question (kept in original order). */
export function pickSentences(pq: ParsedQuestion, extract: string, max = 3, maxChars = 520): string {
  const sents = splitSentences(extract);
  if (sents.length <= 1) return sents[0] || '';
  const want = new Set([...pq.asks, ...tokens(pq.raw).filter((t) => !FRAME.has(t))]);
  const numeric = pq.kind === 'when' || pq.kind === 'howmany';
  const scored = sents.map((s, i) => {
    const w = tokens(s);
    let sc = 0;
    want.forEach((t) => { if (w.some((x) => same(t, x) || x === t)) sc += 1; });
    if (numeric && /\b(?:1[0-9]{3}|20[0-9]{2}|[0-9][0-9,.]{2,})\b/.test(s)) sc += 1.5;
    if (i === 0) sc += pq.kind === 'define' || pq.kind === 'who' || pq.kind === 'other' ? 3 : 1;
    return { s, i, sc };
  });
  const chosen: typeof scored = [];
  let len = 0;
  for (const x of [...scored].sort((a, b) => b.sc - a.sc || a.i - b.i)) {
    if (chosen.length >= max) break;
    if (x.sc <= 0 && chosen.length > 0) break;
    if (len + x.s.length > maxChars && chosen.length > 0) continue;
    chosen.push(x); len += x.s.length;
  }
  return chosen.sort((a, b) => a.i - b.i).map((x) => x.s).join(' ');
}

export const STALE_NOTE = 'ℹ️ This can change over time, so check the source for the latest.';

export interface WebAnswer { title: string; text: string; url?: string; image?: string; confidence: number; volatile: boolean; kind: QKind }

/** The whole decision, from candidates to final answer (pure). */
export function answerFromCandidates(pq: ParsedQuestion, cands: Candidate[]): WebAnswer | null {
  const ranked = rankCandidates(pq, cands);
  const acc = acceptBest(pq, ranked);
  if (!acc) return null;
  const text = pickSentences(pq, acc.page.extract);
  if (!text || text.length < 20) return null;
  // Attribute questions ("capital of X", "who founded Y") must actually contain the asked-for word in what we quote.
  if (pq.kind === 'attribute' && pq.asks.length) {
    const w = tokens(text);
    if (!pq.asks.some((a) => w.some((x) => same(a, x) || x.startsWith(a)))) {
      if (acc.page.exact === false) return null;
    }
  }
  return { title: acc.page.title, text, url: acc.page.url, image: acc.page.image, confidence: acc.confidence, volatile: pq.volatile, kind: pq.kind };
}
