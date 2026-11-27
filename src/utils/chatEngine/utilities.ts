// src/utils/chatEngine/utilities.ts
//
// Small exact helpers that need no model and no network: coin/dice/pick/password generators, text tools, naming / tagline /
// colour-palette / font ideas for the design side of the studio, and short "remember this" notes. Every pattern is anchored to
// a whole request, so a sentence that merely mentions "password" or "colour" is never hijacked.

import type { SessionMemory } from './types';

export interface UtilityReply {
  human: string;
  expert: string;
  suggestions?: string[];
  /** Saved into the visitor's session memory (local to their browser). */
  learn?: Record<string, string>;
}

/* ---------------------------------- randomness ---------------------------------- */

function rnd(n: number): number {
  if (n <= 1) return 0;
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c?.getRandomValues) {
      const lim = Math.floor(0x100000000 / n) * n; // rejection sampling: no modulo bias
      const buf = new Uint32Array(1);
      do c.getRandomValues(buf); while (buf[0] >= lim);
      return buf[0] % n;
    }
  } catch { /* fall through */ }
  return Math.floor(Math.random() * n);
}
const pickOne = <T,>(a: readonly T[]): T => a[rnd(a.length)];
function shuffle<T>(a: readonly T[]): T[] {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = rnd(i + 1); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

const WORDS = ['amber', 'anchor', 'beacon', 'birch', 'cobalt', 'comet', 'copper', 'delta', 'ember', 'falcon', 'fjord', 'forest', 'garnet', 'glacier', 'harbor', 'indigo', 'jasper', 'kestrel', 'lantern', 'lotus', 'marble', 'meadow', 'nebula', 'olive', 'orbit', 'pepper', 'quartz', 'raven', 'saffron', 'silver', 'summit', 'tundra', 'velvet', 'willow', 'zephyr', 'maple', 'cinder', 'drift', 'harvest', 'mosaic'];

function password(kind: string, len?: number): string {
  if (kind === 'pin') return Array.from({ length: Math.min(12, Math.max(4, len || 6)) }, () => rnd(10)).join('');
  if (kind === 'passphrase') {
    const n = Math.min(8, Math.max(3, len || 4));
    return Array.from({ length: n }, () => pickOne(WORDS)).join('-') + '-' + (10 + rnd(90));
  }
  const L = Math.min(64, Math.max(8, len || 16));
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*-_=+?'];
  const all = sets.join('');
  const out = sets.map((s) => s[rnd(s.length)]); // at least one of each kind
  while (out.length < L) out.push(all[rnd(all.length)]);
  return shuffle(out).join('');
}

/* ------------------------------------ text tools ------------------------------------ */

const unq = (s: string) => s.trim().replace(/^["“'‘`]+|["”'’`]+$/g, '').trim();
const MAX_TEXT = 4000;
/** Unquoted text is only treated as "the text to process" when it reads like a snippet, not like a sentence about a problem. */
const NOT_SNIPPET = /\b(not|isn'?t|doesn'?t|won'?t|can'?t|my|your|our|on|in|upon|working|charging|how|why|what|when|should|would|could|please|phone|laptop|website|site|screen)\b/i;
const asText = (raw: string): string | null => {
  const quoted = /^["“'‘`].*["”'’`]$/.test(raw.trim());
  const t = unq(raw);
  if (!t) return null;
  if (!quoted && (NOT_SNIPPET.test(t) || t.split(/\s+/).length > 12)) return null;
  return t;
};

function b64(mode: 'encode' | 'decode', text: string): string | null {
  try {
    if (mode === 'encode') {
      const bytes = new TextEncoder().encode(text);
      let bin = '';
      bytes.forEach((b) => { bin += String.fromCharCode(b); });
      return btoa(bin);
    }
    const bin = atob(text.replace(/\s+/g, ''));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch { return null; }
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-–—(])([a-zà-ɏ])/g, (_, a: string, b: string) => a + b.toUpperCase());

/* --------------------------- naming, taglines, palettes, fonts --------------------------- */

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const STOP = /^(a|an|the|my|our|new|small|local|little|online|of|for|to|in|business|company|brand|shop|store)$/i;

/** "a hair salon" -> "salon"; "my phone repair shop" -> "phone repair". */
function subjectOf(q: string): string {
  const m = q.match(/\b(?:for|name|call|named|called)\s+(?:my|our|a|an|the)?\s*([a-z][a-z &'-]{1,40})$/i) || q.match(/\b(?:my|our|a|an)\s+([a-z][a-z &'-]{1,40}?)\s+(?:business|company|brand|shop|store|startup|studio|app|site|website|cafe|salon)\b/i);
  const raw = (m?.[1] || '').replace(/\b(business|company|brand|shop|store|startup|website|site)\b/gi, '').trim();
  const words = raw.split(/\s+/).filter((w) => w && !STOP.test(w)).slice(0, 2);
  return words.join(' ');
}

function businessNames(subject: string): string[] {
  const core = subject ? cap(subject.split(' ').slice(-1)[0]) : '';
  const pre = ['Nova', 'Prime', 'Urban', 'Pure', 'Bright', 'Swift', 'Royal', 'Elite', 'Vivid', 'Core', 'Apex', 'Zen', 'Lumen', 'Atlas', 'Pixel', 'Sunrise'];
  const suf = ['Hub', 'Lab', 'Works', 'House', 'Point', 'Studio', 'Co.', 'Craft', 'Spot', 'Collective', 'Forge', 'Nest', 'Zone', 'Link'];
  const mid = ['ly', 'ify', 'ora', 'ex', 'io', 'ia', 'ova'];
  const out = new Set<string>();
  if (core) {
    out.add(`${pickOne(pre)} ${core}`);
    out.add(`${core} ${pickOne(suf)}`);
    out.add(`${core}${pickOne(mid)}`);
    out.add(`${pickOne(pre)}${core.toLowerCase()}`.replace(/^(.)/, (c) => c.toUpperCase()));
    out.add(`The ${core} ${pickOne(suf)}`);
    out.add(`${core} & ${pickOne(['Co', 'Sons', 'Partners', 'Friends', 'Crew'])}`);
    out.add(`${pickOne(pre)} ${core} ${pickOne(suf)}`);
    out.add(`${core}${pickOne(['Wise', 'Wave', 'Works', 'Wise', 'Grid', 'Loop'])}`);
  }
  while (out.size < 8) out.add(`${pickOne(pre)} ${pickOne(suf)}`);
  return Array.from(out).slice(0, 8);
}

function taglines(subject: string): string[] {
  const s = subject || 'what you do';
  return shuffle([
    `Done right, the first time.`,
    `Your ${s}, made simple.`,
    `Where quality meets care.`,
    `Better ${s}, every day.`,
    `Built to last. Made for you.`,
    `Small details. Big difference.`,
    `${cap(s)} you can trust.`,
    `Real work. Real results.`,
    `Fast, fair and friendly.`,
    `Because you deserve better ${s}.`,
  ]).slice(0, 5);
}

interface Palette { name: string; tags: RegExp; colors: Array<[string, string]> }
const PALETTES: Palette[] = [
  { name: 'Calm trust (tech, finance, repair)', tags: /\b(tech|technology|software|app|it|computer|repair|finance|bank|corporate|professional|trust|saas|startup|cyber|security|blue)\b/, colors: [['#0B1F3A', 'Deep navy (backgrounds, headings)'], ['#1D4ED8', 'Trust blue (buttons, links)'], ['#38BDF8', 'Sky (accents)'], ['#F1F5F9', 'Mist (page background)'], ['#F59E0B', 'Amber (call to action)']] },
  { name: 'Warm appetite (food, cafe, bakery)', tags: /\b(food|restaurant|cafe|coffee|bakery|bake|kitchen|catering|juice|grill|pizza|snack|bar|warm|orange|red)\b/, colors: [['#3B1F0E', 'Espresso (text)'], ['#C2410C', 'Burnt orange (primary)'], ['#F59E0B', 'Honey (accent)'], ['#FEF3C7', 'Cream (background)'], ['#15803D', 'Herb green (fresh touch)']] },
  { name: 'Fresh growth (nature, farm, health, eco)', tags: /\b(nature|farm|garden|eco|organic|green|plant|health|wellness|fitness|yoga|herbal|agri|agriculture|environment)\b/, colors: [['#052E16', 'Forest (text)'], ['#16A34A', 'Leaf (primary)'], ['#84CC16', 'Lime (accent)'], ['#F0FDF4', 'Mint white (background)'], ['#A16207', 'Earth (warm balance)']] },
  { name: 'Soft glamour (beauty, hair, fashion, salon)', tags: /\b(beauty|hair|salon|makeup|fashion|boutique|nails|spa|glam|glamour|cosmetics|skin|wedding|pink|rose|braids|lashes)\b/, colors: [['#2A1A2E', 'Plum ink (text)'], ['#BE185D', 'Rose (primary)'], ['#F9A8D4', 'Blush (accent)'], ['#FFF1F5', 'Petal (background)'], ['#CA8A04', 'Gold (detail)']] },
  { name: 'Quiet luxury (premium, jewellery, real estate)', tags: /\b(luxury|premium|jewel|jewellery|jewelry|real estate|property|hotel|gold|black|elegant|exclusive|watch|architect|law|lawyer|legal)\b/, colors: [['#0A0A0A', 'Black (background)'], ['#1F1F23', 'Graphite (cards)'], ['#D4AF37', 'Gold (primary)'], ['#E7E5E4', 'Stone (text)'], ['#7F1D1D', 'Wine (rare accent)']] },
  { name: 'Playful bright (kids, school, toys, games)', tags: /\b(kids|children|child|school|toys?|games?|gaming|fun|party|play|nursery|education|learning|colourful|colorful)\b/, colors: [['#1E1B4B', 'Midnight (text)'], ['#7C3AED', 'Violet (primary)'], ['#F43F5E', 'Coral (accent)'], ['#FACC15', 'Sunshine (highlight)'], ['#22D3EE', 'Aqua (balance)']] },
  { name: 'Clean care (medical, clinic, pharmacy, cleaning)', tags: /\b(medical|clinic|doctor|dentist|dental|pharmacy|hospital|care|clean|cleaning|laundry|hygiene|teal|lab)\b/, colors: [['#083344', 'Deep teal (text)'], ['#0D9488', 'Teal (primary)'], ['#5EEAD4', 'Aqua (accent)'], ['#F0FDFA', 'Ice (background)'], ['#E11D48', 'Alert red (sparingly)']] },
  { name: 'Bold industrial (construction, auto, print, hardware)', tags: /\b(construction|builder|build|auto|car|garage|mechanic|print|printing|hardware|industrial|engineering|logistics|transport|embroidery|workshop|tools?)\b/, colors: [['#18181B', 'Charcoal (background)'], ['#3F3F46', 'Steel (panels)'], ['#FACC15', 'Hazard yellow (primary)'], ['#F97316', 'Signal orange (accent)'], ['#FAFAFA', 'White (text)']] },
];
const DEFAULT_PALETTE = PALETTES[0];

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 10) / 10;
}

const FONT_PAIRS: Array<{ tags: RegExp; head: string; body: string; note: string }> = [
  { tags: /\b(tech|modern|startup|app|clean|minimal|software|corporate)\b/, head: 'Space Grotesk', body: 'Inter', note: 'Modern and precise. Great for tech, repair and web work.' },
  { tags: /\b(luxury|elegant|premium|wedding|fashion|jewel|beauty|salon|boutique)\b/, head: 'Playfair Display', body: 'Lato', note: 'Elegant serif headings with a clean, readable body.' },
  { tags: /\b(friendly|kids|fun|playful|food|cafe|bakery|school)\b/, head: 'Poppins', body: 'Nunito', note: 'Rounded and warm. Approachable for food, kids and community brands.' },
  { tags: /\b(bold|industrial|sport|gym|construction|auto|print|strong)\b/, head: 'Oswald', body: 'Roboto', note: 'Tall, strong headings that read well from a distance (signs, banners).' },
  { tags: /\b(creative|design|studio|portfolio|art|agency)\b/, head: 'DM Serif Display', body: 'DM Sans', note: 'Expressive but tidy. Good for creative portfolios.' },
];

function vibeOf(q: string): string { return q; }

/* ------------------------------------- notes ------------------------------------- */

const NOTE_MAX = 90;
const NOTES_CAP = 6;
const SECRET = /\b(password|passcode|pin|otp|cvv|card number|credit card|ssn|passport|secret|seed phrase|private key)\b/i;
const readNotes = (m: SessionMemory): string[] => {
  const v = m.userContext?.notes;
  return typeof v === 'string' && v ? v.split('\n').filter(Boolean).slice(0, NOTES_CAP) : [];
};

/* ------------------------------------- entry ------------------------------------- */

const H = (human: string, expert: string, suggestions?: string[], learn?: Record<string, string>): UtilityReply => ({ human, expert, suggestions, learn });

export function tryUtilities(input: string, memory: SessionMemory): UtilityReply | null {
  const q = input.trim().replace(/[?!.]+$/g, '').replace(/\s+/g, ' ');
  const l = q.toLowerCase();
  if (!l || l.length > MAX_TEXT) return null;
  let m: RegExpMatchArray | null;

  // coin
  if (/^(?:please )?(?:flip|toss|spin)(?: me)? (?:a |the )?coin$|^heads or tails$|^coin (?:flip|toss)$/.test(l)) {
    const r = pickOne(['Heads', 'Tails']);
    return H(`**${r}!**`, `RNG // coin: ${r}.`, ['Flip again', 'Roll a dice']);
  }
  // dice
  if ((m = l.match(/^(?:please )?(?:roll|throw)(?: me)? (?:a |an |the )?(?:(\d{1,2})\s*d\s*(\d{1,3})|d(\d{1,3})|(\d{1,2}) (?:dice|die)|dice|die)$/))) {
    const n = Math.min(20, Math.max(1, +(m[1] || m[4] || 1)));
    const sides = Math.min(1000, Math.max(2, +(m[2] || m[3] || 6)));
    const rolls = Array.from({ length: n }, () => 1 + rnd(sides));
    const total = rolls.reduce((a, b) => a + b, 0);
    const text = n === 1 ? `**${rolls[0]}**` : `${rolls.join(' + ')} = **${total}**`;
    return H(`Rolled ${n === 1 ? `a d${sides}` : `${n}d${sides}`}: ${text}`, `RNG // ${n}d${sides}: ${rolls.join(',')} (sum ${total}).`, ['Roll again', 'Flip a coin']);
  }
  // number in a range
  if ((m = l.match(/^(?:please )?(?:pick|give|choose|generate|get|random)(?: me)?(?: a| an)?(?: random)? (?:number|integer|int)(?: (?:between|from)) (-?\d{1,9}) (?:and|to|-) (-?\d{1,9})$/))) {
    const a = Math.min(+m[1], +m[2]); const b = Math.max(+m[1], +m[2]);
    const v = a + rnd(b - a + 1);
    return H(`Your number between ${a} and ${b}: **${v}**`, `RNG // ${a}..${b}: ${v}.`, ['Another one']);
  }
  // choose between options
  if ((m = q.match(/^(?:please )?(?:pick|choose|decide|select)(?: for me)?(?: between| from| one of| one from)? (.{3,300})$/i)) && /,| or /i.test(m[1]) && !/\b(number|password|colou?r|font|name)\b/i.test(m[1])) {
    const opts = m[1].split(/\s*,\s*(?:or\s+)?|\s+or\s+/i).map(unq).filter(Boolean);
    if (opts.length >= 2 && opts.length <= 20) {
      const r = pickOne(opts);
      return H(`I pick **${r}**.`, `RNG // choice: ${r} of ${opts.length}.`, ['Pick again']);
    }
  }
  // passwords / passphrases / PINs
  if ((m = l.match(/^(?:please )?(?:(?:generate|make|create|give|suggest|get)(?: me)?|i need|i want)? ?(?:a |an )?(?:(\d{1,2})[ -]?(?:character|char|digit|word)s?[ -]?(?:long )?)?(?:random |strong |secure |good |new )*(password|passphrase|pin)(?: (?:with|of|that is|that's) (\d{1,2})(?: (?:characters|chars|digits|words|long))?)?$/))) {
    const n = +(m[1] || m[3] || 0) || undefined;
    const pw = password(m[2], n);
    return H(
      `Here's a fresh one, made on your device just now (I don't store it):\n\n\`${pw}\`\n\nUse it with a **password manager** and turn on **two-factor login** where you can.`,
      `PWGEN // ${m[2]}: ${pw}`,
      ['Another one', 'Make a passphrase', 'Make a 6 digit PIN'],
    );
  }

  // text tools
  if ((m = q.match(/^(?:please )?reverse(?: the)?(?: (?:text|word|string|phrase))? (.+)$/i))) {
    const t = asText(m[1]);
    if (t === null) return null;
    return H(`↔️ **${Array.from(t).reverse().join('')}**`, `TEXT // reversed: ${Array.from(t).reverse().join('')}`);
  }
  if ((m = q.match(/^(?:please )?(?:count(?: the)? (words?|characters?|letters?|chars?)(?: (?:in|of))?|how many (words?|characters?|letters?|chars?) (?:are )?(?:in|of)) (.+)$/i))) {
    const t = asText(m[3]);
    if (t === null) return null;
    m[1] = m[1] || m[2];
    const words = (t.match(/\S+/g) || []).length;
    const chars = Array.from(t).length;
    const letters = (t.match(/\p{L}/gu) || []).length;
    const what = m[1].toLowerCase();
    const n = what.startsWith('w') ? words : what.startsWith('l') ? letters : chars;
    return H(`**${n}** ${what.replace(/s$/, '')}${n === 1 ? '' : 's'} (${words} word${words === 1 ? "" : "s"} · ${chars} characters · ${letters} letters).`, `TEXT // words=${words} chars=${chars} letters=${letters}`);
  }
  if ((m = q.match(/^(?:please )?(upper ?case|lower ?case|capitali[sz]e|title ?case|sentence ?case)(?: this| the text)? (.+)$/i))) {
    const t = asText(m[2]); if (t === null) return null;
    const k = m[1].toLowerCase().replace(' ', '');
    const out = k === 'uppercase' ? t.toUpperCase() : k === 'lowercase' ? t.toLowerCase() : k === 'sentencecase' ? t.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()) : titleCase(t);
    return H(`**${out}**`, `TEXT // ${k}: ${out}`);
  }
  if ((m = q.match(/^is ["“']?(.{1,200}?)["”']? (?:a )?palindrome$/i))) {
    const t = unq(m[1]); const s = t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const yes = s.length > 0 && s === Array.from(s).reverse().join('');
    return H(yes ? `Yes, **"${t}"** reads the same both ways.` : `No, **"${t}"** doesn't read the same both ways.`, `TEXT // palindrome: ${yes}`);
  }
  if ((m = q.match(/^(?:please )?base ?64 (encode|decode) (.+)$/i)) || (m = q.match(/^(?:please )?(encode|decode) (.+?) (?:to|in|as|from|into) base ?64$/i))) {
    const out = b64(m[1].toLowerCase() as 'encode' | 'decode', unq(m[2]));
    return out === null
      ? H("That doesn't look like valid Base64 text, so I can't decode it.", 'TEXT // base64 decode failed.')
      : H(`\`${out}\``, `TEXT // base64: ${out}`);
  }
  if ((m = q.match(/^(?:please )?slug(?:ify)? (.{1,120})$/i))) {
    const s = unq(m[1]).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return H(`\`${s || '(nothing left after cleaning)'}\``, `TEXT // slug: ${s}`);
  }

  // naming / taglines / palette / fonts
  if (/\b(?:business|company|brand|shop|store|salon|studio|startup|app|cafe|product|channel|team)\s+names?\b|\bname (?:ideas|suggestions)\b|\b(?:what|any)\b.{0,15}\b(?:should i|can i|to) (?:name|call) (?:my|our|the|a)\b|\b(?:help me|can you) (?:name|come up with a name for) (?:my|our)\b|\b(?:suggest|give me|generate|think of)\b.{0,15}\bnames?\b/.test(l) && !/\b(my|your) name\b/.test(l)) {
    const subject = subjectOf(q);
    const names = businessNames(subject);
    return H(
      `Name ideas${subject ? ` for a **${subject}**` : ''}:\n${names.map((n) => `- **${n}**`).join('\n')}\n\nBefore you commit, check the name isn't taken as a **social handle** and a **domain**. Want taglines to go with it, or a colour palette?`,
      `NAMES // ${names.join(' | ')}`,
      ['More names', 'Taglines for it', 'Colour palette for it', 'Design a logo'],
    );
  }
  if (/\b(?:tag ?lines?|slogans?|mottos?)\b/.test(l) && /\b(?:give|suggest|need|want|write|make|create|come up|ideas?|help|generate)\b/.test(l)) {
    const subject = subjectOf(q);
    const t = taglines(subject);
    return H(`Tagline ideas${subject ? ` for a **${subject}**` : ''}:\n${t.map((x) => `- ${x}`).join('\n')}\n\nShort wins: aim for **under 7 words**. Say "more taglines" for another set.`, `TAGLINES // ${t.join(' | ')}`, ['More taglines', 'Business names', 'Colour palette']);
  }
  if (/\b(?:colou?r (?:palette|scheme|combo|combination|ideas?)s?|palette|brand colou?rs|what colou?rs (?:should|would|work))\b/.test(l) && /\b(?:give|suggest|need|want|what|which|help|pick|best|ideas?|for|recommend|generate|palette)\b/.test(l)) {
    const p = PALETTES.find((x) => x.tags.test(l)) || DEFAULT_PALETTE;
    const text = p.colors[0][0]; const bg = p.colors[3][0]; const primary = p.colors[1][0];
    const onBg = contrast(text, bg); const btn = contrast('#FFFFFF', primary);
    return H(
      `**${p.name}**\n${p.colors.map(([hex, role]) => `- \`${hex}\` ${role}`).join('\n')}\n\nContrast check: text on background **${onBg}:1** ${onBg >= 4.5 ? '' : ''}, white on the primary button **${btn}:1** ${btn >= 4.5 ? '' : 'use dark text there'} (4.5:1 is the readable minimum). Tell me the kind of business and I'll tune it.`,
      `PALETTE // ${p.name}: ${p.colors.map((c) => c[0]).join(' ')} · contrast text/bg ${onBg}, white/primary ${btn}`,
      ['Font pairing for it', 'Name ideas', 'Design a logo'],
    );
  }
  if (/\b(?:font (?:pair|pairing|pairings|combo|combinations?|ideas?|suggestions?)|fonts? (?:for|should|to use|pair)|which fonts?|what fonts?|typeface)\b/.test(l) && /\b(?:give|suggest|need|want|what|which|help|pick|best|ideas?|recommend|use|for)\b/.test(l)) {
    const v = vibeOf(l);
    const f = FONT_PAIRS.find((x) => x.tags.test(v)) || FONT_PAIRS[0];
    return H(`**${f.head}** for headings + **${f.body}** for body text.\n\n${f.note} Both are free on Google Fonts. Keep it to **two fonts** and 2–3 weights so the site stays fast.`, `FONTS // ${f.head} + ${f.body}`, ['Colour palette', 'Name ideas']);
  }

  // notes ("remember that ...")
  if ((m = q.match(/^(?:please )?(?:remember|note|keep in mind|take note|make a note)(?: that| this| down)?[:,]? (.{3,300})$/i))) {
    const note = unq(m[1]);
    if (SECRET.test(note)) {
      return H("I'd rather not keep passwords, PINs or card details, even just in this browser. Tell me anything else and I'll remember it.", 'NOTE // Refused: looks like a secret.');
    }
    const notes = [...readNotes(memory), note.slice(0, NOTE_MAX)].slice(-NOTES_CAP);
    return H(`Noted: **${note.slice(0, NOTE_MAX)}**. I'll keep it for this chat, in this browser only. Ask "what do you remember?" any time.`, `NOTE // saved (${notes.length}).`, ['What do you remember?'], { notes: notes.join('\n') });
  }
  if (/^(?:what (?:did i|have i) (?:tell|told|say|said)(?: you)?(?: so far)?|what do you (?:remember|know)(?: so far)?|what do you remember(?: about me)?|show (?:me )?(?:my )?notes|what are my notes|list my notes|recall)$/.test(l)) {
    const notes = readNotes(memory);
    if (!notes.length) return null; // let the recap / profile handlers answer
    return H(`What you've asked me to remember:\n${notes.map((n) => `- ${n}`).join('\n')}`, `NOTES // ${notes.join(' | ')}`, ['Forget my notes']);
  }
  if (/^(?:forget|clear|delete|erase|wipe) (?:all )?(?:my )?(?:notes|what i told you|everything you remember|what you remember)$/.test(l)) {
    return H('Done, I\'ve forgotten your notes.', 'NOTES // cleared.', undefined, { notes: '' });
  }
  if ((m = l.match(/^what (?:(\w+) )?(?:\w+ )?(?:do|did) i (?:have|use|own|tell you|say)(?: about)?(?: my (\w+))?$/))) {
    const key = (m[2] || m[1] || '').toLowerCase();
    const hit = key.length > 2 ? readNotes(memory).filter((n) => n.toLowerCase().includes(key)) : [];
    if (hit.length) return H(`You told me: ${hit.map((h) => `**${h}**`).join('; ')}.`, `NOTES // ${hit.join(' | ')}`);
  }
  return null;
}
