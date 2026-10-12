// src/utils/chatEngine/systemHandlers.ts

import { PersonaMode } from './types';

/**
 * Handles deterministic system queries such as time, date, status, and health checks.
 * Returns a response string if the query matches a system intent, or null to pass through.
 */
export function handleSystemQuery(query: string, mode: PersonaMode): string | null {
  const clean = query.toLowerCase().trim();

  // 1. Time & Date Interception
  if (
    clean.includes('time') ||
    clean.includes('date') ||
    clean.includes('clock') ||
    clean.includes('day is it')
  ) {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    if (mode === 'EXPERT') {
      return `SYS_RTC_SYNC // Epoch: ${now.getTime()} | Local Time: ${formattedTime} | Date: ${formattedDate} | Timezone Offset: UTC${now.getTimezoneOffset() / -60}h`;
    }

    return `The current time is **${formattedTime}** on **${formattedDate}** 🕒`;
  }

  // 2. System Status & Health Checks
  if (
    clean.includes('status') ||
    clean.includes('system health') ||
    clean.includes('engine status') ||
    clean.includes('uptime') ||
    clean.includes('ping')
  ) {
    if (mode === 'EXPERT') {
      return "SYS_DIAG // Node Status: ONLINE (100%) | Dynamic Memory: ACTIVE | Search Worker: READY | Security Guardrails: ENFORCED";
    }

    return "All systems are running smoothly! 🚀 Memory storage, background search, and conversational engines are online and ready.";
  }

  // 3. Clear Local Storage / Memory Reset Command
  if (
    clean === 'clear memory' ||
    clean === 'reset memory' ||
    clean === 'clear cache'
  ) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cyber_chat_engine_learned_memory_v1');
    }

    if (mode === 'EXPERT') {
      return "SYS_MEM_PURGE // Local storage memory buffer successfully wiped. System returned to default baseline.";
    }

    return "Dynamic local memory has been cleared! 🧹 The chat engine has been reset to its baseline state.";
  }

  return null;
}