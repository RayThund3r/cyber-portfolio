// src/lib/games/banter.ts — the game buddy's lines: short, funny, kind, family-friendly. Pure and deterministic
// (seeded choice that never repeats the previous line), so it is easy to test and never needs a network.
import type { GameEventKind } from '@/lib/chatBus';
import { mulberry32 } from './rng';

type Pool = string[];

const GENERIC: Partial<Record<GameEventKind, Pool>> = {
  open: [
    'Welcome to the arena. Snacks not included.',
    'New game loaded. My confidence is at 100%, yours is optional.',
    'I will be here if you need tips, or a witty remark.',
    'Stretch those fingers. Warm thumbs are fast thumbs.',
  ],
  start: [
    'And we are off. No pressure. Some pressure.',
    'Go time. I believe in you, mostly.',
    'Deep breath. Eyes on the screen. Ignore the cat.',
    'Fingers ready? Then let us make questionable decisions quickly.',
  ],
  score: ['Nice.', 'Points acquired.', 'Cha-ching, but with fewer coins.', 'Smooth.', 'Keep that rhythm.'],
  good: [
    'That was clean. Chef kiss.',
    'Okay, show-off. I see you.',
    'Textbook. Not a boring textbook, a good one.',
    'Somebody has been practising in secret.',
    'My circuits just did a little clap.',
  ],
  mistake: [
    'Ooh. That one will be in the blooper reel.',
    'It happens to the best of us. Mostly to you right now, but still.',
    'Plot twist: that was on purpose. Right?',
    'Shake it off. The board has a short memory.',
    'Bold strategy. Let us see if it pays off.',
  ],
  streak: [
    '{streak} in a row! Are you hacking? Please say yes.',
    'Streak of {streak}. The crowd (me) goes wild.',
    '{streak} straight. Somebody call the highlight team.',
  ],
  level: ['Level {level}. It gets spicier from here.', 'Level {level} unlocked. Do not look down.', 'Welcome to level {level}, where things get faster and so do your heartbeats.'],
  win: [
    'You won! I am not crying, you are crying.',
    'Victory! Do the little chair dance, you earned it.',
    'Champion. I will update my respect for you accordingly.',
    'That is a W. Frame it.',
  ],
  lose: [
    'Game over. Honestly, it was close. In spirit.',
    'You lost, but you lost with style. Mostly.',
    'The board wins this round. Rematch?',
    'Fun fact: every pro lost like this about a hundred times first.',
    'Well, that is one way to end a game. Again?',
  ],
  draw: ['A draw! Nobody wins, nobody loses, everybody is mildly annoyed.', 'Honourable tie. Handshake on the screen, please.'],
  highscore: [
    'NEW HIGH SCORE: {score}! Screenshot it, brag responsibly.',
    '{score}! That is your personal best. Even I am impressed, and I am hard to impress.',
    'Personal record smashed. Your past self is shook.',
  ],
  idle: [
    'Still there? The game is waiting. So am I. Dramatically.',
    'Take your time. Great thinkers pause. So do people who got distracted.',
    'Psst. Your move. No rush. Okay, a little rush.',
  ],
};

const PER_GAME: Record<string, Partial<Record<GameEventKind, Pool>>> = {
  snake: {
    lose: ['Snake meets wall. The wall had the right of way.', 'You bit your own tail. Classic snake move.'],
    streak: ['{streak} apples! This snake has a healthy diet.'],
    good: ['Tight turn! That snake has a driving licence.'],
  },
  tetris: {
    good: ['Lines cleared! The blocks are shaking in fear.', 'That is how you stack. Tidy like a librarian.'],
    lose: ['The tower of doom has fallen. Rebuild it taller.', 'Blocks reached the ceiling. They wanted a better view.'],
    level: ['Level {level}: the blocks have eaten something spicy.'],
  },
  breakout: {
    mistake: ['The ball escaped. It has dreams of its own.', 'That is one life less. Count them like pocket money.'],
    streak: ['{streak} bricks without touching the paddle. Wrecking ball energy.'],
  },
  pong: {
    good: ['Point to you! The AI is pretending it did not care.'],
    mistake: ['The AI scored. It is smiling in binary.'],
    streak: ['A {streak}-hit rally! Tennis commentators would be proud.'],
    win: ['You beat the AI at the oldest video game in the book. Respect.'],
  },
  flappy: {
    lose: ['The pipe won. It always wins, it has no other hobbies.', 'Splat. Gravity says hello.'],
    streak: ['{streak} pipes! Is that bird on caffeine?'],
  },
  whack: {
    good: ['GOLDEN MOLE! That is a lot of mole.'],
    mistake: ['You whacked a bomb. The bomb sends its regards.'],
    streak: ['{streak} whacks without a miss. The moles have called a meeting.'],
  },
  typing: {
    streak: ['{streak} words clean. Fingers on fire, keyboard on warning.'],
    mistake: ['Typo detected. We do not talk about it.'],
    win: ['Fast fingers! Your keyboard needs a cooldown.'],
  },
  chess: {
    good: ['Strong move. The knights are applauding politely.'],
    mistake: ['Hmm. The queen just raised an eyebrow.'],
    win: ['Checkmate! The king has left the building.'],
    lose: ['Checkmated. Even grandmasters have had that day.'],
  },
  sudoku: { win: ['Solved! Your brain just did cardio.'], good: ['That digit fits like it was born there.'] },
  minesweeper: { lose: ['Boom. That tile was spicy.'], win: ['Field cleared. You walk with confidence now.'] },
  '2048': { good: ['A bigger tile appears. The numbers are multiplying like rabbits.'], lose: ['No more moves. 2048 is a tough crowd.'] },
  memory: { win: ['All pairs found. Your memory has a better memory than mine.'] },
  connect4: { good: ['Double threat! That is evil. Respect.'], lose: ['Four in a row, but not yours. Next time block the sneaky one.'] },
};

export interface BanterCtx { score?: number; streak?: number; level?: number }

function fill(line: string, c: BanterCtx): string {
  return line
    .replace(/\{score\}/g, String(c.score ?? ''))
    .replace(/\{streak\}/g, String(c.streak ?? ''))
    .replace(/\{level\}/g, String(c.level ?? ''));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Pool for this game and event: the game's own lines first, then the general ones. */
export function poolFor(game: string, kind: GameEventKind): string[] {
  const own = PER_GAME[game]?.[kind] ?? [];
  const gen = GENERIC[kind] ?? [];
  return [...own, ...gen];
}

/** Picks a line. `n` is a running counter (so lines vary), `last` is the line said before (never repeated). */
export function pickLine(game: string, kind: GameEventKind, n: number, last: string | null, c: BanterCtx = {}): string | null {
  const pool = poolFor(game, kind).filter((l) => !/\{streak\}/.test(l) || c.streak) .filter((l) => !/\{score\}/.test(l) || c.score !== undefined).filter((l) => !/\{level\}/.test(l) || c.level);
  if (!pool.length) return null;
  const rng = mulberry32(hash(`${game}:${kind}:${n}`));
  let i = Math.floor(rng() * pool.length);
  let line = fill(pool[i], c);
  if (line === last && pool.length > 1) { i = (i + 1) % pool.length; line = fill(pool[i], c); }
  return line;
}

export interface SpeakState { lastAt: number; lastKindAt: Partial<Record<GameEventKind, number>>; scoreEvents: number }
export const newSpeakState = (): SpeakState => ({ lastAt: 0, lastKindAt: {}, scoreEvents: 0 });

/** Anti-spam: important moments always speak (with a tiny gap), small ones only now and then. */
export function shouldSpeak(s: SpeakState, kind: GameEventKind, now: number): boolean {
  const gap = now - s.lastAt;
  const always: GameEventKind[] = ['open', 'start', 'win', 'lose', 'draw', 'highscore'];
  if (always.includes(kind)) return gap > 1200;
  if (kind === 'leave') return false;
  if (gap < 7000) return false;
  const lastSame = s.lastKindAt[kind] ?? 0;
  if (kind === 'score') { s.scoreEvents += 1; return s.scoreEvents % 7 === 0 && now - lastSame > 15000; }
  if (kind === 'idle') return now - lastSame > 45000;
  return now - lastSame > 12000;
}

export function noteSpoken(s: SpeakState, kind: GameEventKind, now: number) { s.lastAt = now; s.lastKindAt[kind] = now; }
