// src/utils/chatEngine/evaluator.ts

// Safety & policy blacklists
const INAPPROPRIATE_PATTERNS = [
  'hack', 'exploit', 'ddos', 'crack', 'nuke', 'phish', 'bypass',
  'malware', 'virus', 'illegal', 'stolen', 'threat'
];

export interface EvaluationResult {
  isSafe: boolean;
  isRelevant: boolean;
  redirectReply?: string;
}

// 1. Evaluate User Input Safety & Policy Compliance
export function evaluateInputSafety(input: string, mode: string): { isSafe: boolean; safeReply?: string } {
  if (!input) return { isSafe: true };
  const clean = input.toLowerCase().trim();

  const flagged = INAPPROPRIATE_PATTERNS.some(word => clean.includes(word));
  if (flagged) {
    if (mode === 'EXPERT') {
      return {
        isSafe: false,
        safeReply: "SYS_SECURITY_ALERT // Unsafe payload or policy-violating string flagged. Request terminated. Portfolio node strictly provides authorized hardware repair, design, and software engineering services."
      };
    }

    return {
      isSafe: false,
      safeReply: "I can't assist with hacking or unauthorized security requests! I specialize in hardware repairs (mobile/PC), brand & graphic design, and web development. How can I help you with one of those?"
    };
  }

  return { isSafe: true };
}

// 2. Evaluate if Search Results are Worth Presenting and Safe
export function evaluateSearchResultQuality(
  rawSearchText: string | null,
  query: string,
  mode: string
): EvaluationResult {
  if (!rawSearchText || rawSearchText.length < 30) {
    return {
      isSafe: true,
      isRelevant: false,
      redirectReply: mode === 'EXPERT'
        ? `SYS_EVAL // Low confidence score for query "${query}". Redirecting to core node telemetry.`
        : `I'm following along! Could you tell me a bit more about what you'd like to build, troubleshoot, or design?`
    };
  }

  // Check if retrieved text contains unsafe words
  const lowerResult = rawSearchText.toLowerCase();
  const containsUnsafeContent = INAPPROPRIATE_PATTERNS.some(word => lowerResult.includes(word));

  if (containsUnsafeContent) {
    return {
      isSafe: false,
      isRelevant: false,
      redirectReply: mode === 'EXPERT'
        ? "SYS_CONTENT_FILTER // Retrieved telemetry failed safety evaluation."
        : "I found some results, but they didn't meet safety standards. I'm happy to help you with technical device troubleshooting or creative branding instead!"
    };
  }

  return { isSafe: true, isRelevant: true };
}