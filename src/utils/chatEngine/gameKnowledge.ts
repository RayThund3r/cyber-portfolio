// src/utils/chatEngine/gameKnowledge.ts
// The assistant's game knowledge, baked from lib/games/guides.ts: "how do I play snake", "controls for tetris",
// "tips for chess", and context help while a game is open ("any tips?", "I'm losing", "how do I win?").
// Pure and deterministic; decided only from the visitor's own words.
import { GAMES, type GameInfo } from '../../data/gamesData';
import { guideFor, guideText } from '../../lib/games/guides';
import type { GameContext } from '../../lib/chatBus';
import { normalize } from './text';

export interface GameAnswer { human: string; expert: string; suggestions: string[] }
export interface GameKnowledgeOpts { game?: GameContext | null; extGames?: Array<{ title: string; description?: string }> }

type Part = 'all' | 'rules' | 'controls' | 'tips' | 'scoring' | 'goal';

function lev1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || a.length < 5) return false;
  let i = 0; let j = 0; let miss = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++miss > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return miss + (a.length - i) + (b.length - j) <= 1;
}

/** Find the game a sentence is about: exact id/alias/title phrase first, then a one-typo match on single words. */
export function findGameIn(q: string): GameInfo | null {
  const n = ' ' + normalize(q) + ' ';
  let best: { g: GameInfo; len: number } | null = null;
  for (const g of GAMES) {
    for (const name of [g.id, g.title.toLowerCase(), ...g.aliases]) {
      const k = normalize(name);
      if (k.length >= 3 && n.includes(' ' + k + ' ') && (!best || k.length > best.len)) best = { g, len: k.length };
    }
  }
  if (best) return best.g;
  const words = n.trim().split(' ');
  for (const g of GAMES) {
    const names = [g.id, ...g.aliases].map(normalize).filter((x) => x.length >= 5 && !x.includes(' '));
    if (words.some((w) => names.some((nm) => lev1(w, nm)))) return g;
  }
  return null;
}

function partOf(q: string): Part {
  if (/\b(controls?|keys?|buttons?|keyboard|touch|swipe|how (?:do i|to) (?:move|steer|control|rotate|drop|jump))\b/.test(q)) return 'controls';
  if (/\b(tips?|tricks?|strateg(?:y|ies)|advice|get better|improve|win|beat|hints?|cheats?|pro)\b/.test(q)) return 'tips';
  if (/\b(scor(?:e|es|ing)|points?|high ?score)\b/.test(q)) return 'scoring';
  if (/\b(rules?|allowed|legal)\b/.test(q)) return 'rules';
  if (/\b(goal|objective|aim|point of)\b/.test(q)) return 'goal';
  return 'all';
}

const ASKING = /\b(how|what|explain|teach|show|tell|guide|help|rules?|controls?|tips?|tricks?|strateg|instructions?|tutorial|learn|beat|win|score|scoring|objective|goal|hint|advice|stuck|lose|losing|improve|better)\b/;

function render(g: GameInfo, part: Part, expert: boolean): GameAnswer | null {
  const guide = guideFor(g.id);
  if (!guide) return null;
  const body = guideText(guide, part);
  const sug = ['Play ' + g.title, 'Tips for ' + g.title, 'Which game should I play?'];
  return {
    human: `Here's **${g.title}** in a nutshell.\n\n${body}\n\nWant me to open it? Say "play ${g.id}".`,
    expert: expert ? `GAME // ${g.title}\n${body}` : '',
    suggestions: sug,
  };
}

const LOSING = /\b(i'?m losing|im losing|i keep losing|i lose|i suck|so hard|too hard|stuck|help me|i need help|can'?t win|cant win|how do i win|how to win|any tips?|got any tips|tips\??|hint|advice|what should i do|what now|i'?m bad|im bad)\b/;

export function tryGameKnowledge(raw: string, opts: GameKnowledgeOpts = {}): GameAnswer | null {
  const q = normalize(raw);
  if (!q || q.length > 140) return null;

  // "what games are on the site" (incl. owner-added ones)
  if (/^(?:what|which) (?:games|game list)(?: .*)?$|^list (?:the |all )?games$|^(?:do you have|are there) (?:any |more )?games(?: .*)?$|^how many games(?: .*)?$/.test(q) && !findGameIn(q)) {
    const ids = GAMES.slice(0, 40).map((g) => g.title).join(', ');
    const ext = (opts.extGames || []).map((g) => g.title);
    const extLine = ext.length ? `\n\nPlus games the dev built: **${ext.slice(0, 12).join(', ')}**.` : '';
    const text = `There are **${GAMES.length}** games: ${ids}.${extLine}\n\nAsk "how do I play <game>" for a quick guide, or "play <game>" to jump in.`;
    return { human: text, expert: `GAMES // ${GAMES.length} built in` + (ext.length ? ` + ${ext.length} owner games` : '') + `\n${ids}`, suggestions: ['Which game should I play?', 'Play snake', 'How do I play chess?'] };
  }

  const named = findGameIn(q);
  const ctx = opts.game && opts.game.status !== 'idle' ? opts.game : opts.game || null;
  const expertOn = true;

  // Explicit game named with a how/rules/tips style question.
  if (named && ASKING.test(q)) return render(named, partOf(q), expertOn);

  // Context help: no game named, but one is open.
  const cg = ctx ? GAMES.find((g) => g.id === ctx.game) : undefined;
  if (cg) {
    const guide = guideFor(cg.id);
    if (guide && (LOSING.test(q) || /^(?:how (?:do|to) (?:i )?play|rules|controls|how does this work|what (?:is|are) (?:the )?(?:rules|controls|goal)|explain(?: this)?(?: game)?)$/.test(q))) {
      const part = partOf(q);
      if (LOSING.test(q) && part === 'all') {
        const tip = guide.tips[Math.floor((ctx!.ts || 0) % guide.tips.length)] || guide.tips[0];
        const mood = ctx!.status === 'lost' ? 'Rough round, they happen to everyone.' : "You've got this, it's just a bad patch.";
        const text = `${mood} Try this in **${cg.title}**: ${tip}\n\nWant the full guide? Say "tips for ${cg.id}" or tap HOW TO PLAY.`;
        return { human: text, expert: `GAME // ${cg.title}: ${tip}`, suggestions: ['Tips for ' + cg.title, 'Rules of ' + cg.title, 'Which game should I play?'] };
      }
      return render(cg, part, expertOn);
    }
  }
  return null;
}
