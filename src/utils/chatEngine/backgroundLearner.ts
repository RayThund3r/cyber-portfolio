// src/utils/chatEngine/backgroundLearner.ts
//
// COMPATIBILITY SHIM. The original "background intelligence" module. Its logic now lives in
// index.ts (pipeline), retriever.ts (knowledge search), webSearch.ts (lookup) and
// learningEngine.ts (learning). This file keeps the old `processBackgroundIntel()` export
// working so any other file that imports it does not break.

import { evaluateInputSafety } from './evaluator';
import { searchKnowledge } from './retriever';
import { searchWeb, sanitizeQueryForSearch } from './webSearch';
import { recordUserFeedback } from './learningEngine';

export interface IntelResult {
  synthesizedReply: string;
  learnedNewRule: boolean;
  imageUrl?: string;
}

export { sanitizeQueryForSearch };

export async function processBackgroundIntel(query: string, mode: string): Promise<IntelResult> {
  const clean = query.toLowerCase().trim();

  const safety = evaluateInputSafety(clean, mode);
  if (!safety.isSafe) {
    return { synthesizedReply: safety.safeReply || 'Request blocked by security policy.', learnedNewRule: false };
  }

  // 1. Built-in knowledge (hot PCs, types of computers, repairs, design...)
  const hit = searchKnowledge(query, 1)[0];
  if (hit && hit.confidence >= 0.5) {
    recordUserFeedback(clean, hit.entry.id);
    return {
      synthesizedReply: mode === 'EXPERT' ? hit.entry.expert : hit.entry.reply,
      learnedNewRule: true,
      imageUrl: hit.entry.image,
    };
  }

  // 2. Wikipedia lookup (typo-tolerant, cached)
  const web = await searchWeb(query, mode);
  if (web?.blockedReply) return { synthesizedReply: web.blockedReply, learnedNewRule: false };
  if (web) {
    return {
      synthesizedReply:
        mode === 'EXPERT' ? `SYS_INTEL_FETCH // Query "${query}" resolved to "${web.title}".\n\n${web.extract}` : web.extract,
      learnedNewRule: true,
      imageUrl: web.imageUrl,
    };
  }

  return {
    synthesizedReply:
      mode === 'EXPERT'
        ? `SYS_ACK // Telemetry query "${query}" logged. Specify domain parameters (Hardware / Vector Design / Code Stack).`
        : `I'm not sure about "${query}" yet. Could you tell me a bit more about what you'd like to build, troubleshoot, or design?`,
    learnedNewRule: false,
  };
}
