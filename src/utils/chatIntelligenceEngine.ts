// src/utils/chatIntelligenceEngine.ts

export type PersonaMode = 'HUMAN' | 'EXPERT';

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

export interface SessionMemory {
  interactionCount: number;
  lastTopic: 'HARDWARE' | 'DESIGN' | 'PORTFOLIO' | 'PRICING' | 'GREETING' | 'GENERAL';
  userName?: string;
  conversationHistory: { role: 'user' | 'assistant'; text: string }[];
}

// Keyword synonyms for intelligent intent matching
const INTENTS = {
  greetings: ['hi', 'hello', 'hey', 'sup', 'greetings', 'good morning', 'good afternoon', 'good evening', 'yo'],
  hardware: ['repair', 'dead', 'pc', 'laptop', 'phone', 'screen', 'battery', 'motherboard', 'boot', 'power', 'fix', 'technician', 'diagnostic', 'broken', 'keyboard', 'gpu'],
  design: ['design', 'logo', 'brand', 'graphic', 'figma', 'ui', 'ux', 'poster', 'vector', 'embroidery', 'fabric', 'printing', 'adobe', 'photoshop', 'illustrator'],
  portfolio: ['portfolio', 'project', 'work', 'site', 'website', 'code', 'next.js', 'react', 'tailwind', 'github', 'stack'],
  pricing: ['price', 'cost', 'rate', 'quote', 'charge', 'fee', 'budget', 'affordable'],
  contact: ['contact', 'hire', 'reach', 'email', 'phone number', 'whatsapp', 'location', 'ndejje', 'kampala'],
  help: ['help', 'assist', 'support', 'guide', 'what can you do']
};

function detectIntent(query: string): string {
  for (const [intent, keywords] of Object.entries(INTENTS)) {
    if (keywords.some(kw => query.includes(kw))) {
      return intent;
    }
  }
  return 'fallback';
}

export function processUserQuery(
  input: string,
  mode: PersonaMode,
  memory: SessionMemory
): { reply: string; updatedMemory: SessionMemory } {
  const query = input.toLowerCase().trim();
  const intent = detectIntent(query);
  const count = memory.interactionCount + 1;

  const newHistory = [
    ...memory.conversationHistory,
    { role: 'user' as const, text: input }
  ];

  let topic: SessionMemory['lastTopic'] = memory.lastTopic;
  let replyText = '';

  // --- INTENT ROUTING ---
  switch (intent) {
    case 'greetings':
      topic = 'GREETING';
      if (mode === 'EXPERT') {
        replyText = "SYS_INIT: Neural link established. Secure relay active in Ndejje, UG. Standing by for telemetry, hardware diagnostics, or software architecture queries.";
      } else {
        replyText = "Hello there! 😊 It's great to connect with you. Whether you're looking for tech repairs, custom branding, or web development, how can I help you today?";
      }
      break;

    case 'hardware':
      topic = 'HARDWARE';
      if (mode === 'EXPERT') {
        replyText = "SYS_DIAGNOSTIC: Hardware servicing module engaged. Protocols available: Motherboard rail testing, CMOS flash recovery, battery cell profiling, and thermal paste re-engineering. Specify device symptoms (e.g., POST failure, no power rail, display fault).";
      } else {
        replyText = "I handle expert repairs for both mobile phones and PCs! If your device is acting up, won't turn on, or has a damaged screen, tell me the exact model and what's happening so I can give you a clear diagnosis.";
      }
      break;

    case 'design':
      topic = 'DESIGN';
      if (mode === 'EXPERT') {
        replyText = "DESIGN_ENGINE: Vector and raster pipelines active. Adobe Illustrator / Photoshop workflow synchronized with Figma UI components and DST/PES embroidery formatting specs.";
      } else {
        replyText = "Creative design is one of my core specialties. I work with Photoshop, Illustrator, and Figma to build striking logos, UI/UX layouts, and even format name lists for fabric printing and embroidery machines!";
      }
      break;

    case 'portfolio':
      topic = 'PORTFOLIO';
      if (mode === 'EXPERT') {
        replyText = "SYS_ARCH: Built with Next.js, Tailwind CSS, and Framer Motion. Features custom cyber-industrial aesthetics, dynamic theme switching, and local client telemetry analysis.";
      } else {
        replyText = "This portfolio highlights my dual expertise as a hardware repair technician and multi-disciplinary designer. You can explore the project archive above to see detailed breakdowns of my technical builds!";
      }
      break;

    case 'pricing':
      topic = 'PRICING';
      if (mode === 'EXPERT') {
        replyText = "SLA_PRICING: Rates are structured per project complexity and diagnostic tier. Zero hidden fees. Initiate secure contact for custom quotes.";
      } else {
        replyText = "Pricing is transparent and fair, tailored to the specific needs of your repair or design project. Feel free to reach out with your project details to get a clear, straightforward estimate.";
      }
      break;

    case 'contact':
      topic = 'GENERAL';
      if (mode === 'EXPERT') {
        replyText = "NODE_LOCATION: Ndejje, Makindye Ssabagabo, Uganda. Direct communication link open via the contact module.";
      } else {
        replyText = "I'm based in Ndejje, Makindye Ssabagabo, Uganda. You can easily get in touch by heading over to the contact page to send a direct message!";
      }
      break;

    case 'help':
      topic = 'GENERAL';
      if (mode === 'EXPERT') {
        replyText = "AVAILABLE_MODULES: [1. Hardware Repair Diagnostics] [2. UI/UX & Graphic Design] [3. Web Architecture] [4. Embroidery & Print Formatting]. Type any query.";
      } else {
        replyText = "I can help you with a lot of things! Ask me about repairing a computer or phone, designing a logo or brand identity, setting up web projects, or checking service details.";
      }
      break;

    default:
      // Contextual fallback based on ongoing conversation memory
      if (memory.lastTopic === 'HARDWARE' && (query.includes('won\'t') || query.includes('screen') || query.includes('power') || query.includes('battery'))) {
        replyText = mode === 'EXPERT'
          ? `SYS_SUB_DIAG: Analyzing hardware symptom: "${input}". Recommend checking internal power distribution and connector seating.`
          : `Got it. When dealing with that kind of issue ("${input}"), it's usually either a power rail fault or a component connection. We can test and fix it safely without risking your files.`;
      } else if (memory.lastTopic === 'DESIGN' && (query.includes('logo') || query.includes('file') || query.includes('print'))) {
        replyText = mode === 'EXPERT'
          ? `DESIGN_SUB_ROUTINE: Processing creative asset parameters for "${input}". High-res vector export recommended.`
          : `That sounds like a great design project! For "${input}", I make sure the deliverables are optimized for clean printing, vector scaling, or embroidery machine formats.`;
      } else {
        replyText = mode === 'EXPERT'
          ? `SYS_QUERY_LOG: Input received: "${input}". Executing semantic fallback. State operational parameters or specify domain (Hardware / Design / Code).`
          : `I'm following along with "${input}". Could you tell me a bit more, or let me know if you'd like to focus on technical device repairs or creative design work?`;
      }
      break;
  }

  const updatedHistory = [...newHistory, { role: 'assistant' as const, text: replyText }];

  return {
    reply: replyText,
    updatedMemory: {
      interactionCount: count,
      lastTopic: topic,
      conversationHistory: updatedHistory
    }
  };
}