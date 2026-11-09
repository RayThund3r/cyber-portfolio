// src/utils/chatEngine/learningEngine.ts
//
// Browser-side persistence + learning. Everything here lives in the visitor's own browser
// (localStorage). It makes THEIR experience better; to improve the shared bot for everyone,
// use getUnansweredQueries() (run `chatUnanswered()` in the console) and add knowledge entries.
//
//   session      chat history survives page reloads
//   answer cache web answers are stored; similar repeat questions are instant and work offline
//   aliases      👍/👎 on a reply teaches the retriever which phrasing maps to which entry
//   unanswered   questions the bot could not answer
//   prefs        whether the visitor enabled the on-device AI (and which model)
//
// The ORIGINAL learning API (getLearnedMemory / recordUserFeedback) is kept and now feeds the
// alias system, so old imports keep working and old saved data is not lost.

import { sanitizeMemory } from './sanitize';
import { reportUnanswered } from '@/utils/analytics';
import {
  Message,
  SessionMemory,
  CachedAnswer,
  UnansweredItem,
  LearnedMemoryItem,
  LearnedAlias,
} from './types';
import { normalize, tokens } from './text';
import { KNOWLEDGE } from './knowledgeBase';

const KEYS = {
  session: 'cyber_chat_v2_session',
  cache: 'cyber_chat_v2_answer_cache',
  unanswered: 'cyber_chat_v2_unanswered',
  prefs: 'cyber_chat_v2_prefs',
  aliases: 'cyber_chat_v2_aliases',
  // Same key the original engine used, so existing visitors keep their saved data.
  learned: 'cyber_chat_engine_learned_memory_v1',
};

const hasStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

function read<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Chat storage write failed:', err);
  }
}

/* ---------------- session ---------------- */

export interface SavedSession {
  messages: Message[];
  memory: SessionMemory;
}

export function loadSession(): SavedSession | null {
  const s = read<SavedSession | null>(KEYS.session, null);
  if (!s || !Array.isArray(s.messages) || !s.memory) return null;
  // Never restore a half-streamed message.
  s.messages = s.messages
    .filter((m) => m && typeof m === 'object' && typeof m.text === 'string' && (m.sender === 'user' || m.sender === 'bot'))
    .map((m) => ({ ...m, streaming: false }));
  s.memory = sanitizeMemory(s.memory);
  return s;
}

export function saveSession(messages: Message[], memory: SessionMemory): void {
  write(KEYS.session, {
    messages: messages.slice(-60),
    memory: { ...memory, conversationHistory: memory.conversationHistory.slice(-24) },
  });
}

/* ---------------- answer cache (fuzzy) ---------------- */

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((x) => {
    if (b.has(x)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

export function getCachedAnswer(query: string): CachedAnswer | null {
  const key = normalize(query);
  const list = read<CachedAnswer[]>(KEYS.cache, []);
  const exact = list.find((c) => c.query === key);
  if (exact) return exact;

  // "what is a gpu" ≈ "gpu?" ≈ "what's a GPU" — reuse the saved answer for near-identical questions.
  const qSet = new Set(tokens(query));
  if (qSet.size === 0) return null;
  let best: CachedAnswer | null = null;
  let bestScore = 0;
  for (const c of list) {
    const s = jaccard(qSet, new Set(tokens(c.query)));
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return bestScore >= 0.8 ? best : null;
}

export function cacheAnswer(query: string, title: string, extract: string, imageUrl?: string): void {
  const key = normalize(query);
  if (!key) return;
  const list = read<CachedAnswer[]>(KEYS.cache, []).filter((c) => c.query !== key);
  list.unshift({ query: key, title, extract, imageUrl, timestamp: Date.now() });
  write(KEYS.cache, list.slice(0, 60));
}

/* ---------------- learned aliases (👍 / 👎) ---------------- */

export function getLearnedAliases(): LearnedAlias[] {
  const list = read<LearnedAlias[]>(KEYS.aliases, []);
  return Array.isArray(list) ? list : [];
}

export function recordLearnedAlias(query: string, entryId: string, polarity: 1 | -1): void {
  const q = normalize(query);
  if (!q || !entryId) return;
  const list = getLearnedAliases().filter((a) => !(a.query === q && a.entryId === entryId));
  list.unshift({ query: q, entryId, polarity, timestamp: Date.now() });
  write(KEYS.aliases, list.slice(0, 150));
}

/* ---------------- ORIGINAL learning API (kept for compatibility) ---------------- */

/** Original: list of silently learned patterns. */
export function getLearnedMemory(): LearnedMemoryItem[] {
  const list = read<LearnedMemoryItem[]>(KEYS.learned, []);
  return Array.isArray(list) ? list : [];
}

/**
 * Original: record a pattern against an intent/domain. Still stores the pattern, and now also
 * links it to the best-matching knowledge entry (by id, or the first entry in that domain) so it
 * actually influences retrieval.
 */
export function recordUserFeedback(pattern: string, mappedIntent: string): void {
  const clean = pattern.toLowerCase().trim();
  if (!clean || clean.length < 2) return;

  const current = getLearnedMemory();
  if (!current.some((i) => i.pattern === clean)) {
    write(KEYS.learned, [{ pattern: clean, mappedIntent, timestamp: Date.now() }, ...current].slice(0, 100));
  }

  const entry = KNOWLEDGE.find((e) => e.id === mappedIntent) || KNOWLEDGE.find((e) => e.domain === mappedIntent);
  if (entry) recordLearnedAlias(clean, entry.id, 1);
}

/* ---------------- unanswered log ---------------- */

export function logUnanswered(query: string): void {
  const q = query.trim();
  if (!q) return;
  reportUnanswered(q); // lets the owner see what visitors asked (aggregated, scrubbed server-side)
  // Also tell the page that the assistant missed a question.
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sys:gap', { detail: q })); } catch { /* ignore */ }
  const list = read<UnansweredItem[]>(KEYS.unanswered, []);
  if (list.some((i) => i.query.toLowerCase() === q.toLowerCase())) return;
  list.unshift({ query: q, timestamp: Date.now() });
  write(KEYS.unanswered, list.slice(0, 50));
}

/** Call from the browser console: chatUnanswered() — see what visitors asked that the bot missed. */
export function getUnansweredQueries(): UnansweredItem[] {
  return read<UnansweredItem[]>(KEYS.unanswered, []);
}

/* ---------------- preferences ---------------- */

export interface ChatPrefs {
  aiEnabled: boolean;
  modelId?: string;
}

export function getPrefs(): ChatPrefs {
  return read<ChatPrefs>(KEYS.prefs, { aiEnabled: false });
}

export function setPrefs(p: Partial<ChatPrefs>): void {
  write(KEYS.prefs, { ...getPrefs(), ...p });
}

/* ---------------- reset ---------------- */

export function clearAllChatStorage(): void {
  if (!hasStorage()) return;
  try {
    // Keep prefs (the visitor's AI choice) — wipe everything else.
    [KEYS.session, KEYS.cache, KEYS.unanswered, KEYS.aliases, KEYS.learned].forEach((k) =>
      localStorage.removeItem(k)
    );
  } catch {
    /* ignore */
  }
}

/* ---------------- gibberish ---------------- */

/**
 * Keyboard smashes and repeated characters. The old vowel-ratio test flagged
 * real words like "strengths"; this checks for impossible consonant runs instead.
 */
export function isGibberish(input: string): boolean {
  const clean = input.toLowerCase().trim();
  if (!clean) return true;

  // pure punctuation / digits with no letters, but allow short numbers like "5"
  if (!/\p{L}/u.test(clean)) return clean.length > 8 && !/\s/.test(clean);

  if (/(.)\1{4,}/.test(clean)) return true; // "aaaaa"
  if (/^[asdfghjkl;']{5,}$|^[qwertyuiop]{5,}$|^[zxcvbnm,.]{5,}$/.test(clean)) return true;

  const words = clean.split(/\s+/);
  if (words.length <= 2) {
    return words.every((w) => w.length >= 6 && /[^aeiouy\d\s'.-]{6,}/.test(w));
  }
  return false;
}
