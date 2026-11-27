// src/utils/chatEngine/smalltalk.ts
//
// Human conversation basics. This is what was missing when "m good" got
// "I'm following along with 'm good'". Ordered rules, regex on normalised text.

import { PersonaMode, TopicDomain } from './types';
import { normalize, pick } from './text';
import { SITE } from './siteConfig';

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
    human: () => ['Loud and clear! Everything is working. What would you like to ask?'],
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
      'Nzuri, asante! (Fine, thanks!) What can I help you with — a repair, a design, or a website?',
      'Poa! (All good!) How can I help today?',
      'Bulungi, webale! (Fine, thank you!) What can I do for you?',
    ],
    expert: ['SYS_INIT // Greeting acknowledged (sw/lg). Standing by.'],
    suggestions: ['My device is not working', 'I need a logo', 'Build me a website', 'Get a quote'],
  },
  {
    id: 'greeting',
    test: /^(hi+|hello+|hey+|heya|yo+|sup|suo|wassup|whats up|what'?s up|howdy|hola|greetings|hallo|helo|jambo|mambo|oli otya|gyebale|good (morning|afternoon|evening|day))\b/,
    human: (n) => [
      `Hey${hello(n)}! What's on your mind? I can help with repairs, design, web projects — or just chat.`,
      `Hi${hello(n)}! Good to see you. What can I help you with today?`,
      `Hello${hello(n)}! Need a device fixed, a logo designed, a website built — or something else?`,
    ],
    expert: ['SYS_INIT // Neural link established. Secure relay active in Ndejje, UG. Standing by for telemetry, hardware diagnostics, or software architecture queries.'],
    suggestions: ['My device is not working', 'I need a logo', 'Build me a website', 'Get a quote'],
  },
  {
    id: 'how-are-you',
    test: /\b(how are (you|u)|how r (you|u)|how'?s it going|how is it going|how are things|how you doing|how'?s life|how do you do|how'?s your day)\b/,
    human: () => [
      "Doing great, thanks for asking! How about you — what brings you here today?",
      "I'm good! Running smoothly and ready to help. How are you doing?",
    ],
    expert: ['SYS_STATUS // All subsystems nominal. Query?'],
    keepTopic: true,
  },
  {
    id: 'im-good',
    test: /^((i'?m|im|i am|m|am|we'?re|were) )?(doing )?(good|fine|great|ok|okay|well|alright|cool|chilling|fantastic|awesome|not bad|all good|excellent|nice|better)( thanks| thank you| and you| wbu| hbu)?$/,
    human: () => [
      "Glad to hear it! So what can I help you with — a repair, some design, or a web project?",
      "Nice, love that. Anything I can help with today?",
    ],
    expert: ['SYS_ACK // Operator status: nominal. Awaiting directive.'],
    suggestions: ['My device is not working', 'I need a logo', 'Build me a website'],
    keepTopic: true,
  },
  {
    id: 'im-down',
    test: /\b(i'?m|im|i am|feeling|feel|so|am) (very |so |really )?(sad|down|bad|not good|not okay|tired|stressed|exhausted|overwhelmed|cooked|burnt out|burned out|depressed|lonely|anxious)\b|^(cooked|stressed|tired|exhausted|overwhelmed)$/,
    human: () => [
      "Sorry you're feeling that way. Take a breath, grab some water, step away from the screen for a few minutes. If you want, tell me what's going on — I'm happy to listen, or help you tackle whatever is stressing you out.",
    ],
    expert: ['SYS_WARN // Operator stress detected. Recommend a short break, then resume. Describe the blocker if you want help.'],
    keepTopic: true,
  },
  {
    id: 'thanks',
    test: /\b(thanks|thank you|thank u|thx|tnx|ty|cheers|asante|webale|appreciate it|much appreciated)\b/,
    human: () => [
      "You're welcome! Anything else I can help with?",
      'Anytime! Let me know if you need anything else.',
    ],
    expert: ['SYS_ACK // Acknowledged. Standing by.'],
    keepTopic: true,
  },
  {
    id: 'bye',
    test: /\b(bye|goodbye|see you|see ya|cya|good night|goodnight|ttyl|later|gotta go|have to go)\b/,
    human: (n) => [`Take care${hello(n)}! Come back anytime.`, 'Bye for now! I\'m here whenever you need me.'],
    expert: ['SYS_DISCONNECT // Session idle. Link remains available.'],
    keepTopic: true,
  },
  {
    id: 'about-you',
    test: /\b(tell me (?:something |a bit |a little |a few things |more |anything )?about (yourself|yourselves|urself|you|u)|about (yourself|yourselves|urself)|what do you know about yourself|introduce (yourself|urself)|describe (yourself|urself)|what'?s your story|how (do|were) you (work|made|built)|what are you made (of|from)|how (do|does) this (chat|bot|assistant) work)\b/,
    human: () => [
      `Happy to! I'm **${SITE.assistantName}**, the assistant that lives on this site (${SITE.location}). I'm not a person and I'm not a giant cloud AI: I run in **your browser** using rules, a knowledge base about the work here, exact maths and dates, and a Wikipedia lookup for general questions. I learn your preferences during the chat, remember what we've said, and can take you anywhere on the site.\n\n**What the studio does:**\n${SITE.services.map((x) => '- ' + x.split(' (')[0]).join('\n')}\n\nWant a tour, a quote, or to see the projects?`,
    ],
    expert: ['SYS_IDENT // Hybrid in-browser assistant: BM25 retrieval + rule engine + exact calc/date modules + Wikipedia lookup + optional on-device model. History local only. Say "tour" for a walkthrough.'],
    suggestions: ['Give me a tour', 'What can you do?', 'Show me your projects', 'Get a quote'],
    keepTopic: true,
  },
  {
    id: 'about-owner',
    test: /\b(name of the (?:owner|developer|designer|creator|founder|person behind)|(?:owner|developer|designer|creator|founder)'?s name|(?:what(?:'s| is)|who(?:'s| is)) the (?:owner|developer|designer|creator)'?s? ?(?:name)?|tell me (more )?about (the )?(owner|creator|developer|designer|founder|builder|person behind)|who (is|runs|owns) (the owner|this (site|studio|shop|business|portfolio))|who (made|built|designed|owns) (this|the) (site|website|portfolio)|who'?s behind (this|the) (site|studio|portfolio))\b/,
    human: () => [
      `This is a one-person studio based in **${SITE.location}**: hardware repair (phones and PCs), graphic and brand design, embroidery/print file prep, and web development. I don't have a personal biography to share here, and I won't make one up. The best way to get to know the work is the **projects** section, and for anything personal you can message the owner directly through me.`,
    ],
    expert: [`OWNER // Solo studio, ${SITE.location}. Bio not published in-chat. Use "show projects" or "send a message to the owner".`],
    suggestions: ['Show me your projects', 'Send a message to the owner', 'Give me a tour'],
    keepTopic: true,
  },
  {
    id: 'about-site',
    test: /\b(tell me (?:something |a bit |a little |more )?about (?:this|the|your) (?:site|website|web site|portfolio|page|place|studio|shop|business|company)|what is this (?:site|website|place|portfolio)|what(?:'s| is) this (?:site|website|place) (?:about|for)|what do you (?:guys |people )?(?:do|offer|sell)|what(?:'s| is) (?:this|your) (?:business|studio|shop) about)\b/,
    human: () => [
      `This is the portfolio and work shop of a one-person studio in **${SITE.location}**. It does:\n${SITE.services.map((x) => '- ' + x.split(' (')[0]).join('\n')}\n\nYou can browse past projects, try the **games** page, build a website from a template, book a repair or track an order. Want me to take you somewhere?`,
    ],
    expert: [`SITE // Solo studio, ${SITE.location}. Repair · design · web. Routes: /portfolio /services /contact /games /builder /track.`],
    suggestions: ['Show me your projects', 'Open services', 'Give me a tour', 'Play a game'],
    keepTopic: true,
  },
  {
    id: 'about-work',
    test: /\b(tell me (?:a bit |a little |something |more )?about (?:your|the owner'?s|his|her) (?:work|experience|skills|background|projects|services|expertise)|what(?:'s| is| are) your (?:work|skills|experience|background|expertise|specialt(?:y|ies))|how (?:long|experienced) (?:have you|are you)|what are you good at)\b/,
    human: () => [
      `The studio covers three areas:\n${SITE.services.map((x) => '- ' + x).join('\n')}\n\nThe quickest way to judge the work is to look at it. Want me to open the projects, or tell you what a job would cost?`,
    ],
    expert: ['WORK // Hardware repair · graphic/brand design · embroidery & print prep · web development. Say "show projects" or "get a quote".'],
    suggestions: ['Show me your projects', 'Get a quote', 'Open services'],
    keepTopic: true,
  },
  {
    id: 'about-visitor',
    test: /^(?:please )?(?:tell me (?:something |a bit |anything |what you know )?about me|what do you know about me|do you know me|who am i|what do you remember about me|do you remember me)\??$/,
    human: (n) => [
      n
        ? `You're **${n}**, as far as I know. I only remember what you tell me in this chat (and only in this browser): your name, your device, what you're after. Nothing is sent anywhere. Want to tell me what you need?`
        : "I don't know much about you yet, and that's on purpose: I only remember what you tell me, only in this browser, and nothing is sent anywhere. Tell me your **name**, your **device** or what you're **after**, and I'll use it to help better.",
    ],
    expert: ['MEM // Session memory is local to this browser. Provide: name, device, goal.'],
    suggestions: ['My name is…', 'I need a repair', 'I need a website'],
    keepTopic: true,
  },
  {
    id: 'who-are-you',
    test: /\b(who are you|what are you|your name|who made you|who built you|who created you|are you (a )?(bot|ai|human|real|robot|chatgpt|gpt))\b/,
    human: () => [
      "I'm the assistant on this site — an AI chat buddy that can answer questions about repairs, design and web projects, and chat about plenty of other things too. I'm not a human, but I'll do my best to be useful!",
    ],
    expert: ['SYS_IDENT // Embedded site assistant. Hybrid engine: retrieval + rules + optional in-browser language model.'],
    keepTopic: true,
  },
  {
    id: 'helpful',
    test: /^(?:that|this|it)(?:'s| is| was)? (?:very |so |really )?(?:helpful|useful|great|perfect|good|nice|correct|right|exactly)(?: answer| thanks| thank you)?$|^(?:great|good|nice|perfect|awesome|helpful) (?:answer|job|work|one)$|^(?:got it|understood|makes sense|i see|i understand|cool thanks)$/,
    human: () => ['Glad that helped! Anything else you want to check, or shall I take you to the contact form to get started?'],
    expert: ['SYS_ACK // Positive feedback logged.'],
    suggestions: ['Get a quote', 'Show me your projects'],
    keepTopic: true,
  },
  {
    id: 'feelings',
    test: /\bdo you (have|feel) (any )?(feelings|emotions)\b|\bcan you feel\b|\bare you (happy|sad|lonely|tired)\b/,
    human: () => ["Honestly? Not the way you do. I'm software, so I don't get tired or lonely, but I do work better when someone asks me a clear question. How can I help?"],
    expert: ['SYS_STATE // No emotions. Nominal.'],
    keepTopic: true,
  },
  {
    id: 'hungry',
    test: /\b(i'?m|i am|im) (so |very |really )?(hungry|thirsty|sleepy|tired)\b|\bwhat should i (eat|cook|drink)\b/,
    human: () => ["I can't cook (no hands), but go grab a snack and some water, then come back and tell me what you need fixed, designed or built."],
    expert: ['SYS_ACK // Out of scope: food. Return to modules.'],
    keepTopic: true,
  },
  {
    id: 'which-model',
    test: /\b(which|what) (model|llm|ai|version|engine) (are you|is this|do you (use|run))\b|\bwhat are you (running|built|made) (on|with)\b|\bare you (gpt|gemini|llama|claude|qwen|phi)\b/,
    human: () => ["I'm this site's own assistant. Instant answers come from a built-in knowledge base and rules. When the owner has switched on a cloud AI (or you've enabled the on-device model), longer, more open-ended questions go to that language model, and I fall back to my built-in answers if it's busy."],
    expert: ['SYS_MODEL // Hybrid: retrieval + rules (always on); optional cloud LLM via admin-configured providers; optional on-device WebLLM. Auto-fallback to rules.'],
    keepTopic: true,
  },
  {
    id: 'my-age',
    test: /\bhow old are you\b|\bwhen (were you|was you) (born|made|created|built)\b|\byour (age|birthday)\b/,
    human: () => ["I don't have a birthday the way people do. I'm a piece of code that lives on this site, and I get a little smarter every time the owner improves me."],
    expert: ['SYS_AGE // N/A. Build is continuously updated.'],
    keepTopic: true,
  },
  {
    id: 'where-live',
    test: /\bwhere do you (live|stay|come from|work)\b|\bwhere are you from\b/,
    human: () => ["I live right here in this chat window, on the website. The person behind the site is based in **Ndejje, Makindye Ssabagabo, Uganda**, if you mean the workshop."],
    expert: ['LOCATION // Assistant: this site. Owner: Ndejje, Makindye Ssabagabo, Uganda.'],
    keepTopic: true,
  },
  {
    id: 'sing',
    test: /\b(sing|rap|poem|poetry|write me a (song|poem|rhyme)|haiku)\b/,
    human: () => [
      "*Roses are red, screens can crack, bring it to the bench and we'll bring it back.*\nThat's about as far as my singing goes. I'm better with repairs, designs and websites!",
      "Haiku time:\n*Cracked screen, silent phone —*\n*a steady hand, a new glass,*\n*light returns again.*",
    ],
    expert: ['CREATIVE_MODULE // Limited. Try the cloud AI for longer creative writing.'],
    keepTopic: true,
  },
  {
    id: 'insult-mild',
    test: /\b(nobody|no one) likes you\b|\byou (suck|are (useless|trash|dumb|bad|rubbish))\b|\b(you'?re|ur) (useless|trash|dumb|rubbish|bad)\b/,
    human: () => ["Ouch, but fair enough if I wasn't helpful. Tell me in one line what you were trying to do and I'll have another go, or I can pass it straight to the owner."],
    expert: ['SYS_ACK // Negative feedback logged. Offer: rephrase or SEND_TO_OWNER.'],
    suggestions: ['Send my question to the owner', 'What can you do?'],
    keepTopic: true,
  },
  {
    id: 'how-it-works',
    test: /\bhow do you work\b|\bhow (are|were) you (made|built|programmed|trained)\b/,
    human: () => ["Three layers: 1) a **knowledge base** about the owner's services and everyday tech, 2) **rules** for maths, dates, navigation and guided questions, and 3) an optional **language model** (cloud or on-device) for open-ended chat. Everything important works even with no model running."],
    expert: ['ARCH // KB retrieval (BM25, typo tolerant) -> rules/dialogue -> optional LLM grounded on KB.'],
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
    human: () => ['Aw, thank you! That means a lot. What else can I do for you?'],
    expert: ['SYS_ACK // Positive feedback logged.'],
    keepTopic: true,
  },
  {
    id: 'laugh',
    test: /^(lol|lmao|haha+|hehe+|hihi+|rofl|ha+)$/,
    human: () => ['Glad that landed. Anything else?'],
    expert: ['SYS_ACK // Humour module acknowledged.'],
    keepTopic: true,
  },
  {
    id: 'joke',
    test: /\b(tell me a joke|got any jokes|make me laugh|joke)\b/,
    human: () => [
      "Why did the laptop get cold? It left its Windows open.",
      "I'd tell you a UDP joke, but you might not get it.",
      'There are 10 types of people: those who understand binary and those who don\'t.',
      'My PC said it needed a break. I said: so do I — just not the kind that crashes.',
    ],
    expert: ['JOKE_MODULE // Why do programmers prefer dark mode? Because light attracts bugs.'],
    keepTopic: true,
  },
  {
    id: 'open-contact',
    test: /^(open|show|take me to|go to) (the )?(contact|contact section|contact page)$/,
    human: () => ['Taking you to the contact section now.'],
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

  // Emoji-only / punctuation-only input (e.g. "", "")
  if (!q) {
    return {
      reply: mode === 'EXPERT' ? 'SYS_ACK // Signal received.' : 'Hey! What can I help you with?',
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
            : `Nice to meet you, ${n}! What can I help you with?`,
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
