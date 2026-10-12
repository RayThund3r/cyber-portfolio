export interface MessageContext {
  role: 'user' | 'system';
  content: string;
}

export interface EngineResponse {
  reply: string;
  action: 'SCROLL_TO_PROJECTS' | 'OPEN_CONTACT' | 'START_DIAGNOSTIC' | 'NONE';
  suggestedPrompts?: string[];
}

// 1. Dynamic Response Generators based on natural phrasing
export function processIntelligentQuery(
  input: string,
  history: MessageContext[] = []
): EngineResponse {
  const q = input.toLowerCase().trim();

  // --- GREETINGS & INTROS ---
  if (/^(hi|hello|hey|yo|sup|greetings|who are you|what is this|help)/.test(q)) {
    return {
      reply: "SYS_ONLINE: Systems operational. I'm your embedded technical co-pilot. I handle custom hardware diagnostics, UI/UX architecture, and site automation. What are we optimizing today?",
      action: "NONE",
      suggestedPrompts: ["Diagnose PC Issue", "View Design Work", "Dispatch Message"]
    };
  }

  // --- HARDWARE & DIAGNOSTICS ---
  if (/(lag|slow|pc|laptop|phone|screen|battery|repair|fix|heat|hot|freeze|blue screen|gpu|cpu)/.test(q)) {
    if (/(phone|mobile|screen|iphone|android|battery)/.test(q)) {
      return {
        reply: "MOBILE_DIAGNOSTIC: Screen flickering, power draw issues, or board-level component failure? Let me open the service portal so you can detail the device state.",
        action: "START_DIAGNOSTIC",
        suggestedPrompts: ["Book Screen Repair", "Battery Replacement", "Talk to Design Team"]
      };
    }
    return {
      reply: "HARDWARE_TELEMETRY: Sounds like thermal throttling, startup bloat, or driver corruption. I can walk you through local troubleshooting or queue a physical bench inspection.",
      action: "START_DIAGNOSTIC",
      suggestedPrompts: ["Clear PC Bloat", "Book Bench Inspection", "Check UI/UX Portfolio"]
    };
  }

  // --- DESIGN & PORTFOLIO ---
  if (/(ui|ux|design|figma|photoshop|illustrator|portfolio|projects|work|showcase|logo|poster|flyer|website)/.test(q)) {
    return {
      reply: "CREATIVE_CORE: Shifting focus to design systems and UI/UX prototypes. Scrolling to the project archive now...",
      action: "SCROLL_TO_PROJECTS",
      suggestedPrompts: ["Figma Case Studies", "Brand Identity", "Request Design Quote"]
    };
  }

  // --- PRICING & DISPATCH ---
  if (/(price|cost|quote|charge|hire|contact|reach|book|message|email|talk)/.test(q)) {
    return {
      reply: "DISPATCH_CHANNEL: Initiating secure transmission line. Opening contact terminal...",
      action: "OPEN_CONTACT",
      suggestedPrompts: ["Hardware Quote", "Custom Design Project", "General Question"]
    };
  }

  // --- CHAT & CASUAL TECH BANTER ---
  if (/(cool|nice|thanks|thank you|awesome|great|what can you do|who made this)/.test(q)) {
    return {
      reply: "ACKNOWLEDGED. Built with custom TypeScript state orchestration and zero external API dependencies. Fully autonomous. Need to run another directive?",
      action: "NONE",
      suggestedPrompts: ["Fix Laggy PC", "Explore Projects", "Contact Direct"]
    };
  }

  // --- FALLBACK SMART CONVERSATIONAL RESPONSE ---
  return {
    reply: `SYS_INTELLIGENCE: Analyzed phrase "${input}". While I don't have a direct rule for that exact syntax, I am wired for hardware repair dispatches, UI/UX portfolio navigation, and tech assistance. Where should we head?`,
    action: "NONE",
    suggestedPrompts: ["Diagnose PC Issue", "View UI/UX Work", "Open Contact Line"]
  };
}