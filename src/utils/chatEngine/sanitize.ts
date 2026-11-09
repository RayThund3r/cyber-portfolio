// src/utils/chatEngine/sanitize.ts
//
// Everything that enters the engine passes through here first, and everything restored from
// storage passes through sanitizeMemory(). Goal: odd, hostile or corrupted input can slow nothing
// down, break no regex, and never grow memory without bound.

import type { SessionMemory } from './types';

export const MAX_ENGINE_INPUT = 1500;

/** Control characters (except tab/newline), zero-width and bidi-override characters. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function cleanInput(raw: unknown): string {
  let s = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
  s = s.slice(0, MAX_ENGINE_INPUT * 4); // cap BEFORE any regex work
  try {
    s = s.normalize('NFC');
  } catch {
    /* lone surrogates etc.: keep as is */
  }
  s = s
    .replace(CONTROL, ' ')
    .replace(INVISIBLE, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(.)\1{5,}/gsu, '$1$1$1'); // "aaaaaaaaaa" / "!!!!!!!!!" -> three
  return s.slice(0, MAX_ENGINE_INPUT).trim();
}

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function safeString(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/**
 * Make sure whatever came out of storage (or an older version of the site) has the shape the engine
 * expects, with sane sizes. Never throws; always returns a usable memory object.
 */
export function sanitizeMemory(input: unknown): SessionMemory {
  const m = (input && typeof input === 'object' ? input : {}) as Partial<SessionMemory>;
  const ctxIn = m.userContext && typeof m.userContext === 'object' && !Array.isArray(m.userContext) ? m.userContext : {};
  const userContext: Record<string, any> = {};
  let n = 0;
  for (const key of Object.keys(ctxIn)) {
    if (BAD_KEYS.has(key) || n >= 40) continue;
    const v = (ctxIn as Record<string, any>)[key];
    if (typeof v === 'string') userContext[key] = v.slice(0, 500);
    else if (typeof v === 'number' || typeof v === 'boolean') userContext[key] = v;
    else if (v && typeof v === 'object') {
      // structured state (dialogue): keep only if it stays small
      try {
        if (JSON.stringify(v).length <= 60_000) userContext[key] = v;
      } catch {
        /* drop it */
      }
    }
    n++;
  }
  const history = Array.isArray(m.conversationHistory) ? m.conversationHistory : [];
  const conversationHistory = history
    .filter((t: any) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
    .slice(-24)
    .map((t: any) => ({ role: t.role as 'user' | 'assistant', text: safeString(t.text, 2000) }));
  return {
    interactionCount: Number.isFinite(m.interactionCount) ? Math.max(0, Math.min(1e6, Number(m.interactionCount))) : 0,
    lastTopic: typeof m.lastTopic === 'string' ? m.lastTopic.slice(0, 40) : 'GREETINGS',
    userContext,
    conversationHistory,
  };
}
