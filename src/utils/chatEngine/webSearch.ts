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

export interface WebResult {
  title: string;
  extract: string;
  imageUrl?: string;
  url?: string;
  fromCache?: boolean;
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

const PERSONAL = /\b(my|i|me|you|your|we|our|im|i'm|should|can i|could i|do i)\b/;

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

export async function searchWeb(
  rawQuery: string,
  mode: string,
  signal?: AbortSignal
): Promise<WebResult | null> {
  const cached = getCachedAnswer(rawQuery);
  if (cached) {
    return { title: cached.title, extract: cached.extract, imageUrl: cached.imageUrl, fromCache: true };
  }

  const q = sanitizeQueryForSearch(rawQuery);
  if (q.length < 2) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  const search = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&srprop=&format=json&origin=*`,
    signal
  );
  const titles: string[] = (search?.query?.search || []).map((r: any) => r.title);
  if (titles.length === 0) return null;

  const qTokens = tokens(q);
  for (const title of titles) {
    // Cheap pre-filter: title must share at least one meaningful word with the query.
    const tTokens = tokens(title);
    if (qTokens.length > 0 && !qTokens.some((qt) => tTokens.some((tt) => tokenMatch(qt, tt)))) continue;

    const summary = await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      signal
    );
    if (!summary?.extract || summary.type === 'disambiguation') continue;

    const quality = evaluateSearchResultQuality(summary.extract, rawQuery, mode, summary.title);
    if (!quality.isSafe) {
      return { title: summary.title, extract: '', blockedReply: quality.redirectReply };
    }
    if (!quality.isRelevant) continue;

    const result: WebResult = {
      title: summary.title,
      extract: summary.extract,
      imageUrl: summary.thumbnail?.source,
      url: summary.content_urls?.desktop?.page,
    };
    cacheAnswer(rawQuery, result.title, result.extract, result.imageUrl);
    return result;
  }
  return null;
}
