// src/utils/chatEngine/text.ts
// Small NLP toolkit: normalising, tokenising, light stemming, typo-tolerant matching.

const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does', 'did', 'to', 'of', 'in', 'on',
  'at', 'for', 'with', 'and', 'or', 'but', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we',
  'you', 'your', 'can', 'could', 'would', 'should', 'will', 'please', 'pls', 'some', 'any', 'so', 'just', 'about',
  'what', 'whats', 'how', 'much', 'many', 'tell', 'give', 'gimme', 'want', 'need', 'like', 'get', 'have', 'has',
  'there', 'then', 'than', 'too', 'very', 'really', 'if', 'as', 'by', 'from', 'up', 'out', 'im', 'ive', 'u', 'ur',
  'whats', 'its', 'thats', 'dont', 'doesnt', 'isnt', 'arent', 'hows', 'wheres', 'whos', 'ill', 'id',
  // filler verbs/adverbs that carry no topic ("my pc is running hot" -> pc, hot)
  'run', 'runs', 'running', 'keep', 'keeps', 'always', 'still', 'got', 'getting', 'goes', 'going', 'also', 'now',
  'thing', 'things', 'lot', 'bit', 'suddenly', 'sometimes', 'often',
]);

/** Lowercase, strip accents/emoji/punctuation (keeps apostrophes and inner . / + # - for "next.js", "ui/ux"). */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s'+#./-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "runn" -> "run", "dropp" -> "drop" (but leave "press", "call" alone). */
function undouble(w: string): string {
  return /([bdgmnprt])\1$/.test(w) ? w.slice(0, -1) : w;
}

export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 5 && w.endsWith('ing')) w = undouble(w.slice(0, -3));
  // "speed", "need", "proceed": the -ed belongs to the word, it is not a past-tense ending.
  else if (w.length > 4 && w.endsWith('ed') && !w.endsWith('eed')) w = undouble(w.slice(0, -2));
  else if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

function cleanEdges(t: string): string {
  return t.replace(/^[.'/-]+|[.'/-]+$/g, '');
}

/** Two-word spellings that mean one thing ("back up" = "backup"), joined before tokenising. */
const JOINS: Array<[RegExp, string]> = [
  [/\bback up\b/g, 'backup'],
  [/\bset up\b/g, 'setup'],
  [/\blog in\b/g, 'login'],
  [/\bwi fi\b/g, 'wifi'],
  [/\bsign in\b/g, 'signin'],
  [/\bhard ?disk\b/g, 'harddisk'],
  [/\bpower ?bank\b/g, 'powerbank'],
];

/** Content tokens: normalised, stop-words removed, stemmed. */
export function tokens(input: string, keepStopWords = false): string[] {
  let text = normalize(input);
  for (const [rx, to] of JOINS) text = text.replace(rx, to);
  return text
    .split(' ')
    .map(cleanEdges)
    .map((t) => t.replace(/'/g, '')) // "won't" -> "wont", "what's" -> "whats"
    .filter(Boolean)
    .filter((t) => keepStopWords || !STOP.has(t))
    .map(stem)
    .filter((t) => t.length > 0);
}

/** Optimal-string-alignment distance (Levenshtein + adjacent transposition). */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[a.length][b.length];
}

/** Do two (already stemmed) tokens match, allowing typos on longer words? */
export function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len < 4) return false;
  // 4-letter words may only differ by swapped neighbours ("wfii"/"wifi"): one wrong letter turns "host" into
  // "cost" or "most", which used to make unknown words look like confident matches.
  // Short words: typos almost never change the first letter, and allowing it matched "host" to "ghost".
  if (len <= 5 && a[0] !== b[0]) return false;
  if (Math.max(a.length, b.length) === 4) {
    if (a.length !== b.length || [...a].sort().join('') !== [...b].sort().join('')) return false;
    return editDistance(a, b, 1) <= 1;
  }
  const tolerance = len >= 8 ? 2 : 1;
  return editDistance(a, b, tolerance) <= tolerance;
}

/** Whole-word / whole-phrase test on normalised text. */
export function hasPhrase(normalized: string, phrase: string): boolean {
  const p = normalize(phrase);
  if (!p) return false;
  return (' ' + normalized + ' ').includes(' ' + p + ' ');
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}
