// src/utils/chatEngine/backgroundLearner.ts

import { recordUserFeedback } from './learningEngine';
import { evaluateInputSafety, evaluateSearchResultQuality } from './evaluator';

interface IntelResult {
  synthesizedReply: string;
  learnedNewRule: boolean;
  imageUrl?: string;
}

/**
 * Strips emojis, special symbols, and question prefixes to isolate clean search queries.
 */
function sanitizeQueryForSearch(query: string): string {
  let clean = query.toLowerCase().trim();
  
  // Strip emojis and Unicode symbol ranges
  clean = clean.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  // Strip punctuation marks
  clean = clean.replace(/[?.,!]/g, '');
  // Strip common conversational question prefixes
  clean = clean.replace(/^(gimme some examples of|examples of|what are examples of|what is a|what is an|what is|what are|explain|who is|define|tell me about|how does a|how does an)\s+/i, '');
  
  return clean.trim();
}

/**
 * Resolves typos via Wikipedia OpenSearch API and fetches summary text + thumbnail image URL.
 */
async function resolveTypoAndFetchSearch(rawQuery: string): Promise<{ correctedQuery: string; extract: string; imageUrl?: string } | null> {
  const sanitized = sanitizeQueryForSearch(rawQuery);
  if (!sanitized || sanitized.length < 2) return null;

  try {
    // 1. Perform background OpenSearch for spelling correction / title resolution
    const searchEndpoint = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(sanitized)}&limit=1&format=json&origin=*`;
    const searchRes = await fetch(searchEndpoint);
    if (!searchRes.ok) return null;
    
    const searchData = await searchRes.json();
    const suggestions: string[] = searchData[1] || [];
    const targetTitle = suggestions.length > 0 ? suggestions[0] : sanitized;

    // 2. Fetch page summary & thumbnail media
    const summaryEndpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(targetTitle)}`;
    const summaryRes = await fetch(summaryEndpoint);
    if (!summaryRes.ok) return null;

    const summaryData = await summaryRes.json();

    // Reject raw disambiguation pages (e.g. "Sup or SUP may refer to:")
    if (summaryData.type === 'disambiguation' || (summaryData.extract && summaryData.extract.includes('may refer to:'))) {
      return null;
    }

    if (summaryData.extract) {
      return {
        correctedQuery: targetTitle,
        extract: summaryData.extract,
        imageUrl: summaryData.thumbnail?.source
      };
    }

    return null;
  } catch (err) {
    console.warn("Background search worker execution failed:", err);
    return null;
  }
}

/**
 * Autonomous background intelligence processor.
 */
export async function processBackgroundIntel(
  query: string,
  mode: string
): Promise<IntelResult> {
  const cleanQuery = query.toLowerCase().trim();

  // 1. Security & Policy Guardrail Check
  const safetyCheck = evaluateInputSafety(cleanQuery, mode);
  if (!safetyCheck.isSafe) {
    return {
      synthesizedReply: safetyCheck.safeReply || "Request blocked by security policy.",
      learnedNewRule: false
    };
  }

  // 2. Greetings, Slang & Casual Emojis (e.g. 👋, 🔥, "sup", "yo")
  if (['sup', 'suo', 'yo', 'hi', 'hello', 'hey', '👋', '🔥', '💯'].includes(cleanQuery)) {
    return {
      synthesizedReply: mode === 'EXPERT'
        ? "SYS_ACK // Telemetry relay active. Standing by for user request."
        : "Hey! 👋 What's on your mind today? Need help with tech repairs, graphic design, or web dev?",
      learnedNewRule: false
    };
  }

  if (cleanQuery === 'help') {
    return {
      synthesizedReply: mode === 'EXPERT'
        ? "SYS_HELP // Available domains: [1. Hardware Diagnostics] [2. Brand / Graphic Design] [3. Web Engineering]. Specify intent."
        : "I'm here to help! Ask me about fixing hardware/PC issues, designing brand logos or embroidery vectors, or setting up web projects.",
      learnedNewRule: false
    };
  }

  // 3. Emotional / Stress Intent Interception
  if (['cooked', 'stressed', 'tired', 'exhausted', 'overwhelmed'].some(w => cleanQuery.includes(w))) {
    return {
      synthesizedReply: mode === 'EXPERT'
        ? "SYS_WARN // Operational stress threshold reached. Recommend stepping away from terminal for diagnostic reset."
        : "Hang in there! ☕ Take a quick breather, stretch, and step away from the screen for a few minutes. We can break down whatever problem you're facing once you're fresh!",
      learnedNewRule: false
    };
  }

  // 4. Specific Hardware Thermal & Cooling Intent
  if (cleanQuery.includes('hot') || cleanQuery.includes('overheat') || cleanQuery.includes('thermal') || cleanQuery.includes('fan')) {
    recordUserFeedback(cleanQuery, 'HARDWARE_REPAIR');
    return {
      synthesizedReply: mode === 'EXPERT'
        ? `SYS_THERMAL_DIAG // Elevated thermal reading detected for "${query}". Inspect CPU/GPU paste degradation, intake dust filters, and background thread utilization.`
        : "A PC running hot is usually caused by dried thermal paste, clogged dust filters, or heavy background CPU usage. Is this happening on a desktop or a laptop?",
      learnedNewRule: true,
      imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80"
    };
  }

  // 5. Examples & Category Intent (e.g. "examples of computers")
  if (cleanQuery.includes('examples of computer') || cleanQuery.includes('types of computer')) {
    recordUserFeedback(cleanQuery, 'HARDWARE_REPAIR');
    return {
      synthesizedReply: "Here are the main categories of computers used today:\n\n1. **Personal Computers (PCs):** Desktops and Laptops (macOS, Windows, Linux) for daily productivity and gaming.\n2. **Mobile Devices:** Smartphones and Tablets powered by ARM architectures.\n3. **Servers & Cloud Nodes:** High-performance infrastructure hosting databases and APIs.\n4. **Workstations:** Systems built for heavy 3D rendering, video editing, or CAD.\n5. **Embedded Systems:** Microcontrollers operating smart appliances, automotive modules, and IoT tech.",
      learnedNewRule: true,
      imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80"
    };
  }

  // 6. Perform Background Typo Correction, OpenSearch, and Summary Retrieval
  const resolved = await resolveTypoAndFetchSearch(query);
  const evaluation = evaluateSearchResultQuality(resolved?.extract || null, query, mode);

  if (evaluation.isRelevant && resolved) {
    // Record knowledge silently in local storage
    recordUserFeedback(cleanQuery, 'GENERAL_QA');

    const sanitizedInput = sanitizeQueryForSearch(query);
    const isTypoCorrection = resolved.correctedQuery.toLowerCase() !== sanitizedInput && sanitizedInput.length > 2;
    const prefix = isTypoCorrection 
      ? `*(Matched close concept **${resolved.correctedQuery}**)*:\n\n` 
      : '';

    if (mode === 'EXPERT') {
      return {
        synthesizedReply: `SYS_INTEL_FETCH // Query "${query}" resolved to "${resolved.correctedQuery}".\n\n${resolved.extract}`,
        learnedNewRule: true,
        imageUrl: resolved.imageUrl
      };
    }

    return {
      synthesizedReply: prefix + resolved.extract,
      learnedNewRule: true,
      imageUrl: resolved.imageUrl
    };
  }

  // 7. Conversational Fallback for Unknown Queries
  return {
    synthesizedReply: mode === 'EXPERT'
      ? `SYS_ACK // Telemetry query "${query}" logged. Specify domain parameters (Hardware / Vector Design / Code Stack).`
      : `I'm following along with "${query}". Could you tell me a bit more about what you'd like to build, troubleshoot, or design?`,
    learnedNewRule: false
  };
}