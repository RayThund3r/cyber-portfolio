// src/utils/chatEngine/retriever.ts
//
// Typo-tolerant BM25 retriever over the knowledge base. This replaces the old
// `keywords.some(kw => query.includes(kw))` check, which matched "hi" inside
// "this" and never understood paraphrases.
//
// Confidence (how sure we are that an entry answers the question) is deliberately stricter than
// the ranking score: it counts a matched word fully only when it appears in the entry's TITLE or
// KEYWORDS (its real topic). A word found only somewhere in the body text counts for little, and a
// question made only of vague words ("ask", "use", "something") is never confident.

import { KnowledgeEntry, KnowledgeHit } from './types';
import { KNOWLEDGE } from './knowledgeBase';
import { tokens, tokenMatch, normalize } from './text';
import { getLearnedAliases } from './learningEngine';

/** Stemmed (see tokens()) question-framing words that carry no topic. */
const FRAMING = new Set(['differenc', 'between', 'better', 'best', 'explain', 'simpl', 'simply', 'enough', 'should', 'tell', 'mean', 'meaning', 'work', 'works', 'good', 'worth', 'recommend', 'recommendation', 'which', 'compar', 'compare', 'versus']);

/**
 * Words that say nothing about WHICH topic is meant. A query made only of these must never be
 * treated as a confident match.
 */
const GENERIC = new Set(['ask', 'use', 'tool', 'someth', 'anyth', 'interest', 'show', 'one', 'find', 'look', 'see', 'say', 'know', 'think', 'help', 'make', 'try', 'ok', 'okay', 'yes', 'sure', 'hello', 'thank', 'thanks', 'bad', 'new', 'old', 'big', 'small', 'recent', 'latest', 'most', 'least', 'more', 'less', 'different', 'other', 'another', 'next', 'last', 'first']);

/** Matches found only in an entry's body text (not its title/keywords) count for much less. */
const BODY_ONLY_WEIGHT = 0.35;

const K1 = 1.4;
const B = 0.75;

interface IndexedDoc {
  entry: KnowledgeEntry;
  tf: Map<string, number>;
  /** Stemmed words of the title and keywords: the entry's real topic. */
  field: Set<string>;
  /** Multi-word keywords as stemmed token lists ("hard drive" -> ["hard","driv"]). */
  phrases: string[][];
  length: number;
}

let index: IndexedDoc[] | null = null;
let df = new Map<string, number>();
let avgLen = 1;

function build(): IndexedDoc[] {
  const docs: IndexedDoc[] = KNOWLEDGE.map((entry) => {
    const tf = new Map<string, number>();
    const add = (ts: string[], weight: number) =>
      ts.forEach((t) => tf.set(t, (tf.get(t) || 0) + weight));
    add(tokens(entry.title), 3);
    entry.keywords.forEach((k) => add(tokens(k), 3));
    add(tokens(entry.content), 1);
    let length = 0;
    tf.forEach((v) => (length += v));
    const field = new Set<string>([...tokens(entry.title), ...entry.keywords.flatMap((k) => tokens(k))]);
    const phrases = entry.keywords.map((k) => tokens(k)).filter((p) => p.length >= 2);
    return { entry, tf, field, phrases, length };
  });
  df = new Map();
  docs.forEach((d) => d.tf.forEach((_, term) => df.set(term, (df.get(term) || 0) + 1)));
  avgLen = docs.reduce((s, d) => s + d.length, 0) / Math.max(1, docs.length);
  return docs;
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((x) => {
    if (b.has(x)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

function idf(term: string, n: number): number {
  const d = df.get(term) || 0;
  return Math.log(1 + (n - d + 0.5) / (d + 0.5));
}

/** Frequency of query term in doc, allowing typos (exact match wins). */
function fuzzyTf(doc: IndexedDoc, qTerm: string): { tf: number; term: string } | null {
  const exact = doc.tf.get(qTerm);
  if (exact) return { tf: exact, term: qTerm };
  if (qTerm.length < 4) return null;
  let best: { tf: number; term: string } | null = null;
  doc.tf.forEach((v, term) => {
    if (tokenMatch(qTerm, term) && (!best || v > best.tf)) best = { tf: v, term };
  });
  return best;
}

/** Is this query word part of the entry's topic (title/keywords), allowing a typo? */
function inField(doc: IndexedDoc, q: string, matched: string): boolean {
  if (doc.field.has(matched) || doc.field.has(q)) return true;
  if (q.length < 4) return false;
  for (const f of doc.field) if (tokenMatch(q, f)) return true;
  return false;
}

export function searchKnowledge(query: string, limit = 3): KnowledgeHit[] {
  if (!index) index = build();
  // Words that only frame a question ("what's the DIFFERENCE BETWEEN x and y", "which is BETTER", "EXPLAIN ... SIMPLY")
  // are rare in the index, so they used to outweigh the real topic and pull in the wrong entry.
  const raw = tokens(query);
  const content = raw.filter((t) => !FRAMING.has(t));
  const specific = content.filter((t) => !GENERIC.has(t));
  // Nothing specific left: the query is too vague to match confidently. Still rank, but cap confidence.
  const onlyGeneric = specific.length === 0;
  const qTokens = Array.from(new Set(specific.length ? specific : content.length ? content : raw));
  if (qTokens.length === 0) return [];

  const n = index.length;
  const maxIdf = Math.log(1 + (n + 0.5) / 0.5);
  // Terms nobody has ever seen count as maximally rare → they lower confidence.
  const weights = qTokens.map((t) => (df.has(t) ? idf(t, n) : maxIdf));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  // What this visitor has taught us (👍 = "that phrasing means this entry", 👎 = "wrong entry").
  const qSet = new Set(qTokens);
  const learnedBoost = new Map<string, number>(); // entryId -> similarity of best 👍 alias
  const learnedPenalty = new Set<string>(); // entryIds with a close 👎 alias
  for (const a of getLearnedAliases()) {
    const sim = jaccardSets(qSet, new Set(tokens(a.query)));
    if (sim < 0.7) continue;
    if (a.polarity === 1) learnedBoost.set(a.entryId, Math.max(learnedBoost.get(a.entryId) || 0, sim));
    else learnedPenalty.add(a.entryId);
  }

  const hits: KnowledgeHit[] = index.map((doc) => {
    let score = 0;
    let matchedWeight = 0;
    qTokens.forEach((q, i) => {
      const m = fuzzyTf(doc, q);
      if (!m) return;
      const termIdf = idf(m.term, n);
      const norm = 1 - B + B * (doc.length / avgLen);
      score += termIdf * ((m.tf * (K1 + 1)) / (m.tf + K1 * norm));
      matchedWeight += weights[i] * (inField(doc, q, m.term) ? 1 : BODY_ONLY_WEIGHT);
    });

    // Small bonus when the whole normalised query appears as a keyword phrase.
    const nq = normalize(query);
    if (doc.entry.keywords.some((k) => normalize(k) === nq)) score *= 1.3;

    let confidence = matchedWeight / totalWeight;

    // A keyword phrase ("hard drive", "back up", "speed up") fully present in the question is a strong, specific signal.
    if (doc.phrases.some((p) => p.every((w) => qSet.has(w)))) {
      score *= 1.25;
      confidence = Math.max(confidence, 0.85);
    }
    if (onlyGeneric) confidence = Math.min(confidence, 0.3);

    const boost = learnedBoost.get(doc.entry.id);
    if (boost) {
      score += 4 * boost;
      confidence = Math.max(confidence, 0.5 + 0.5 * boost);
    }
    if (learnedPenalty.has(doc.entry.id) && !boost) {
      score *= 0.25;
      confidence *= 0.5;
    }

    return { entry: doc.entry, score, confidence };
  });

  return hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Expose for tests / hot reload. */
export function resetKnowledgeIndex(): void {
  index = null;
}
