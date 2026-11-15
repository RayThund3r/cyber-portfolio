// src/lib/games/typing.ts — pure Typing Sprint helpers: word source, scoring, WPM and accuracy.
import { Rng, shuffle } from './rng';

export const DURATION = 45;
export const WORDS = ['able', 'about', 'above', 'actor', 'adapt', 'after', 'again', 'agree', 'alarm', 'alone', 'angle', 'apple', 'argue', 'array', 'basic', 'beach', 'begin', 'brain', 'bread', 'brick', 'bring', 'brush', 'build', 'cable', 'candy', 'carry', 'catch', 'chair', 'charm', 'chase', 'check', 'clean', 'clear', 'climb', 'clock', 'cloud', 'coast', 'comet', 'craft', 'crisp', 'dance', 'delay', 'dream', 'drive', 'eager', 'earth', 'enjoy', 'equal', 'event', 'fairy', 'fancy', 'field', 'flame', 'float', 'focus', 'fresh', 'frost', 'ghost', 'giant', 'glass', 'globe', 'grape', 'grass', 'green', 'happy', 'heart', 'honey', 'house', 'ideas', 'index', 'jelly', 'jolly', 'joint', 'juice', 'knock', 'laugh', 'learn', 'light', 'lucky', 'magic', 'major', 'maple', 'model', 'money', 'music', 'night', 'noble', 'ocean', 'order', 'panda', 'paper', 'party', 'pixel', 'plant', 'power', 'proud', 'queen', 'quick', 'quiet', 'radio', 'rapid', 'river', 'robot', 'round', 'scale', 'shine', 'sleep', 'smart', 'smile', 'solid', 'sound', 'space', 'speed', 'storm', 'sugar', 'table', 'tiger', 'toast', 'track', 'trend', 'unity', 'value', 'vivid', 'voice', 'water', 'whale', 'wheel', 'world', 'young', 'zebra', 'balance', 'bicycle', 'captain', 'chicken', 'compass', 'diamond', 'elegant', 'fantasy', 'gallery', 'harvest', 'journey', 'kitchen', 'lantern', 'mystery', 'network', 'orchard', 'penguin', 'rainbow', 'sunrise', 'thunder', 'village', 'wizard'];

export function makeWords(rng: Rng, n = 120): string[] {
  const out: string[] = [];
  while (out.length < n) out.push(...shuffle(WORDS, rng));
  return out.slice(0, n);
}

/** Standard WPM: five characters count as one word. */
export const wpm = (correctChars: number, seconds: number) => (seconds <= 0 ? 0 : Math.round((correctChars / 5) * (60 / seconds)));
export const accuracy = (correctKeys: number, totalKeys: number) => (totalKeys <= 0 ? 100 : Math.round((correctKeys / totalKeys) * 100));
export const isMatch = (typed: string, word: string) => typed.trim().toLowerCase() === word.toLowerCase();
/** How many leading characters of `typed` are right (for live highlighting). */
export function prefixOk(typed: string, word: string): number {
  let i = 0;
  while (i < typed.length && i < word.length && typed[i].toLowerCase() === word[i].toLowerCase()) i++;
  return i;
}
