// src/utils/chatEngine/persona.ts
//
// The "talks like a person" layer. No model needed. Everything here is deterministic and honest:
//
//   * recall      "what did I just ask?", "what did you say?", "repeat that", "my first question"
//   * about me    "are you human?", "better than ChatGPT?", "how do you work?", "who made you?"
//   * privacy     "is my data safe?", "do you store my chat?"  (states exactly what the code does)
//   * feelings    compliments, insults, affection, "you're useless", "I'm bored", fun facts
//   * budget      "I have 200k ugx", "my budget is 100000", "what's your cheapest service?"
//   * scope       "can you fix a PS5 / build an app / do SEO?" -> what is NOT on the service list,
//                 without pretending, and with a way to ask the owner
//
// It runs AFTER the guided dialogue (so an answer to a flow question is never hijacked) and BEFORE
// small talk / retrieval / the model.

import { PersonaMode, SessionMemory, TopicDomain } from './types';
import { normalize } from './text';
import { isRemoteLLMConfigured } from './remoteLLM';
import { isLocalLLMReady } from './localLLM';

export interface PersonaReply {
  human: string;
  expert: string;
  suggestions?: string[];
  topic?: TopicDomain;
  learn?: Record<string, any>;
  /** Keep the previous topic so "yes" still continues what we were discussing. */
  keepTopic?: boolean;
}

const clip = (s: string, n: number) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? flat.slice(0, n).trimEnd() + '…' : flat;
};
/** Make a quoted snippet safe for the chat bubble's markdown. */
const quote = (s: string, n: number) => clip(s, n).replace(/[*_`<>\[\]]/g, '');

/* ------------------------------------------------------------------ recall */

function recall(q: string, raw: string, memory: SessionMemory): PersonaReply | null {
  const hist = memory.conversationHistory || [];
  const users = hist.filter((t) => t.role === 'user' && t.text.trim());
  const bots = hist.filter((t) => t.role === 'assistant' && t.text.trim());

  const askedBefore =
    /\b(what|which)\b.{0,25}\b(did|was|were)\b.{0,12}\b(i|my)\b.{0,16}\b(just )?(ask|asked|say|said|type|typed|write|wrote|mention|mentioned)\b/.test(q) ||
    /^(what was )?my (last|previous|latest) (question|message|query)\b/.test(q) ||
    /\bwhat did i (just )?(ask|say)\b/.test(q);
  const firstQ = /\b(my )?(first|very first|earliest|opening) (question|message|thing)\b/.test(q) || /\bwhat did i (first )?(ask|say) (first|at the start|in the beginning)\b/.test(q);

  if (firstQ && users.length) {
    const first = users[0].text;
    return {
      human: `The earliest thing I can still see from you is: “${quote(first, 220)}”. 🧠${users.length >= 12 ? ' (I only keep the most recent part of a long chat.)' : ''}`,
      expert: `RECALL // earliest retained query: "${quote(first, 220)}"`,
      keepTopic: true,
    };
  }
  if (askedBefore && !firstQ) {
    const prev = users[users.length - 1];
    if (!prev) {
      return { human: "You haven't asked me anything yet — this is the start of our chat. 😊 What would you like to know?", expert: 'RECALL // No prior queries in session.', keepTopic: true };
    }
    const reply = bots[bots.length - 1];
    return {
      human: `You asked: “${quote(prev.text, 220)}”.${reply ? `\n\nAnd I answered: ${quote(reply.text, 200)}` : ''}`,
      expert: `RECALL // last query: "${quote(prev.text, 220)}"`,
      suggestions: ['Explain that simpler', 'Summarize our chat'],
      keepTopic: true,
    };
  }

  const again = /^(say that again|repeat that|repeat it|can you repeat( that)?|come again|sorry what|pardon|what did you (just )?(say|mean)|what was that|i didn'?t (get|catch|understand) that|huh)\??$/.test(q);
  if (again) {
    const last = bots[bots.length - 1];
    if (!last) return { human: "I haven't said anything yet. 😄 Ask me something!", expert: 'RECALL // No prior output.', keepTopic: true };
    const text = last.text.length > 700 ? last.text.slice(0, 700).trimEnd() + '…' : last.text;
    return { human: `Sure — here it is again:\n\n${text}`, expert: `RECALL // repeating last output:\n${text}`, suggestions: ['Explain that simpler', 'Give me an example'], keepTopic: true };
  }
  return null;
}

/* ------------------------------------------------------------------ about me + privacy */

function aboutMe(q: string, memory: SessionMemory): PersonaReply | null {
  // Privacy first: the answer states exactly what the code does.
  const privacy =
    /\b(is|are)\b.{0,14}\b(my|our)\b.{0,12}\b(data|chat|chats|info|information|messages?|files?|privacy|conversation)\b.{0,16}\b(safe|secure|private|stored|saved|shared|tracked|protected)\b/.test(q) ||
    /\b(do|does|will|can)\b.{0,10}\b(you|u|this (site|chat|bot)|the owner|anyone)\b.{0,10}\b(store|save|keep|log|record|track|remember|share|sell|read|see|spy)\b.{0,16}\b(my|our|the|this)?\s?(chat|chats|data|messages?|info|conversation|history|files?|stuff)\b/.test(q) ||
    /\bprivacy (policy|statement|notice)\b|\b(privacy|gdpr)\b.{0,24}\b(you|this (chat|site|bot|website)|your)\b|\b(you|this (chat|site|bot|website)|your)\b.{0,24}\b(privacy|gdpr)\b|\bis (this|the) (chat|conversation|bot) (private|confidential|anonymous)\b|\bare (we|my chats?|my messages) (private|anonymous)\b/.test(q) ||
    /\bwho (can|could) (see|read) (my|this|our)\b/.test(q);
  if (privacy) {
    const ai = isLocalLLMReady()
      ? 'The on-device AI runs inside your browser, so what you type to it does not leave your device.'
      : 'If you turn on the optional on-device AI, it runs inside your browser too.';
    const remote = isRemoteLLMConfigured() ? ' (This site also has a self-hosted AI endpoint connected, which is where AI-mode messages go.)' : '';
    return {
      human:
        `Here's exactly what happens with your data: 🔒\n\n` +
        `- **Your chat is saved only in this browser** (so it survives a refresh). Say **“reset chat”** and it's wiped.\n` +
        `- **Nothing goes to the owner** unless you press **SEND** in the “send to the owner” card, and you choose what's included.\n` +
        `- **Files you attach are read on your device**, not uploaded.\n` +
        `- For general-knowledge questions I may look up Wikipedia, and only the cleaned-up search words are sent, not your name or the chat.\n` +
        `- ${ai}${remote}\n\n` +
        `Please don't type passwords or card numbers into any chat — including this one.`,
      expert:
        `PRIVACY // history: browser localStorage only (clear via "reset chat") | owner relay: explicit SEND only | files: parsed locally, not uploaded | web lookup: cleaned query string to Wikipedia | AI: ${isLocalLLMReady() ? 'on-device' : 'off / optional on-device'}${isRemoteLLMConfigured() ? ' + self-hosted endpoint' : ''}`,
      suggestions: ['Reset chat', 'Send a message to the owner'],
      topic: 'SYSTEM',
      keepTopic: true,
    };
  }

  if (/\b(better|smarter|stronger|more (advanced|powerful)) than (chat ?gpt|gpt|gemini|claude|copilot|siri|alexa|google)\b|\bare you (as good as|like|the same as) (chat ?gpt|gpt|gemini|claude|copilot)\b|\bcompare (you|yourself) to (chat ?gpt|gpt|gemini|claude)\b/.test(q)) {
    return {
      human:
        "Honestly? No — the big assistants are far larger than me, and I won't pretend otherwise. 😄 I'm a small assistant built into this site. What I do well: repair and design questions, exact maths and dates, explaining tech in plain words, **taking you around the site**, reading files you share, and passing messages to the owner. Turn on the on-device AI at the top for more open-ended chat.",
      expert: 'SELF_ASSESS // Small site-embedded assistant. Strengths: domain KB, exact calc/dates, site control, file triage, owner relay. Not comparable to large hosted LLMs. Optional on-device model extends open chat.',
      suggestions: ['What can you do?', 'Enable AI'],
      keepTopic: true,
    };
  }

  if (/\b(are you|r u|u r|you are)\b.{0,6}\b(a )?(real|human|person|bot|robot|ai|alive|machine|chatbot|automated|living)\b/.test(q) || /\bam i (talking|speaking|chatting) (to|with) (a |an )?(real |human |person|bot|robot|ai|machine)/.test(q)) {
    return {
      human: "I'm an automated assistant, not a person. 🤖 I answer from a built-in knowledge base (and an optional on-device AI if you enable it). If you'd like a human, I can pass your message to the owner — just say “send this to the owner”.",
      expert: 'IDENTITY // Automated assistant (rules + KB + optional on-device model). Human relay available on request.',
      suggestions: ['Send a message to the owner', 'What can you do?'],
      keepTopic: true,
    };
  }

  if (/\b(who|what) (made|built|created|programmed|designed|developed|owns|runs) (you|this (bot|chat|assistant|site|website))\b|\bwho'?s behind (you|this)\b/.test(q)) {
    return {
      human: "I was built for this site as its custom assistant — a knowledge base about the owner's services, some maths and date helpers, and site controls, with an optional AI model that runs in your browser. The site itself belongs to a hardware technician and designer based in Ndejje, Uganda. Want to see their work?",
      expert: 'ORIGIN // Custom assistant for this portfolio. Components: KB, calc/date engines, site controller, optional WebLLM.',
      suggestions: ['Show me your projects', 'What services do you offer?'],
      keepTopic: true,
    };
  }

  if (/\b(how do you (work|think|know|learn|answer|decide)|how (are|were) you (built|made|trained)|what are you (made|built) (of|with|on)|do you (learn|get smarter|remember me|use (ai|a model|gpt|llm))|are you (using|powered by|running) (ai|a model|gpt|an llm|llm))\b/.test(q)) {
    const mem = (memory.conversationHistory || []).length;
    return {
      human:
        `Plain version: 🧩\n\n1. **Safety check**, then I look for things I can do exactly: site commands, maths, dates, unit conversions.\n2. **Guided questions** for repairs and projects (I remember the device, problem and style as we go).\n3. **Knowledge base** search that forgives typos, then a short Wikipedia lookup for general questions.\n4. If you enable it, a **small AI model in your browser** phrases things more freely.\n\nI learn only from your 👍/👎, and only in this browser.${mem ? ` Right now I'm holding ${Math.ceil(mem / 2)} turn(s) of this chat in mind.` : ''}`,
      expert: 'ARCH // safety -> exact handlers -> guided dialogue -> KB (BM25, typo-tolerant) -> web lookup -> optional on-device LLM. Learning: local 👍/👎 aliases only.',
      suggestions: ['Is my data safe?', 'What can you do?'],
      keepTopic: true,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ feelings */

const FACTS = [
  'The first computer "bug" was a real moth, found jammed in a relay of the Harvard Mark II in 1947. 🪲',
  'The very first website is still online: info.cern.ch. 🌐',
  "Your phone has far more computing power than the computers that guided Apollo 11 to the Moon. 🚀",
  'The first computer mouse (1964) was carved from wood. 🖱️',
  "Lithium batteries age fastest when they're kept at 100% and hot, so cooler and 20–80% is gentler on them. 🔋",
  "Not every USB-C cable is equal: some carry only slow charging, no video and no fast data. 🔌",
  "An SSD left unpowered for a very long time can slowly lose data, which is one more reason to keep real backups. 💾",
  'Dried-out thermal paste is one of the most common reasons an older laptop runs hot and loud. 🔥',
];

function feelings(q: string, memory: SessionMemory): PersonaReply | null {
  if (
    /\b(you('| a)?re|youre|u r|ur|you are|this is|that was|this bot is|the bot is)\b.{0,10}\b(useless|stupid|dumb|trash|garbage|rubbish|terrible|awful|worthless|a joke|not helpful|unhelpful|hopeless|annoying|pathetic|bad)\b/.test(q) ||
    /\b(useless|stupid|dumb) (bot|chat|assistant|thing)\b/.test(q) ||
    /\b(you )?(suck|sucks)\b/.test(q) ||
    /^(wrong|nope wrong|that'?s wrong|that is wrong|no that'?s not what i (asked|meant)|not what i asked)$/.test(q)
  ) {
    return {
      human: "Fair — sounds like I missed what you were after, and I'm sorry about that. 🙏 Tell me in one line what you need and I'll try again, or I can hand the whole thing to the owner so a real person replies.",
      expert: 'FEEDBACK // Miss acknowledged. Restate the query in one line, or relay to the owner.',
      suggestions: ['Send this to the owner', 'Let me rephrase'],
      keepTopic: true,
    };
  }
  if (/\bi (really )?(love|adore|like) (you|u)\b|\bmarry me\b|\bbe my (friend|girlfriend|boyfriend)\b/.test(q)) {
    return {
      human: "Aw, thank you! 😄 I'm just a chat assistant, so I'll keep it friendly and practical — but I'm glad I'm useful. What shall we sort out?",
      expert: 'ACK // Positive sentiment logged. Standing by.',
      suggestions: ['My device is not working', 'I need a logo', 'Tell me a fun fact'],
      keepTopic: true,
    };
  }
  if (
    /\b(you('| a)?re|youre|u r|ur|you are|that('| i)?s|thats|this is|it'?s|its)\b.{0,10}\b(awesome|amazing|great|smart|clever|helpful|brilliant|the best|impressive|cool|nice|wonderful|fantastic|good)\b/.test(q) ||
    /^(good|great|nice|awesome|brilliant|excellent) (bot|job|work|one|answer|stuff|help)$/.test(q) ||
    /\b(well done|nice one|good bot|great job|thanks a lot buddy|you rock)\b/.test(q)
  ) {
    return {
      human: 'Thank you, that made my day! 😊 Anything else I can help with — or would you like a quick tour of the projects?',
      expert: 'ACK // Positive feedback received.',
      suggestions: ['Show me your projects', 'Book a repair'],
      keepTopic: true,
    };
  }
  if (/\b(tell me|give me|say|share)\b.{0,10}\b(something|a fact|a fun fact|anything|a random fact|trivia)\b.{0,12}\b(interesting|cool|fun|random|new)?\b|^(fun fact|random fact|surprise me|amaze me|entertain me)\b/.test(q) || /^i'?m (so )?bored$|^(im|i am) bored$/.test(q)) {
    const fact = FACTS[(memory.interactionCount || 0) % FACTS.length];
    return {
      human: `Here's one: ${fact}\n\nWant another, or a joke?`,
      expert: `FACT // ${fact.replace(/\p{Extended_Pictographic}/gu, '').trim()}`,
      suggestions: ['Another fact', 'Tell me a joke', 'Show me your projects'],
      keepTopic: true,
    };
  }
  if (/^(another|one more|more)( fun)?( fact| one)?$/.test(q) && /fun fact|here'?s one:/i.test((memory.conversationHistory || []).slice(-1)[0]?.text || '')) {
    const fact = FACTS[((memory.interactionCount || 0) + 3) % FACTS.length];
    return { human: `Another one: ${fact}`, expert: `FACT // ${fact}`, suggestions: ['Another fact', 'Tell me a joke'], keepTopic: true };
  }
  return null;
}

/* ------------------------------------------------------------------ budget */

/** "200k" -> 200000, "1.5m" -> 1500000, "ugx 50,000" -> 50000. Currency only when the visitor said one. */
export function parseBudget(raw: string): { amount: number; label: string } | null {
  const n = raw.toLowerCase().replace(/,/g, '');
  const m = /(\$|usd|ugx|ush|shs|shillings?|dollars?)?\s?(\d+(?:\.\d+)?)\s?(k|m|million|thousand)?\s?(\$|usd|ugx|ush|shs|shillings?|dollars?)?/.exec(n);
  if (!m) return null;
  let amount = parseFloat(m[2]);
  const suffix = m[3];
  if (suffix === 'k' || suffix === 'thousand') amount *= 1_000;
  else if (suffix === 'm' || suffix === 'million') amount *= 1_000_000;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) return null;
  const cur = `${m[1] || ''} ${m[4] || ''}`;
  let code = '';
  if (/\$|usd|dollar/.test(cur)) code = 'USD';
  else if (/ugx|ush|shs|shilling/.test(cur) || suffix === 'k') code = 'UGX';
  const num = Math.round(amount).toLocaleString('en-US');
  return { amount, label: code ? `${code} ${num}` : num };
}

function budget(q: string, raw: string): PersonaReply | null {
  const stating =
    /\bbudget (is|of|was|would be|around|about|max|maximum|limit)\b.{0,12}\d/.test(q) ||
    /\b(i (have|got|only have|can spend|can afford|could spend|can pay)|i('| a)?m (working with|looking to spend)|i want to spend|spend|afford)\b.{0,16}\d.{0,12}\b(k|m|ugx|ush|shs|usd|shillings|dollars|\$)\b/.test(q) ||
    /\b\d[\d,.]*\s?(k|m)?\s?(ugx|ush|shs|usd|dollars|shillings)\b.{0,20}\b(what|can|how much|enough|get|buy|afford)\b/.test(q) ||
    /\b(ugx|ush|shs|usd|\$)\s?\d[\d,.]*\s?(k|m)?\b.{0,24}\b(what can i get|what do i get|is that enough|enough)\b/.test(q);
  if (stating) {
    const b = parseBudget(raw);
    if (b) {
      return {
        human:
          `Noted: a budget of about **${b.label}**. 📝 I don't keep a public price list and I won't guess what that covers — cost depends on the exact job (device + fault + parts, or design/web scope). ` +
          `Tell me what you need and I'll flag your budget to the owner so they can say honestly what fits.`,
        expert: `BUDGET // Recorded: ${b.label}. No public rate card; scope determines price. Provide job details, then relay to owner.`,
        suggestions: ['Send this to the owner', 'Fix a phone or PC', 'Design or website'],
        topic: 'PRICING_RATES',
        learn: { budget: b.label },
      };
    }
  }
  if (/\b(cheapest|cheap|lowest price|most affordable|least expensive|low cost|discount|bargain|negotiable|can you reduce)\b/.test(q) && /\b(service|price|rate|option|package|deal|one|repair|logo|website|you)\b/.test(q)) {
    return {
      human:
        "I don't have a public price list, so I can't name a \"cheapest\" honestly. 😊 As a rule, small quick jobs (a software fix, an OS reinstall, a file conversion) cost less than component repair, a full brand identity or a multi-page site. Tell me the job and your budget and I'll pass both to the owner for a straight number.",
      expert: 'PRICING // No rate card. Cost scales with scope: software/format jobs < component repair < full brand/web builds. Supply job + budget for a quote.',
      suggestions: ['Send this to the owner', 'Get a quote', 'What services do you offer?'],
      topic: 'PRICING_RATES',
      keepTopic: false,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ scope */

interface Unlisted {
  test: RegExp;
  what: string;
  near: string;
  suggestions: string[];
}

const UNLISTED: Unlisted[] = [
  { test: /\b(ps ?[3-5]|playstation|xbox|nintendo|switch console|game console|gaming console|ps vita)\b/, what: 'game consoles', near: 'I repair phones and PCs (including gaming PCs) — console repair isn\'t on my list', suggestions: ['Gaming PC help', 'Ask the owner about consoles'] },
  { test: /\b(tv|television|smart tv|decoder|dstv|startimes|satellite)\b/, what: 'TVs and decoders', near: 'TV repair isn\'t on my list (I do phones, PCs, design and web), though a PC monitor with no signal is something I can help with', suggestions: ['Monitor has no signal', 'Ask the owner about TVs'] },
  { test: /\b(cctv|security camera|surveillance|alarm system|intercom)\b/, what: 'CCTV and security systems', near: 'CCTV and alarm installs aren\'t on my list', suggestions: ['Ask the owner about CCTV', 'What services do you offer?'] },
  { test: /\b(fridge|refrigerator|washing machine|microwave|cooker|oven|generator|solar|inverter|air ?con)\b/, what: 'household appliances and power equipment', near: 'appliances and power systems aren\'t on my list', suggestions: ['Ask the owner', 'What services do you offer?'] },
  { test: /\b(car|motorbike|boda|vehicle|engine)\b.{0,12}\b(repair|fix|service|diagnos)/, what: 'vehicles', near: 'vehicle repair isn\'t something this site offers', suggestions: ['What services do you offer?'] },
  { test: /\b(mobile app|android app|ios app|iphone app|app development|flutter|react native|play store|app store)\b|\b(build|make|develop|create|code) (me )?an? app\b/, what: 'native mobile apps', near: 'I build websites and web apps (Next.js, React, Tailwind) — a responsive web app that works on phones is possible, but native iOS/Android apps aren\'t on the list', suggestions: ['Build me a website', 'Ask the owner about apps'] },
  { test: /\b(seo|search engine optimi[sz]ation|google ranking|rank (first|#1|on google)|backlinks|digital marketing|social media management|run (my )?ads|facebook ads|instagram ads)\b/, what: 'ongoing SEO and marketing', near: 'I build fast, clean, mobile-friendly sites, which is the technical groundwork SEO needs — but ongoing SEO campaigns or promising rankings aren\'t on my list', suggestions: ['Build me a website', 'Ask the owner about SEO'] },
  { test: /\b(hosting|web hosting|domain( name)?|domain registration|dns setup|email hosting|business email|vps)\b.{0,20}\b(do you|can you|set ?up|sell|offer|provide|manage|buy|register)\b|\b(do you|can you|will you)\b.{0,16}\b(host|hosting|domains?)\b/, what: 'hosting and domains', near: 'selling hosting or domains isn\'t on my list, though I can explain how they work and a site I build can be deployed on modern hosts', suggestions: ['Explain hosting', 'Ask the owner about hosting'] },
  { test: /\b(video edit|video editing|animation video|motion graphics|photograph|photo ?shoot|wedding photo|3d model|3d print|printing press|print shop|banner printing)\b/, what: 'video, photography and printing', near: 'I do graphic design (logos, posters, brand assets) and prepare files for print, but video, photography and the printing itself aren\'t on my list', suggestions: ['Poster design', 'Ask the owner'] },
  { test: /\b(smart ?watch|airpods|earbuds|headphones|speaker|drone|power ?bank|camera|dslr|gopro)\b.{0,12}\b(repair|fix|replace|service)|\b(repair|fix|service)\b.{0,12}\b(smart ?watch|airpods|earbuds|headphones|speaker|drone|power ?bank|camera)\b/, what: 'accessories and gadgets', near: 'gadget repair isn\'t on my list (I do phones and PCs)', suggestions: ['Phone repair', 'Ask the owner'] },
];

const ASKING = /\b(do you|can you|could you|would you|will you|are you able to|are you (guys )?able|do u|can u|is it possible to|does he|can he|can they|do they|can i (get|have)|i need|i want|need someone to|looking for|who can|where can i)\b/;

function scope(q: string): PersonaReply | null {
  if (!ASKING.test(q)) return null;
  // Already something this site does? Let the normal answer handle it.
  if (/\b(phone|iphone|android|samsung|tecno|infinix|laptop|pc|computer|desktop|macbook|screen|battery|logo|brand(ing)?|poster|flyer|website|web ?site|landing page|portfolio|embroidery|jef|vector|ui|ux|figma|wilcom)\b/.test(q) && !/\b(mobile app|android app|ios app)\b/.test(q)) return null;
  for (const u of UNLISTED) {
    if (u.test.test(q)) {
      return {
        human: `${u.near.charAt(0).toUpperCase()}${u.near.slice(1)}, so I won't promise ${u.what} here. 🙏 The owner can confirm if it's possible — want me to send them your question?`,
        expert: `SCOPE // "${u.what}" not in the service list. Listed: [MOBILE/PC REPAIR] [BRAND/GRAPHIC DESIGN] [UI/UX + WEB] [FILE/ASSET CONVERSION]. Relay to owner to confirm.`,
        suggestions: ['Send this to the owner', ...u.suggestions].slice(0, 4),
        topic: 'PORTFOLIO',
        keepTopic: false,
      };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ entry */

export function tryPersona(raw: string, memory: SessionMemory): PersonaReply | null {
  const q = normalize(raw);
  if (!q || q.length > 220) return null;
  return recall(q, raw, memory) || aboutMe(q, memory) || feelings(q, memory) || budget(q, raw) || scope(q);
}

export function personaReply(p: PersonaReply, mode: PersonaMode): string {
  return mode === 'EXPERT' ? p.expert : p.human;
}
