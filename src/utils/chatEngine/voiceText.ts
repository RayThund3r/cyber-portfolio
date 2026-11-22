// src/utils/chatEngine/voiceText.ts
//
// Makes spoken and rushed text behave like typed text, BEFORE the engine tries to understand it:
//   "um open the port folio please"      -> "open the portfolio please"
//   "twenty plus twenty two"             -> "20 plus 22"
//   "no I meant the games page"          -> "the games page"
//   "don't take me to the portfolio"     -> recognised as a NEGATED command (nothing is run)
// Pure functions, no browser APIs. Conservative: only fixed phrases are rewritten.

const ONES: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** "twenty five" -> 25, "one hundred and five" -> 105, "two thousand" -> 2000. Returns null when not a number phrase. */
function wordsToNumber(ws: string[]): number | null {
  if (!ws.length) return null;
  let total = 0;
  let cur = 0;
  let seen = false;
  for (const w of ws) {
    if (w === 'and') continue;
    if (w in ONES) { cur += ONES[w]; seen = true; }
    else if (w in TENS) { cur += TENS[w]; seen = true; }
    else if (w === 'hundred') { cur = (cur || 1) * 100; seen = true; }
    else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; seen = true; }
    else return null;
  }
  return seen ? total + cur : null;
}

const NUMWORD = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)';
const NUMRUN = new RegExp(`\\b${NUMWORD}(?:[ -](?:and )?${NUMWORD})*\\b`, 'gi');

/** Spoken numbers to digits, but only inside a maths-ish or quantity sentence, so "one of my friends" stays words. */
export function spokenNumbers(s: string): string {
  const mathy = /\b(plus|minus|times|multiplied|divided|over|percent|per cent|squared|root|add|subtract|multiply|divide|km|kilometers?|kilometres?|miles?|kg|kilograms?|pounds?|lbs?|celsius|fahrenheit|degrees?|metres?|meters?|feet|inches|litres?|liters?|dollars?|shillings?|ugx|ksh|usd|gb|mb|tb|hours?|minutes?|days?|weeks?|years?|months?)\b/i.test(s);
  if (!mathy) return s;
  return s.replace(NUMRUN, (m) => {
    const ws = m.toLowerCase().split(/[ -]+/);
    if (ws.length === 1 && ws[0] === 'one') return m; // "one" is usually a pronoun
    const n = wordsToNumber(ws);
    return n === null ? m : String(n);
  });
}

// What speech recognition commonly hears for words this site uses.
const MISHEARS: [RegExp, string][] = [
  [/\bport ?folios?\b/gi, 'portfolio'],
  [/\bpour?t ?folio\b/gi, 'portfolio'],
  [/\b(?:contact us|contacts) page\b/gi, 'contact page'],
  [/\bcontacts\b(?! page)/gi, 'contact'],
  [/\btrack(?:er|ing) page\b/gi, 'track page'],
  [/\b(?:the )?tracker\b/gi, 'track page'],
  [/\bservice page\b/gi, 'services page'],
  [/\bweb ?site builder\b/gi, 'website builder'],
  [/\btemplate maker\b/gi, 'template builder'],
  [/\bgames? page\b/gi, 'games page'],
  [/\bdark ?mode\b/gi, 'dark theme'],
  [/\blight ?mode\b/gi, 'light theme'],
  [/\b(?:sudoku|su doku|so doku)\b/gi, 'sudoku'],
  [/\bsnack game\b/gi, 'snake game'],
  [/\bsnake ?s\b/gi, 'snake'],
  [/\bsee ?ss\b/gi, 'ssd'],
  [/\bh\.? ?d\.? ?d\.?\b/gi, 'hdd'],
  [/\bs\.? ?s\.? ?d\.?\b/gi, 'ssd'],
  [/\bwi[- ]fi\b/gi, 'wifi'],
  [/\b(?:dot com|dot c o m)\b/gi, '.com'],
];

const FILLER_LEAD = /^(?:(?:um+|uh+|er+|erm|hmm+|ah+|oh|well|so|okay|ok|alright|right|like|you know|i mean|hey|hi|yo)[, ]+)+(?=\S)/i;
const FILLER_MID = /\b(?:um+|uh+|erm|er)\b[, ]*/gi;
const ADDRESSING = /^(?:hey |hi |ok |okay )?(?:assistant|bot|chat|computer|system|buddy)[, ]+(?=\S)/i;

/** Remove "um", "uh", "hey assistant", stray "like" fillers and trailing "please" duplicates. Keeps meaning words. */
export function stripFillers(s: string): string {
  let out = s.replace(ADDRESSING, '').replace(FILLER_LEAD, '').replace(FILLER_MID, ' ');
  out = out.replace(/\b(?:can|could|would) you (?:please )?(?:like |just )?(?=(?:open|show|take|go|play|switch|scroll|book|track|find|tell|give|explain|help)\b)/i, '');
  out = out.replace(/\blike (?=(?:open|show|take|go|play|switch|scroll|book|track)\b)/gi, '');
  out = out.replace(/\s{2,}/g, ' ').trim();
  return out.length >= 2 ? out : s;
}

/** "no I meant the games page" / "not that, the services" / "sorry I mean pricing" -> the corrected request. */
export function unwrapCorrection(s: string): { text: string; corrected: boolean } {
  const m = /^(?:no|nope|nah|not that|wrong|wait|sorry|oops|actually)[, ]+(?:i (?:meant|mean)|i said|i wanted|i want|try|it'?s|its|the)?\s*(.{3,80})$/i.exec(s.trim()) ||
    /^(?:i (?:meant|mean)|i said)[, ]+(.{3,80})$/i.exec(s.trim());
  if (!m) return { text: s, corrected: false };
  const rest = m[1].trim();
  // Keep "the" when we ate it so "no the games page" still reads as a page request.
  const hadThe = /^(?:no|nope|nah|not that|wrong|wait|sorry|oops|actually)[, ]+the\s/i.test(s.trim());
  return { text: hadThe && !/^the\b/i.test(rest) ? `the ${rest}` : rest, corrected: true };
}

const NEG_CMD = /^(?:please )?(?:(?:no|nope|wait|hey)[, ]+)?(?:i )?(?:do not|don'?t|dont|never|stop|do n't|no need to|there'?s no need to|you (?:don'?t|do not) (?:have|need) to)\s+(?:need to |have to |want you to |want to )?(?:take me|open|go|show|bring|navigate|play|switch|change|scroll|book|send|start|launch|jump|redirect|move|load)\b/i;

/** "don't take me to the portfolio", "no need to open that" — the opposite of a command. */
export function isNegatedCommand(s: string): boolean {
  return NEG_CMD.test(s.trim().replace(/[’`]/g, "'"));
}

const DIGIT_WORD = '(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)';
const DIGITS: Record<string, string> = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };

/** Spoken phone numbers and emails: "plus two five six seven five two ..." -> "+256752...", "ray at gmail dot com" -> "ray@gmail.com". */
export function spokenContact(s: string): string {
  let out = s.replace(new RegExp(`\\b(plus )?(${DIGIT_WORD})(?:[ ,-]+(?:double |triple )?${DIGIT_WORD}){6,}\\b`, 'gi'), (m) => {
    const ws = m.toLowerCase().split(/[ ,-]+/);
    let o = '';
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (w === 'plus') { o += '+'; continue; }
      if (w === 'double' || w === 'triple') { const d = DIGITS[ws[++i]] ?? ''; o += d.repeat(w === 'double' ? 2 : 3); continue; }
      o += DIGITS[w] ?? '';
    }
    return o;
  });
  out = out.replace(/\b([a-z0-9][a-z0-9._-]*?)\s+at\s+([a-z0-9-]+)\s+dot\s+([a-z]{2,4}(?:\s+dot\s+[a-z]{2,4})*)\b/gi, (_m, user: string, host: string, tld: string) => `${user.replace(/\s+/g, '')}@${host}.${tld.trim().split(/\s+dot\s+/).join('.')}`);
  return out;
}

/** "comma", "full stop", "question mark" spoken while dictating. Only when said as separate words at the end of a clause. */
export function spokenPunctuation(s: string): string {
  return s
    .replace(/\s+(?:question mark)\s*$/i, '?')
    .replace(/\s+(?:exclamation (?:mark|point))\s*$/i, '!')
    .replace(/\s+(?:full stop|period)\s*$/i, '.')
    .replace(/\s+comma\s+(?=\S)/gi, ', ');
}

/** Everything above in the right order. Safe to run on typed text too. */
export function normalizeSpoken(input: string): { text: string; corrected: boolean } {
  let s = input.trim().replace(/\s+/g, ' ');
  if (!s) return { text: s, corrected: false };
  const c = unwrapCorrection(s);
  s = c.text;
  s = stripFillers(s);
  s = spokenContact(s);
  for (const [re, to] of MISHEARS) s = s.replace(re, to);
  s = spokenNumbers(s);
  s = spokenPunctuation(s);
  return { text: s, corrected: c.corrected };
}

/** Voice commands that control the microphone box itself, not the assistant. Matched on the WHOLE transcript tail. */
export type VoiceMeta = 'send' | 'clear' | 'stop' | 'quiet' | 'repeat' | 'slower' | 'faster' | null;
export function voiceMeta(transcript: string): { meta: VoiceMeta; text: string } {
  const t = transcript.trim();
  const tail = /^(.*?)[,.\s]*\b(?:send (?:it|that|this|message)|send now|go ahead and send|that'?s all,? send|over and out)\W*$/i.exec(t);
  if (tail && tail[1].trim().length > 1) return { meta: 'send', text: tail[1].trim() };
  if (/^(?:cancel|clear|clear (?:that|it|this|everything)|start over|delete (?:that|it|this|everything)|scratch that|never ?mind)\W*$/i.test(t)) return { meta: 'clear', text: '' };
  if (/^(?:please )?(?:send|send (?:it|that|this|the message)|go ahead|submit|okay send|ok send|yes send)(?: please)?\W*$/i.test(t)) return { meta: 'send', text: '' };
  if (/^(?:stop talking|stop reading|stop|pause|hush|enough|be quiet|quiet please|shut up|silence|stop speaking|that'?ll do|okay stop|ok stop)\W*$/i.test(t)) return { meta: 'quiet', text: '' };
  if (/^(?:speak|talk|read) (?:a bit |a little )?slower\W*$|^slow down\W*$|^too fast\W*$/i.test(t)) return { meta: 'slower', text: '' };
  if (/^(?:speak|talk|read) (?:a bit |a little )?faster\W*$|^speed up\W*$|^too slow\W*$/i.test(t)) return { meta: 'faster', text: '' };
  if (/^(?:say that again|read that again|repeat that|say it again|read it again|what did you say|come again|repeat)\W*$/i.test(t)) return { meta: 'repeat', text: '' };
  if (/^(?:stop listening|stop recording|that'?s it|i'?m done|done talking)\W*$/i.test(t)) return { meta: 'stop', text: '' };
  return { meta: null, text: t };
}
