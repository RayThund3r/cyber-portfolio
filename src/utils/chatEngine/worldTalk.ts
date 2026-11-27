// src/utils/chatEngine/worldTalk.ts
// Two small, deterministic pieces of personality:
//  1. World-calendar talk: "any holidays today?", "what's coming up?", and well-wishes ("Happy Independence Day", "Eid Mubarak").
//  2. Easter eggs: whole-message matches only, so ordinary questions are never hijacked.
import { upcomingEvents } from '../../lib/events/calendar';
import { eventsNow, DEFAULT_EVENTS_CFG, type EventsConfig } from '../../lib/events/config';
import type { FxName } from '../../lib/events/calendar';
import { normalize } from './text';

export interface TalkAnswer { human: string; expert: string; fx?: FxName; suggestions?: string[] }

const WORDS = /\b(independence|christmas|xmas|new year|easter|eid|ramadan|diwali|valentine|halloween|women'?s day|africa day|labou?r day|heroes day|martyrs|mandela|programmers? day|earth day|youth day|lunar new year|pi day|good friday|boxing day|mental health day|peace day)\b/;
const WISH = /^(?:a |wishing you a )?(?:very |blessed |joyous )?(?:happy|merry|blessed|joyful|have a (?:great|lovely|blessed|happy))\b|\b(?:eid|ramadan) (?:mubarak|kareem)\b|^season'?s greetings\b/;

const day = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function tryWorldTalk(raw: string, cfg: EventsConfig = DEFAULT_EVENTS_CFG, now: Date = new Date()): TalkAnswer | null {
  const q = normalize(raw);
  if (!q || q.length > 90) return null;
  const today = eventsNow(cfg, now);

  // Well-wishes: answer in kind, and add the celebration when it is the real day.
  if (WISH.test(q) && WORDS.test(q) && !/birthday/.test(q)) {
    const hit = today[0];
    const line = hit ? `Thank you, and the same to you! ${hit.say}` : 'Thank you, and the same to you! (It is not quite the day yet, but I will take the early wishes.)';
    return { human: line, expert: 'GREETING // Same to you.', fx: hit && hit.tone === 'celebrate' ? hit.fx : 'confetti', suggestions: ['What is coming up?', 'Show me your work'] };
  }

  if (/^(?:is it |is today |is there )?(?:a |any )?(?:holiday|holidays|event|events|special day|celebration)(?: today| now)?\??$|^(?:what'?s|whats) (?:special |happening |on )?today\??$|^what(?:'?s| is) (?:the )?(?:occasion|event|holiday)(?: today)?\??$|^any (?:holiday|holidays|events?|celebrations?) (?:today|now|on)\??$/.test(q) || /^(?:is it|is today) (?:a )?(?:public )?holiday\??$/.test(q)) {
    if (!today.length) {
      const nx = upcomingEvents(now, 1, cfg.off)[0];
      const tail = nx ? ` Next up: **${nx.name}** on ${day(nx.start)}.` : '';
      return { human: `Nothing special on the calendar today, just a good day to build things.${tail}`, expert: `CAL // No event today.${nx ? ` Next: ${nx.name} (${nx.start}).` : ''}`, suggestions: ['What is coming up?'] };
    }
    const names = today.map((e) => e.name).join(' · ');
    return { human: `Today: **${names}**. ${today[0].say}`, expert: `CAL // ${names}`, fx: today[0].tone === 'celebrate' ? today[0].fx : undefined, suggestions: ['What is coming up?'] };
  }

  if (/^(?:what'?s|whats|what is) (?:coming up|next|the next (?:holiday|event))\??$|^(?:upcoming|next) (?:holidays?|events?)\??$|^(?:what )?(?:holidays|events) (?:are )?(?:coming|next|upcoming)\??$/.test(q)) {
    const list = upcomingEvents(now, 5, cfg.off);
    if (!list.length) return { human: 'Nothing on the calendar right now.', expert: 'CAL // Empty.' };
    const lines = list.map((e) => `- **${e.name}** (${day(e.start)})${e.approx ? ', date may vary' : ''}`).join('\n');
    return { human: `Coming up:\n${lines}\n\nThe site marks these with a little ribbon and a surprise or two.`, expert: `CAL // upcoming\n${lines}`, suggestions: ['Any holiday today?'] };
  }
  return null;
}

// ---- Easter eggs -------------------------------------------------------------------------------
const EGGS: Array<{ test: RegExp; human: string; expert?: string; fx?: FxName; suggestions?: string[] }> = [
  { test: /^(?:do a )?barrel roll$|^do a flip$|^spin(?: the page| the site)?$/, human: 'Doing a barrel roll! (Peppy would be proud.)', fx: 'barrel' },
  { test: /^(?:party|confetti|celebrate|throw a party|let'?s party|make it rain confetti|surprise me)$/, human: 'Party time!', fx: 'confetti' },
  { test: /^(?:snow|let it snow|make it snow|winter)$/, human: 'Let it snow! (Warning: Kampala may remain 27 degrees.)', fx: 'snow' },
  { test: /^(?:matrix|enter the matrix|the matrix|follow the white rabbit|red pill|take the red pill|digital rain)$/, human: 'You took the red pill. Welcome to the real portfolio.', fx: 'matrix' },
  { test: /^(?:hearts|show (?:me )?some love|love|spread (?:the )?love)$/, human: 'Sending love.', fx: 'hearts' },
  { test: /^(?:stars|starry night|show me the stars|lights out)$/, human: 'Look up.', fx: 'stars' },
  { test: /^sudo(?: .*)?$/, human: 'visitor is not in the sudoers file. This incident will be reported. (To nobody. Probably.)' },
  { test: /^rm -rf(?: .*)?$/, human: 'Permission denied. Also, please never type that anywhere that matters.' },
  { test: /^(?:open the pod bay doors?(?:,? hal)?)$/, human: "I'm sorry, Dave. I'm afraid I can't do that. (Kidding. All doors are open, come on in.)" },
  { test: /^(?:what(?:'?s| is) the (?:answer|meaning) (?:to|of) (?:life|everything)(?:,? the universe(?:,? and everything)?)?|meaning of life|42)$/, human: '42. Though I suspect the real question is "what should I build next?"' },
  { test: /^(?:hack the planet|hack the mainframe|i'?m in|hacker ?man)$/, human: "ACCESS GRANTED. Just kidding, you've been in the whole time. Try the terminal on the home page!", suggestions: ['Open the terminal'] },
  { test: /^ping$/, human: 'pong' },
  { test: /^marco$/, human: 'Polo!' },
  { test: /^(?:knock knock)$/, human: "Who's there? ...Actually, it's your turn to say it." },
  { test: /^(?:i love you|love you|i like you)$/, human: "That's very kind. I'm a very enthusiastic piece of code, and I'm happy you're here.", fx: 'hearts' },
  { test: /^(?:tell me a joke about (?:computers?|programming|code))$|^(?:programming|computer|tech|nerd) joke$/, human: 'There are 10 kinds of people: those who understand binary and those who don\'t.' },
  { test: /^(?:is the cake a lie|the cake is a lie)$/, human: 'The cake is a lie. The warranty, however, is real.' },
  { test: /^(?:what(?:\'?s| is) your (?:favou?rite|fav) (?:colou?r|game|food))\??$/, human: 'Cyan, snake, and a freshly flashed firmware, in that order.' },
  { test: /^(?:do you dream|do you sleep|are you alive|are you sentient|are you self[- ]aware)\??$/, human: 'I run on rules, search and sometimes a small model. No dreams, but I do wake up very fast.' },
  { test: /^(?:beam me up(?:,? scotty)?|make it so|engage|live long and prosper)$/, human: 'Engaged. Warp factor... whatever this site can handle on mobile data.', fx: 'stars' },
  { test: /^(?:it'?s over 9000|over 9000|what does the scouter say)\??$/, human: 'It\'s over 9000! (The scouter says: this portfolio is well-optimised.)', fx: 'confetti' },
  { test: /^(?:use the force|may the force be with you|i find your lack of faith disturbing)$/, human: 'The force is strong with this visitor.', fx: 'stars' },
  { test: /^(?:xyzzy|plugh|iddqd|idkfa|up up down down left right left right b a)$/, human: 'Nothing happens. ...Or does it? (Try the arrow keys, then B and A, on any page.)' },
  { test: /^(?:ctrl ?\+? ?z|undo|undo that)$/, human: 'If only life had an undo. This site does, in the template builder: Ctrl+Z works there.' },
  { test: /^(?:coffee|make me (?:a )?coffee|i need coffee)$/, human: 'Error 418: I am a teapot. (Coffee is on you, though I can offer a repair quote.)' },
  { test: /^(?:are you (?:chatgpt|gpt|claude|gemini|siri|alexa))\??$/, human: 'Nope. I\'m this site\'s own assistant: rules, a knowledge base, search, and optionally a small model.' },
  { test: /^(?:tell me a secret|any (?:easter )?eggs?|easter eggs?|secrets?|cheat codes?|konami(?: code)?|hidden (?:stuff|things|features?))\??$/, human: "Secrets exist, but I'll only give hints.\n- A famous gamer's cheat code works on a keyboard (and as swipes on a phone).\n- Some words do things when typed anywhere on the page.\n- I respond to a certain aerial manoeuvre.\nHappy hunting!", expert: 'EGGS // hint: classic cheat code · typed words · aerial manoeuvre.' },
];

export function tryEgg(raw: string): TalkAnswer | null {
  const q = normalize(raw);
  if (!q || q.length > 60) return null;
  const e = EGGS.find((x) => x.test.test(q));
  return e ? { human: e.human, expert: e.expert ?? e.human, fx: e.fx, suggestions: e.suggestions } : null;
}
