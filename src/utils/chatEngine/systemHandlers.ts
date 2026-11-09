// src/utils/chatEngine/systemHandlers.ts

import { PersonaMode, SystemAction } from './types';
import { normalize } from './text';
import { clearAllChatStorage } from './learningEngine';

export interface SystemResult {
  reply: string;
  action?: SystemAction;
}

/**
 * Deterministic queries: time/date, engine status, memory reset.
 * Uses whole-phrase patterns — the old `includes('time')` hijacked
 * "sometimes", "update", "status of my repair", etc.
 */
export function handleSystemQuery(
  query: string,
  mode: PersonaMode,
  aiLabel: string
): SystemResult | null {
  const clean = normalize(query);

  // 1. Time & date
  if (
    /\b(what('?s| is) the (current )?(time|date)|what time is it|what('?s| is) (today'?s )?date|what day is (it|today)|current (time|date)|time now|date today|today'?s date|what is today)\b/.test(
      clean
    ) ||
    /^(time|date|clock)$/.test(clean)
  ) {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    if (mode === 'EXPERT') {
      const off = -now.getTimezoneOffset() / 60;
      return {
        reply: `SYS_RTC_SYNC // Epoch: ${now.getTime()} | Local: ${formattedTime} | Date: ${formattedDate} | UTC${off >= 0 ? '+' : ''}${off}h`,
      };
    }
    return { reply: `It's **${formattedTime}** on **${formattedDate}** 🕒` };
  }

  // 2. Engine status
  if (/\b(system|engine|chat) (status|health)\b|\buptime\b|^(ping|status)$/.test(clean)) {
    return {
      reply:
        mode === 'EXPERT'
          ? `SYS_DIAG // Node: ONLINE | Language model: ${aiLabel} | Retriever: READY | Web lookup: READY | Guardrails: ENFORCED`
          : `All systems are up! 🚀 Language model: **${aiLabel}**. Knowledge search, web lookup and safety checks are all running.`,
    };
  }

  // 3. Reset
  if (/^(clear|reset|wipe|forget)( my)?( chat| memory| cache| history| everything| me)$/.test(clean)) {
    clearAllChatStorage();
    return {
      action: 'RESET_CHAT',
      reply:
        mode === 'EXPERT'
          ? 'SYS_MEM_PURGE // Local chat history and cache wiped. Baseline restored.'
          : 'Done — I cleared our chat history and everything stored in this browser. 🧹',
    };
  }

  return null;
}
