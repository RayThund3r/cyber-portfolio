// src/utils/chatEngine/brain.ts
//
// "Home training": answers the owner typed into the admin panel (Chat Lab → Train). They are fetched once per visit from
// /api/brain, cached for a few minutes, and merged into the assistant's knowledge. If the fetch fails the assistant simply
// runs on its built-in knowledge, nothing breaks.

import type { KnowledgeEntry } from './types';
import { setTaughtKnowledge } from './knowledgeBase';
import { resetKnowledgeIndex } from './retriever';
import { normalize, tokenMatch, tokens } from './text';

export interface BrainItem { id: string; q: string[]; a: string; l?: string }

const CACHE_KEY = 'cyber_chat_brain_v1';
const TTL = 10 * 60 * 1000;
let loaded: Promise<void> | null = null;
let items: BrainItem[] = [];

function toEntry(b: BrainItem): KnowledgeEntry {
  const reply = b.a;
  return {
    id: 'taught:' + b.id,
    domain: 'GENERAL_QA',
    title: b.q[0],
    keywords: b.q,
    content: b.a,
    reply,
    expert: reply,
    suggestions: b.l ? ['Open ' + b.l.replace(/^\//, '').split(/[?#]/)[0] || 'home'] : undefined,
  };
}

export function applyBrain(list: BrainItem[]): void {
  items = (Array.isArray(list) ? list : []).filter((b) => b && Array.isArray(b.q) && b.q.length && typeof b.a === 'string' && b.a);
  setTaughtKnowledge(items.map(toEntry));
  resetKnowledgeIndex();
}

/** Page the owner linked to a taught answer (so the widget can offer it as a button). */
export function taughtLink(entryId?: string): string | undefined {
  if (!entryId || !entryId.startsWith('taught:')) return undefined;
  return items.find((b) => 'taught:' + b.id === entryId)?.l;
}

/**
 * A question that IS one of the taught phrasings (or near enough: same content words) is answered by the owner's text
 * before any built-in rule can intercept it.
 */
export function matchTaught(input: string): BrainItem | null {
  if (!items.length) return null;
  const nq = normalize(input);
  if (!nq) return null;
  const qt = tokens(input);
  if (!qt.length) return null;
  let best: { b: BrainItem; s: number } | null = null;
  for (const b of items) {
    for (const p of b.q) {
      if (normalize(p) === nq) return b;
      const pt = tokens(p);
      if (!pt.length) continue;
      // How many of the taught phrase's content words does the visitor's question contain (typos and plurals allowed)?
      let matched = 0;
      for (const w of pt) if (qt.some((x) => tokenMatch(w, x))) matched++;
      const extra = Math.max(0, qt.length - matched);
      const cover = matched / pt.length;
      // A one-word phrase ("warranty") only counts for a short question; otherwise the question must carry most of the phrase
      // and not much that is new ("opening hours on sunday?" fits "opening hours", "iphone 13 pro max screen price" does not).
      const ok = pt.length === 1 ? matched === 1 && qt.length <= 2 : matched >= 2 && cover >= 0.8 && extra <= Math.max(2, Math.ceil(pt.length * 0.6));
      if (!ok) continue;
      const score = cover - extra * 0.05;
      if (!best || score > best.s) best = { b, s: score };
    }
  }
  return best ? best.b : null;
}

export function loadBrain(): Promise<void> {
  if (loaded) return loaded;
  loaded = (async () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { t: number; items: BrainItem[] };
        if (c && Date.now() - c.t < TTL) { applyBrain(c.items); return; }
      }
    } catch { /* storage blocked */ }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch('/api/brain', { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      const data = (await res.json()) as { items?: BrainItem[] };
      applyBrain(data.items || []);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), items: data.items || [] })); } catch { /* ignore */ }
    } catch { /* offline or no storage: built-in knowledge only */ }
  })();
  return loaded;
}
