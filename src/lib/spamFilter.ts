// src/lib/spamFilter.ts — scores a contact/booking message for spam and nonsense. Pure (no I/O) so it is unit-tested.
// Not a black box: every point has a stated reason, which the owner sees in Admin → Security → Spam filter.
// Levels: ok → delivered normally · hold → saved as a ticket marked "[Possible spam]" but the owner is not emailed · block → refused.

export type Strictness = 'relaxed' | 'normal' | 'strict';
export interface SpamCfg { enabled: boolean; level: Strictness; blockWords: string[]; topicWords: string[] }
export const DEFAULT_SPAM_CFG: SpamCfg = { enabled: true, level: 'normal', blockWords: [], topicWords: [] };
export interface SpamInput { name?: string; email?: string; phone?: string; details?: string; elapsedMs?: number }
export interface SpamVerdict { level: 'ok' | 'hold' | 'block'; score: number; reasons: string[]; bot: boolean }

const THRESHOLDS: Record<Strictness, { hold: number; block: number }> = { relaxed: { hold: 5, block: 8 }, normal: { hold: 4, block: 6 }, strict: { hold: 2, block: 4 } };

const SPAM_PHRASES: Array<[RegExp, string]> = [
  [/back-?links?|guest post|domain authority|\bseo (service|package|expert|specialist|ranking|audit)|rank (your (site|website)|#?1|on the first page)|first page of google|website traffic|increase your (sales|traffic|rankings?)/i, 'SEO / traffic selling'],
  [/\b(bitcoin|crypto(currency)?|forex|binary options?|nft|airdrop|usdt|ethereum)\b|investment opportunit|guaranteed (profit|returns?)|double your (money|investment)/i, 'crypto / investment pitch'],
  [/\b(casino|betting|sportsbook|slot gacor|jackpot|poker|bet365|1xbet)\b/i, 'gambling'],
  [/\b(viagra|cialis|pharmacy|weight loss pills?|erectile|penis|enlargement)\b/i, 'pharma / adult products'],
  [/\b(porn|xxx|escort|adult dating|hot girls|singles in your area|sexy (girls|women)|nude)\b/i, 'adult content'],
  [/loan (offer|approval|available)|(get|apply for) (a |an )?(quick |instant )?loan|credit repair|debt relief/i, 'loan offer'],
  [/make \$?\d[\d,]* ?(\$|usd|dollars)? (a|per) (day|week|hour)|earn (money|\$|extra income)|work from home|passive income|financial freedom/i, 'get-rich pitch'],
  [/click here|limited time offer|act now|free money|congratulations,? you|you (have )?won|claim your (prize|reward|gift)|lottery|inheritance|nigerian prince|beneficiary/i, 'scam wording'],
  [/buy (instagram |tiktok |facebook |youtube )?(followers|likes|views|subscribers)|followers for sale/i, 'followers selling'],
  [/i (visited|came across|found) your (web)?site|our (agency|company|team) (offers?|provides?|specializes)|we (offer|provide) (seo|web design|website|app development|digital marketing|marketing) services?|i can (build|design|redesign) (you )?a (new )?website for \$|digital marketing (services|agency)/i, 'cold sales pitch'],
  [/\b(telegram|whatsapp) (group|channel) (for|to) (earn|profit|signals?)|join (our|my) (telegram|whatsapp) (group|channel)|dear (sir|madam|friend|beloved)/i, 'mass-message wording'],
];
const DISPOSABLE = /@(mailinator|guerrillamail|sharklasers|yopmail|tempmail|temp-mail|10minutemail|trashmail|getnada|dispostable|maildrop|throwaway|fakeinbox|mohmal|emailondeck|mintemail)\./i;
const KEYBOARD_RUNS = ['asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl', 'qwer', 'wert', 'erty', 'rtyu', 'tyui', 'yuio', 'uiop', 'zxcv', 'xcvb', 'cvbn', 'vbnm', 'qazw', 'wsxe', 'jkjk', 'lkjh', 'poiu'];
const TOPIC = /\b(repair|fix|fixed|phone|iphone|android|samsung|tecno|infinix|laptop|computer|pc|desktop|screen|display|battery|charger|charging|water|software|windows|mac|virus|data|recover|install|upgrade|ssd|ram|hard ?drive|motherboard|keyboard|tv|printer|camera|speaker|website|web|site|design|logo|brand|branding|poster|flyer|banner|ui|ux|app|mobile|portfolio|shop|store|business|menu|price|prices|cost|quote|estimate|book|booking|appointment|visit|pickup|pick up|deliver|delivery|warranty|broken|cracked|dead|slow|hang|hanging|freez\w*|network|wifi|router|cctv|hello|hi|hey|help|urgent|how much|how long|open|hours|location|where|available|ndejje|kampala|uganda|ssabagabo|makindye|muyenga|entebbe)\b/i;

const letters = (s: string) => (s.match(/\p{L}/gu) || []).length;
const junkWord = (w: string) => {
  const lw = w.toLowerCase();
  if (lw.length >= 5 && !/[aeiouy]/.test(lw)) return true;                 // "xkcdpqrst"
  if (/[^aeiouy\s\d\W_]{6,}/i.test(lw)) return true;                          // 6+ consonants in a row
  if (/(.)\1{4,}/.test(lw)) return true;                                      // "aaaaaa"
  if (KEYBOARD_RUNS.some((k) => lw.includes(k))) return true;                 // "asdfgh"
  return false;
};

export function judgeMessage(inp: SpamInput, cfg: SpamCfg = DEFAULT_SPAM_CFG): SpamVerdict {
  const reasons: string[] = []; let score = 0, bot = false;
  const add = (pts: number, why: string) => { score += pts; reasons.push(why); };
  if (!cfg.enabled) return { level: 'ok', score: 0, reasons: [], bot: false };
  const name = String(inp.name || ''), email = String(inp.email || ''), phone = String(inp.phone || ''), text = String(inp.details || '');
  const all = `${name} ${text}`;

  // 1) spam wording (each kind counts once)
  for (const [re, why] of SPAM_PHRASES) if (re.test(all)) add(4, why);
  for (const w of cfg.blockWords.slice(0, 80)) { const t = w.trim().toLowerCase(); if (t.length >= 2 && all.toLowerCase().includes(t)) { add(5, `your blocked word “${t}”`); break; } }

  // 2) links and addresses
  const links = (all.match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|info|xyz|top|biz|site|online|shop|click|link|ru|cn)\b\/?/gi) || []).length;
  if (links >= 3) add(4, `${links} links`); else if (links === 2) add(3, '2 links'); else if (links === 1 && text.length < 60) add(1, 'a link and little else');
  if ((text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).length >= 2) add(2, 'several e-mail addresses in the text');
  if (/https?:\/\/|www\./i.test(name)) add(3, 'a link in the name field');

  // 3) nonsense
  const words = text.split(/\s+/).filter(Boolean);
  const junk = words.filter((w) => w.length >= 4 && junkWord(w.replace(/[^\p{L}]/gu, ''))).length;
  if (words.length >= 3 && junk / words.length >= 0.4) add(4, 'looks like random typing');
  else if (junk >= 2) add(3, 'several nonsense words');
  else if (junk === 1 && words.length <= 3) add(2, 'a nonsense word');
  if (words.some((w) => w.length > 40 && !/^https?:/i.test(w))) add(2, 'a very long unbroken string');
  if (words.length >= 6) { const freq: Record<string, number> = {}; words.forEach((w) => { const k = w.toLowerCase(); freq[k] = (freq[k] || 0) + 1; }); if (Math.max(...Object.values(freq)) / words.length > 0.5) add(3, 'the same word repeated'); }
  const L = letters(text), upper = (text.match(/\p{Lu}/gu) || []).length;
  if (L >= 20 && upper / L > 0.7) add(2, 'ALL CAPITALS');
  const nonLatin = (text.match(/[Ѐ-ӿ؀-ۿ一-鿿぀-ヿ가-힯]/g) || []).length;
  if (L >= 15 && nonLatin / L > 0.4) add(3, 'mostly a language this site does not serve');
  if ((text.match(/\p{Extended_Pictographic}/gu) || []).length > 8) add(1, 'lots of emoji');
  if (text.trim().length > 0 && text.trim().length < 6) add(2, 'almost no message');

  // 4) the sender's details
  const nameDigits = (name.match(/\d/g) || []).length;
  if (name && (nameDigits > 3 || (name.length >= 4 && junkWord(name.replace(/[^\p{L}]/gu, ''))))) add(3, 'the name looks fake');
  if (name && text && name.trim().toLowerCase() === text.trim().toLowerCase()) add(2, 'name and message are identical');
  if (DISPOSABLE.test(email)) add(3, 'a throw-away e-mail address');
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 7 && (/^(\d)\1+$/.test(digits) || '01234567890123456789'.includes(digits) || '98765432109876543210'.includes(digits))) add(2, 'a made-up phone number');
  if (typeof inp.elapsedMs === 'number' && inp.elapsedMs >= 0 && inp.elapsedMs < 1500 && text.length > 20) { add(4, 'filled in faster than a person can'); bot = true; }

  // 5) off-topic: a long message that mentions nothing this business does
  const topical = TOPIC.test(text) || cfg.topicWords.slice(0, 80).some((w) => w.trim().length >= 2 && text.toLowerCase().includes(w.trim().toLowerCase()));
  if (text.length >= 80 && !topical) add(2, 'does not mention anything this business does');

  const th = THRESHOLDS[cfg.level] || THRESHOLDS.normal;
  const level = score >= th.block ? 'block' : score >= th.hold ? 'hold' : 'ok';
  if (score >= th.block + 4) bot = true;
  return { level, score, reasons, bot };
}

export function sanitizeSpamCfg(x: unknown): SpamCfg {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\n,]/) : []).map((s) => String(s).trim().toLowerCase().slice(0, 40)).filter((s) => s.length >= 2).slice(0, 80);
  return { enabled: o.enabled !== false, level: o.level === 'relaxed' || o.level === 'strict' ? o.level : 'normal', blockWords: Array.from(new Set(list(o.blockWords))), topicWords: Array.from(new Set(list(o.topicWords))) };
}
export const BLOCK_MESSAGE = "That message looks like spam or isn't something we can help with, so it wasn't sent. If it's a real enquiry, please say in a sentence or two what you need, or message us on WhatsApp.";
