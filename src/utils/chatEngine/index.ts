// src/utils/chatEngine/index.ts

import { PersonaMode, SessionMemory, ProcessingResult } from './types';
import { handleSystemQuery } from './systemHandlers';
import { getActiveKnowledgeBase } from './knowledgeBase';
import { isGibberish } from './learningEngine';
import { processBackgroundIntel } from './backgroundLearner';
import { evaluateInputSafety } from './evaluator';

/**
 * Main Chat Engine Entry Point
 * Evaluates inputs through safety, gibberish, system, knowledge base,
 * and asynchronous background intelligence layers.
 */
export async function processChatQuery(
  input: string,
  mode: PersonaMode,
  memory: SessionMemory
): Promise<ProcessingResult> {
  const query = input.toLowerCase().trim();
  const count = memory.interactionCount + 1;

  // 1. Immediate Safety & Policy Guardrail Check
  const safetyCheck = evaluateInputSafety(query, mode);
  if (!safetyCheck.isSafe) {
    const safetyReply = safetyCheck.safeReply || "Request blocked by security policy.";
    return {
      reply: safetyReply,
      updatedMemory: {
        ...memory,
        interactionCount: count,
        conversationHistory: [
          ...memory.conversationHistory,
          { role: 'user', text: input },
          { role: 'assistant', text: safetyReply }
        ]
      }
    };
  }

  // 2. Advanced Gibberish, Keyboard Smash & Meta-Talk Filter
  if (isGibberish(query)) {
    const gibberishReply = mode === 'EXPERT'
      ? "SYS_INPUT_ERR // High entropy character sequence or meta-test detected. Suppressing raw execution."
      : "Caught me! 😄 That looks like a test or some scrambled text. Feel free to ask me anything about hardware repairs, logo/brand design, or web projects!";

    return {
      reply: gibberishReply,
      updatedMemory: {
        ...memory,
        interactionCount: count,
        conversationHistory: [
          ...memory.conversationHistory,
          { role: 'user', text: input },
          { role: 'assistant', text: gibberishReply }
        ]
      }
    };
  }

  // 3. Real-Time System Handlers (Time, Date, Status, Memory Purge)
  const systemReply = handleSystemQuery(query, mode);
  if (systemReply) {
    return {
      reply: systemReply,
      updatedMemory: {
        ...memory,
        interactionCount: count,
        lastTopic: 'SYSTEM_TIME',
        conversationHistory: [
          ...memory.conversationHistory,
          { role: 'user', text: input },
          { role: 'assistant', text: systemReply }
        ]
      }
    };
  }

  // 4. Active Knowledge Base Matching (Static Knowledge + Silent Dynamic Local Storage)
  const knowledgeBase = getActiveKnowledgeBase();
  for (const entry of knowledgeBase) {
    if (entry.keywords.some(kw => query.includes(kw))) {
      const responseText = mode === 'EXPERT' ? entry.expertResponse : entry.humanResponse;
      return {
        reply: responseText,
        updatedMemory: {
          ...memory,
          interactionCount: count,
          lastTopic: entry.domain,
          conversationHistory: [
            ...memory.conversationHistory,
            { role: 'user', text: input },
            { role: 'assistant', text: responseText }
          ]
        }
      };
    }
  }

  // 5. UNKNOWN / COMPLEX QUERY: Asynchronous Background OpenSearch & Intelligence Lookup
  const intel = await processBackgroundIntel(query, mode);

  return {
    reply: intel.synthesizedReply,
    imageUrl: intel.imageUrl,
    updatedMemory: {
      ...memory,
      interactionCount: count,
      conversationHistory: [
        ...memory.conversationHistory,
        { role: 'user', text: input },
        { role: 'assistant', text: intel.synthesizedReply }
      ]
    }
  };
}