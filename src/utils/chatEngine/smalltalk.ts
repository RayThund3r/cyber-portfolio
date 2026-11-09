// src/utils/chatEngine/smalltalk.ts
//
// Human conversation basics. This is what was missing when "m good" got
// "I'm following along with 'm good'". Ordered rules, regex on normalised text.

import { PersonaMode, TopicDomain } from './types';
import { normalize, pick } from './text';

export interface SmallTalkResult {
  reply: string;
  topic: TopicDomain;
  suggestions?: string[];
  /** Facts learned from the message, merged into memory.userContext */
  learn?: Record<string, string>;
  /** Marks replies that should not overwrite lastTopic */
  keepTopic?: boolean;
}

interface Rule {
  id: string;
  test: RegExp;
  human: (name?: string) => string[];
  expert: string[];
  suggestions?: string[];
  keepTopic?: boolean;
}

const hello = (name?: string) => (name ? `, ${name}` : '');

const RULES: Rule[] = [
  {
    id: 'test',
    test: /^(test|testing|test test|testing 123|testing testing|check|mic check)$/,
    human: () => ['Loud and clear! ✅ Everything is working. What would you like to ask?'],
    expert: ['SYS_ACK // Test packet received. Link nominal.'],
  },
  {
    id: 'name',
    test: /\b(my name is|call me|people call me|name'?s) ([a-z][a-z'-]{1,20})\b/,
    human: () => [],
    expert: [],
    keepTopic: true,
  },
  {
    id: 'local-greeting',
    test: /^(habari( yako| gani| za (asubuhi|mchana|jioni))?|vipi|niaje|sasa|wasuze otya|osiibye otya|agandi|oli otya|oli mulungi|gyebale( ko)?)( .{0,12})?$/,
    human: () => [
      'Nzuri, asante! 😊 (Fine, thanks!) What can I help you with — a repair, a design, or a website?',
      'Poa! 👋 (All good!) How can I help today?',
      'Bulungi, webale! 😊 (Fine, thank you!) What can I do for you?',
    ],
    expert: ['SYS_INIT // Greeting acknowledged (sw/lg). Standing by.'],
    suggestions: ['My device is not working', 'I need a logo', 'Build me a website', 'Get a quote'],
  },
  {
    id: 'greeting',
    test: /^(hi+|hello+|hey+|heya|yo+|sup|suo|wassup|whats up|what'?s up|howdy|hola|greetings|hallo|helo|jambo|mambo|oli otya|gyebale|good (morning|afternoon|evening|day))\b/,
    human: (n) => [
      `Hey${hello(n)}! 👋 What's on your mind? I can help with repairs, design, web projects — or just chat.`,
      `Hi${hello(n)}! 😊 Good to see you. What can I help you with today?`,
      `Hello${hello(n)}! 👋 Need a device fixed, a logo designed, a website built — or something else?`,
    ],
    expert: ['SYS_INIT // Neural link established. Secure relay active in Ndejje, UG. Standing by for telemetry, hardware diagnostics, or software architecture queries.'],
    suggestions: ['My device is not working', 'I need a logo', 'Build me a website', 'Get a quote'],
  },
  {
    id: 'how-are-you',
    test: /\b(how are (you|u)|how r (you|u)|how'?s it going|how is it going|how are things|how you doing|how'?s life|how do you do|how'?s your day)\b/,
    human: () => [
      "Doing great, thanks for asking! 😊 How about you — what brings you here today?",
      "I'm good! Running smoothly and ready to help. How are you doing?",
    ],
    expert: ['SYS_STATUS // All subsystems nominal. Query?'],
    keepTopic: true,
  },
  {
    id: 'im-good',
    test: /^((i'?m|im|i am|m|am|we'?re|were) )?(doing )?(good|fine|great|ok|okay|well|alright|cool|chilling|fantastic|awesome|not bad|all good|excellent|nice|better)( thanks| thank you| and you| wbu| hbu)?$/,
    human: () => [
      "Glad to hear it! 😄 So what can I help you with — a repair, some design, or a web project?",
      "Nice, love that. 🙌 Anything I can help with today?",
    ],
    expert: ['SYS_ACK // Operator status: nominal. Awaiting directive.'],
    suggestions: ['My device is not working', 'I need a logo', 'Build me a website'],
    keepTopic: true,
  },
  {
    id: 'im-down',
    test: /\b(i'?m|im|i am|feeling|feel|so|am) (very |so |really )?(sad|down|bad|not good|not okay|tired|stressed|exhausted|overwhelmed|cooked|burnt out|burned out|depressed|lonely|anxious)\b|^(cooked|stressed|tired|exhausted|overwhelmed)$/,
    human: () => [
      "Sorry you're feeling that way. 💛 Take a breath, grab some water, step away from the screen for a few minutes. If you want, tell me what's going on — I'm happy to listen, or help you tackle whatever is stressing you out.",
    ],
    expert: ['SYS_WARN // Operator stress detected. Recommend a short break, then resume. Describe the blocker if you want help.'],
    keepTopic: true,
  },
  {
    id: 'thanks',
    test: /\b(thanks|thank you|thank u|thx|tnx|ty|cheers|asante|webale|appreciate it|much appreciated)\b/,
    human: () => [
      "You're welcome! 😊 Anything else I can help with?",
      'Anytime! Let me know if you need anything else.',
    ],
    expert: ['SYS_ACK // Acknowledged. Standing by.'],
    keepTopic: true,
  },
  {
    id: 'bye',
    test: /\b(bye|goodbye|see you|see ya|cya|good night|goodnight|ttyl|later|gotta go|have to go)\b/,
    human: (n) => [`Take care${hello(n)}! 👋 Come back anytime.`, 'Bye for now! 👋 I\'m here whenever you need me.'],
    expert: ['SYS_DISCONNECT // Session idle. Link remains available.'],
    keepTopic: true,
  },
  {
    id: 'who-are-you',
    test: /\b(who are you|what are you|your name|who made you|who built you|who created you|are you (a )?(bot|ai|human|real|robot|chatgpt|gpt))\b/,
    human: () => [
      "I'm the assistant on this site — an AI chat buddy that can answer questions about repairs, design and web projects, and chat about plenty of other things too. I'm not a human, but I'll do my best to be useful! 🤖",
    ],
    expert: ['SYS_IDENT // Embedded site assistant. Hybrid engine: retrieval + rules + optional in-browser language model.'],
    keepTopic: true,
  },
  {
    id: 'capabilities',
    test: /\b(what can you do|how can you help|what do you do|what do you offer|can you help( me)?|help me|need help)\b|^help$/,
    human: () => [
      "Here's what I can do:\n- **Diagnose** phone and PC problems and tell you what's likely wrong\n- **Explain** design, branding and web options\n- **Answer** general questions and look things up\n- **Take you** to the projects or contact section\n\nWhat do you need?",
    ],
    expert: ['AVAILABLE_MODULES: [1. Hardware Repair Diagnostics] [2. UI/UX & Graphic Design] [3. Web Architecture] [4. Embroidery & Print Formatting] [5. General Q&A]. Type any query.'],
    suggestions: ['My device is not working', 'I need a logo', 'Show me your projects'],
  },
  {
    id: 'compliment',
    test: /\b(you'?re|you are|ur|u r) (so |really |very )?(smart|cool|great|awesome|amazing|good|clever|helpful|nice|funny)\b|\b(good bot|nice one|well done|good job|great job)\b|^((this|that|it|thats|that'?s|it'?s) (is |was )?)?(so |really |very )?(cool|nice|awesome|amazing|sweet|dope|lit|neat|impressive)$/,
    human: () => ['Aw, thank you! 😊 That means a lot. What else can I do for you?'],
    expert: ['SYS_ACK // Positive feedback logged.'],
    keepTopic: true,
  },
  {
    id: 'laugh',
    test: /^(lol|lmao|haha+|hehe+|hihi+|rofl|ha+)$/,
    human: () => ['😄 Glad that landed. Anything else?'],
    expert: ['SYS_ACK // Humour module acknowledged.'],
    keepTopic: true,
  },
  {
    id: 'joke',
    test: /\b(tell me a joke|got any jokes|make me laugh|joke)\b/,
    human: () => [
      "Why did the laptop get cold? It left its Windows open. 😄",
      "I'd tell you a UDP joke, but you might not get it. 😅",
      'There are 10 types of people: those who understand binary and those who don\'t. 🤓',
      'My PC said it needed a break. I said: so do I — just not the kind that crashes. 😂',
    ],
    expert: ['JOKE_MODULE // Why do programmers prefer dark mode? Because light attracts bugs.'],
    keepTopic: true,
  },
  {
    id: 'open-contact',
    test: /^(open|show|take me to|go to) (the )?(contact|contact section|contact page)$/,
    human: () => ['Taking you to the contact section now. 📬'],
    expert: ['NAV // Opening contact module.'],
    keepTopic: true,
  },
];

export function detectName(input: string): string | undefined {
  const m = normalize(input).match(/\b(?:my name is|call me|people call me) ([a-z][a-z'-]{1,20})\b/);
  if (!m) return undefined;
  const raw = m[1];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function isAffirmative(q: string): boolean {
  return /^(yes|yeah|yep|yup|ya|sure|ok|okay|alright|please do|go ahead|definitely|of course|k)$/.test(q);
}

export function isNegative(q: string): boolean {
  return /^(no|nope|nah|not really|no thanks|nothing|that'?s all)$/.test(q);
}

export function handleSmallTalk(
  input: string,
  mode: PersonaMode,
  name?: string
): SmallTalkResult | null {
  const q = normalize(input);

  // Emoji-only / punctuation-only input (e.g. "👋", "🔥")
  if (!q) {
    return {
      reply: mode === 'EXPERT' ? 'SYS_ACK // Signal received.' : 'Hey! 👋 What can I help you with?',
      topic: 'SMALLTALK',
      keepTopic: true,
    };
  }

  // Only apply conversational rules to short messages — long ones are real questions.
  const wordCount = q.split(' ').length;
  if (wordCount > 9) return null;

  for (const rule of RULES) {
    if (!rule.test.test(q)) continue;

    if (rule.id === 'name') {
      const n = detectName(input);
      if (!n) continue;
      return {
        reply:
          mode === 'EXPERT'
            ? `SYS_ACK // Operator alias set: ${n}.`
            : `Nice to meet you, ${n}! 😊 What can I help you with?`,
        topic: 'SMALLTALK',
        learn: { name: n },
        keepTopic: true,
      };
    }

    const list = mode === 'EXPERT' ? rule.expert : rule.human(name);
    if (list.length === 0) continue;
    return {
      reply: pick(list),
      topic: rule.keepTopic ? 'SMALLTALK' : 'GREETINGS',
      suggestions: rule.suggestions,
      keepTopic: rule.keepTopic,
    };
  }
  return null;
}

/** Context-aware nudges for bare "yes"/"ok" replies. */
export const FOLLOW_UP_PROMPTS: Record<string, { human: string; expert: string; suggestions: string[] }> = {
  HARDWARE_REPAIR: {
    human: 'Great — tell me the **device model** and **exactly what it does** (or doesn\'t do), and any recent drop, spill or update.',
    expert: 'SYS_PROMPT // Provide: model, symptom, recent events.',
    suggestions: ['Phone', 'Laptop', 'Desktop PC'],
  },
  DESIGN_BRANDING: {
    human: 'Awesome — what\'s the **business or project name**, and what vibe are you going for (modern, bold, minimal, traditional)?',
    expert: 'DESIGN_PROMPT // Provide: project name, audience, style, deliverable formats.',
    suggestions: ['Modern & minimal', 'Bold & colourful', 'I need ideas'],
  },
  WEB_DEV: {
    human: 'Cool — what should the site **do** (sell, showcase, book appointments?) and roughly **when** do you need it?',
    expert: 'WEB_PROMPT // Provide: purpose, pages, deadline, references.',
    suggestions: ['Showcase my work', 'Sell products', 'Book appointments'],
  },
  PRICING_RATES: {
    human: 'Sure — which service is the quote for: a **repair**, a **design**, or a **website**?',
    expert: 'SLA_PROMPT // Select: [REPAIR] [DESIGN] [WEB].',
    suggestions: ['A repair', 'A design', 'A website'],
  },
};
