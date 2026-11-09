// src/utils/chatEngine/tour.ts
//
// Two small conversational abilities that need no AI model:
//   * a guided site TOUR ("give me a tour" -> "Next stop" ... each stop moves the real site)
//   * a RECAP of the conversation so far ("recap", "what have we covered")
// Both are decided only from what the visitor typed, and use the same SiteCommand mechanism as
// every other navigation, so nothing the model says can trigger them.
import type { PersonaMode, SessionMemory, SiteCommand } from './types';
import type { Entities } from './entities';
import { deviceLabel, SYMPTOM_LABEL } from './entities';

export interface TourReply {
  human: string;
  expert: string;
  suggestions: string[];
  command?: SiteCommand;
  learn?: Record<string, any>;
}

interface Stop {
  say: string;
  expert: string;
  command: SiteCommand;
}

const STOPS: Stop[] = [
  {
    say: "**Stop 1 · Home.** This is the front door: what's offered at a glance, plus the live terminal on the right.",
    expert: 'TOUR 1/6 // HOME',
    command: { type: 'navigate', path: '/', label: 'TOUR 1/6 · HOME' },
  },
  {
    say: '**Stop 2 · Stack.** The tools and skills behind the work, from board-level repair to Figma and Next.js.',
    expert: 'TOUR 2/6 // STACK',
    command: { type: 'scroll', id: 'stack', label: 'TOUR 2/6 · STACK' },
  },
  {
    say: '**Stop 3 · Terminal.** A real little command line. Try `ls projects`, `neofetch` or `matrix`. I just ran `neofetch` in it for you.',
    expert: 'TOUR 3/6 // TERMINAL',
    command: { type: 'terminal', cmd: 'neofetch', label: 'TOUR 3/6 · TERMINAL' },
  },
  {
    say: '**Stop 4 · Portfolio.** Every project with its tools and results. Tap one for the full case study.',
    expert: 'TOUR 4/6 // PORTFOLIO',
    command: { type: 'portfolio', label: 'TOUR 4/6 · PORTFOLIO' },
  },
  {
    say: '**Stop 5 · Services.** What can be done, how long it typically takes, and how a repair runs from diagnosis to testing.',
    expert: 'TOUR 5/6 // SERVICES',
    command: { type: 'navigate', path: '/services', label: 'TOUR 5/6 · SERVICES' },
  },
  {
    say: '**Stop 6 · Contact.** The end of the tour: send a repair or design request, or ask me and I can pass it on to the owner.',
    expert: 'TOUR 6/6 // CONTACT',
    command: { type: 'contact', label: 'TOUR 6/6 · CONTACT' },
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();

const START_RX = /^(?:(?:please |pls )?(?:give me|take me on|start|begin|i want|i would like|id like|can i get|can i have|show me|do|lets do|let's do|lets take|let's take) )?(?:a |an |the |my )?(?:quick |short |guided |site |website |little )*(?:tour|walkthrough|walk through|walk-through)(?: of (?:the |this |your )?(?:site|website|portfolio|page|place))?(?: please)?$/;
const NEXT_RX = /^(?:next stop|next stop please|continue(?: the)? tour|keep going|carry on|onward|go on|next one|next tour stop)$/;
const END_RX = /^(?:end(?: the)? tour|stop(?: the)? tour|exit(?: the)? tour|cancel(?: the)? tour|no more tour|skip the tour)$/;

const tourAt = (m: SessionMemory): number => {
  const t = m.userContext?.tour;
  return typeof t === 'number' ? t : -1;
};

export function tryTour(raw: string, mode: PersonaMode, memory: SessionMemory): TourReply | null {
  const q = norm(raw);
  if (!q) return null;
  const at = tourAt(memory);
  const t = (h: string, e: string) => (mode === 'EXPERT' ? e : h);

  if (END_RX.test(q)) {
    if (at < 0) return null;
    return {
      human: 'Tour ended. Ask me anything, or say "give me a tour" to run it again.',
      expert: 'TOUR // ended',
      suggestions: ['Show me your projects', 'Book a repair', 'Get a quote'],
      learn: { tour: -1 },
    };
  }

  const start = START_RX.test(q) || q === 'tour';
  const next = at >= 0 && NEXT_RX.test(q);
  if (!start && !next) return null;

  const i = start ? 0 : at + 1;
  if (i >= STOPS.length) {
    return {
      human: "That's the whole tour. 🎉 Want to see the work, get a quote, or pass a message to the owner?",
      expert: 'TOUR // complete',
      suggestions: ['Show me your projects', 'Get a quote', 'Message the owner'],
      learn: { tour: -1 },
    };
  }
  const s = STOPS[i];
  const last = i === STOPS.length - 1;
  const intro = start ? "Let's go — six quick stops, and I'll move the page for you.\n\n" : '';
  return {
    human: `${intro}${s.say}`,
    expert: s.expert,
    command: s.command,
    suggestions: last ? ['Get a quote', 'Book a repair', 'End tour'] : ['Next stop', 'End tour'],
    learn: { tour: last ? -1 : i },
  };
}

const RECAP_RX = /^(?:please |pls )?(?:recap|sum(?:mary|marise|marize)|(?:can you |could you )?(?:sum(?:marise|marize)|recap) (?:our|this|the) (?:chat|conversation|talk)|conversation (?:summary|recap)|catch me up|what (?:have we|did we|we) (?:covered?|discuss(?:ed)?|talk(?:ed)? about)(?: so far)?|what (?:did|have) i (?:ask(?:ed)?|say|said|told you)(?: (?:you|earlier|before|so far))*|what do you (?:know|remember) (?:about me|so far)|where (?:are|were) we|where were we)$/;

function facts(ent: Entities | undefined): string[] {
  if (!ent) return [];
  const out: string[] = [];
  if (ent.device || ent.brand || ent.model) out.push(`device: ${deviceLabel(ent)}`);
  if (ent.symptom) out.push(`problem: ${SYMPTOM_LABEL[ent.symptom] ?? String(ent.symptom)}`);
  if (ent.project) out.push(`project type: ${String(ent.project)}`);
  if (ent.urgent) out.push('it is urgent');
  if (ent.dataAtRisk) out.push('you have data you cannot lose');
  return out;
}

export function tryRecap(raw: string, mode: PersonaMode, memory: SessionMemory, ent?: Entities): TourReply | null {
  if (!RECAP_RX.test(norm(raw))) return null;
  const asked: string[] = [];
  for (const turn of memory.conversationHistory || []) {
    if (turn.role !== 'user') continue;
    const s = turn.text.trim().replace(/\s+/g, ' ');
    if (s.length < 3 || /^\/?(recap|catch me up)/i.test(s)) continue;
    const short = s.length > 70 ? `${s.slice(0, 67)}…` : s;
    if (!asked.includes(short)) asked.push(short);
  }
  const known = facts(ent);
  if (!asked.length && !known.length) {
    return {
      human: "We've only just started, so there's nothing to recap yet. Tell me what you need and I'll keep track of it.",
      expert: 'RECAP // empty session',
      suggestions: ['My device has a problem', 'Show me your projects', 'Give me a tour'],
    };
  }
  const recent = asked.slice(-6);
  const human = [
    recent.length ? `Here's where we are. You've asked about:\n${recent.map((a) => `- ${a}`).join('\n')}` : '',
    known.length ? `\nWhat I've picked up about your situation: ${known.join(' · ')}.` : '',
    '\nSay "start over" in the chat menu if any of that is wrong, or tell me what to correct.',
  ]
    .filter(Boolean)
    .join('\n');
  const expert = `RECAP // ${recent.map((a, i) => `${i + 1}:${a}`).join(' | ')}${known.length ? `\nCONTEXT // ${known.join(', ')}` : ''}`;
  return {
    human: mode === 'EXPERT' ? expert : human,
    expert,
    suggestions: ['Get a quote', 'Message the owner', 'Show me your projects'],
  };
}
