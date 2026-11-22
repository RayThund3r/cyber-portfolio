// src/utils/chatEngine/webSearch.ts
//
// Key-less web lookup via Wikipedia (CORS-enabled, free, no API key).
//   - full-text search (finds "gaming computer" for "best gaming pcs", not just title matches)
//   - checks the top 3 results and rejects irrelevant / disambiguation / unsafe pages
//   - 4.5s timeout + abort support
//   - answers are cached locally (see learningEngine.cacheAnswer), with fuzzy repeat matching

import { tokens, tokenMatch } from './text';
import { cacheAnswer, getCachedAnswer } from './learningEngine';
import { evaluateSearchResultQuality } from './evaluator';
import { Candidate, WebAnswer, answerFromCandidates, parseQuestion, STALE_NOTE } from './webAnswer';

export interface WebResult {
  title: string;
  extract: string;
  imageUrl?: string;
  url?: string;
  fromCache?: boolean;
  /** 0..1: how sure we are the page is about what was asked. */
  confidence?: number;
  /** The fact can go stale (office holders, records, prices): show a note. */
  volatile?: boolean;
  /** Set when a page was found but failed the safety check; show this text instead of the page. */
  blockedReply?: string;
}

const PREFIXES =
  /^(gimme some examples of|give me examples of|examples of|what are examples of|what is an?|what is the|what is|what are|what'?s|explain|who is|who was|define|tell me about|how does an?|how do|why do|why does|best|top)\s+/i;

export function sanitizeQueryForSearch(query: string): string {
  return query
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[?.,!]/g, '')
    .trim()
    .replace(PREFIXES, '')
    .trim();
}

const PERSONAL = /\b(my|i|me|you|your|yourself|urself|myself|yourselves|ourselves|we|our|im|i'm|should|can i|could i|do i)\b/;

/** Questions an encyclopedia cannot answer: live prices, weather, news, "near me"... */
export function needsLiveData(query: string): boolean {
  return /\b(weather|news|score|scores|fixtures|price of|prices of|cheapest|near me|nearby|today|tonight|right now|live|latest|stock|exchange rate|forex|for sale|where to buy)\b/i.test(
    query
  );
}

/** Does this look like an informational question rather than a personal/repair one? */
export function looksLikeLookup(query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!/[a-z]{3,}/.test(q)) return false; // phone numbers, dates, symbols
  if (needsLiveData(q)) return false;
  if (/\b(yourself|urself|myself|this (site|chat|bot|assistant|website)|your (owner|creator|name|portfolio))\b/.test(q)) return false; // about me / about this site, never an encyclopedia topic
  if (/^(what|who|when|where|which|why|how)\b/.test(q)) return !PERSONAL.test(q);
  if (/^(define|explain|tell me about|examples? of|types? of|difference between|meaning of|history of|list of|best|top|compare)\b/.test(q))
    return true;
  const n = q.split(/\s+/).length;
  return n <= 6 && !PERSONAL.test(q); // short noun phrase: "quantum computing", "how solar panels work"
}

async function fetchJson(url: string, outer?: AbortSignal, ms = 4500): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  outer?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

const WIKI = 'https://en.wikipedia.org/w/api.php';

/** One request returns several candidate pages with their openings, ranks, links and thumbnails. */
async function candidatesFor(query: string, signal?: AbortSignal): Promise<Candidate[]> {
  const url =
    `${WIKI}?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=8&gsrnamespace=0` +
    `&prop=extracts|pageimages|info&exintro=1&explaintext=1&exlimit=max&exsentences=6&piprop=thumbnail&pithumbsize=300&inprop=url&redirects=1&format=json&origin=*`;
  const data = await fetchJson(url, signal);
  const pages = data?.query?.pages;
  if (pages && typeof pages === 'object') {
    return Object.values<any>(pages)
      .map((p) => ({ title: String(p.title || ''), extract: String(p.extract || ''), index: typeof p.index === 'number' ? p.index : undefined, url: p.fullurl, image: p.thumbnail?.source } as Candidate))
      .filter((c) => c.title && c.extract);
  }
  // Fallback when the combined call is unavailable: classic title search, then one summary per title.
  const search = await fetchJson(`${WIKI}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&srprop=&format=json&origin=*`, signal);
  const titles: string[] = (search?.query?.search || []).map((r: any) => r.title);
  const out: Candidate[] = [];
  for (let i = 0; i < Math.min(4, titles.length); i++) {
    const sum = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[i].replace(/ /g, '_'))}`, signal);
    if (sum?.extract && sum.type !== 'disambiguation') out.push({ title: sum.title, extract: sum.extract, index: i + 1, url: sum.content_urls?.desktop?.page, image: sum.thumbnail?.source });
  }
  return out;
}

function toResult(a: WebAnswer, mode: string, raw: string): WebResult {
  const quality = evaluateSearchResultQuality(a.text, raw, mode, a.title);
  if (!quality.isSafe) return { title: a.title, extract: '', blockedReply: quality.redirectReply };
  return { title: a.title, extract: a.text, imageUrl: a.image, url: a.url, confidence: a.confidence, volatile: a.volatile };
}

/** Look the question up and return a page ONLY if it is really about what was asked. */
export async function searchWeb(
  rawQuery: string,
  mode: string,
  signal?: AbortSignal
): Promise<WebResult | null> {
  const cached = getCachedAnswer(rawQuery);
  if (cached) {
    return { title: cached.title, extract: cached.extract, imageUrl: cached.imageUrl, fromCache: true, confidence: 0.8 };
  }
  const pq = parseQuestion(rawQuery);
  if (pq.must.length === 0 || pq.topic.length < 2) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  // "X vs Y": look both up and show them side by side.
  if (pq.kind === 'compare' && pq.pair) {
    const [a, b] = await Promise.all(pq.pair.map(async (side) => {
      const sp = parseQuestion(`what is ${side}`);
      return answerFromCandidates(sp, await candidatesFor(sp.topic, signal));
    }));
    if (a && b && a.title !== b.title) {
      const first = (t: string) => t.split(/(?<=[.!?])\s+/)[0];
      const res: WebResult = { title: `${a.title} vs ${b.title}`, extract: `**${a.title}:** ${first(a.text)}\n\n**${b.title}:** ${first(b.text)}`, url: a.url, confidence: Math.min(a.confidence, b.confidence) };
      return res;
    }
    // fall through: treat as a single-topic lookup on the first side
  }

  const queries = [pq.topic];
  const m = /^(.+?) of (?:the )?(.+)$/.exec(pq.topic);
  if (m && pq.kind === 'attribute') queries.push(m[2]);
  const seen = new Set<string>();
  const cands: Candidate[] = [];
  for (const q of queries) {
    for (const c of await candidatesFor(q, signal)) if (!seen.has(c.title)) { seen.add(c.title); cands.push(c); }
    const early = answerFromCandidates(pq, cands);
    if (early && early.confidence >= 0.8) break; // an exact page was found: no need for more requests
  }
  const ans = answerFromCandidates(pq, cands);
  if (!ans) return null;
  const res = toResult(ans, mode, rawQuery);
  if (res.blockedReply) return res;
  if (res.confidence !== undefined && res.confidence >= 0.55) cacheAnswer(rawQuery, res.title, res.extract, res.imageUrl);
  return res;
}

export { STALE_NOTE };
