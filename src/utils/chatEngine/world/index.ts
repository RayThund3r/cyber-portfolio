// src/utils/chatEngine/world/index.ts — offline world-knowledge resolver. No model, no internet.
// Everything here is evergreen. Matching is strict on purpose: a wrong confident answer is worse than falling through to search.
import { COUNTRIES, type Country } from './countries';
import { ELEMENTS, PLANETS, SCIENCE, elementNote } from './science';
import { ACRONYMS, LANGS, COMPANIES } from './tech';
import { EVENTS, PEOPLE } from './history';
import { ALL_FACTS, ZONES, type Fact } from './local';
import { GENERAL } from './general';
import { MORE, DICT, TRANS } from './more';
import { EXTRA } from './extra';

export interface WorldAnswer { human: string; expert: string; suggestions: string[] }

const STOP = new Set('whos hows wheres thats whens whys a an the is are was were of in on at to for do does did what whats which who whom how tell me about please can you could i my give explain define meaning mean means exactly really actually just so then this that there it its'.split(' '));
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\.(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s: string) => norm(s).split(' ').filter(Boolean);
const content = (s: string) => words(s).filter((w) => !STOP.has(w));
const title = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const bold = (s: string) => `**${s}**`;
const strip = (s: string) => s.replace(/\*\*/g, '').replace(/\n+/g, ' ');
const hasPhrase = (q: string, p: string) => (' ' + q + ' ').includes(' ' + p + ' ');
const SUG = ['Ask me something else', 'What can you do?'];
const out = (tag: string, human: string, suggestions = SUG): WorldAnswer => ({ human, expert: `${tag} // ${strip(human)}`, suggestions });

/* ---------- indexed lookups ---------- */
const countryIdx = new Map<string, Country>();
for (const c of COUNTRIES) { countryIdx.set(norm(c.name), c); for (const a of c.aliases) countryIdx.set(norm(a), c); }
const COUNTRY_KEYS = [...countryIdx.keys()].sort((a, b) => b.length - a.length);
function findCountry(q: string): Country | null {
  const q2 = q.replace(/^(?:the )/, '');
  const direct = countryIdx.get(q2);
  if (direct) return direct;
  for (const k of COUNTRY_KEYS) if (k.length > 3 && hasPhrase(q2, k)) return countryIdx.get(k)!;
  return null;
}
const nameOnly = (c: Country) => c.name;

const elByName = new Map(ELEMENTS.map((e) => [e.name.toLowerCase(), e] as const));
elByName.set('aluminum', ELEMENTS.find((e) => e.sym === 'Al')!);
elByName.set('caesium', ELEMENTS.find((e) => e.sym === 'Cs') || ELEMENTS[0]);
elByName.set('cesium', ELEMENTS.find((e) => e.sym === 'Cs') || ELEMENTS[0]);
elByName.set('sulphur', ELEMENTS.find((e) => e.sym === 'S')!);
const elBySym = new Map(ELEMENTS.map((e) => [e.sym.toLowerCase(), e] as const));

const acro = new Map(ACRONYMS.map((a) => [a.abbr.toLowerCase(), a] as const));
// Abbreviations that are also ordinary words: only answered with an explicit "stand for / full form" cue.
export const AMBIG = new Set(['it', 'is', 'us', 'or', 'as', 'to', 'in', 'on', 'at', 'be', 'me', 'my', 'we', 'so', 'do', 'go', 'no', 'up', 'if', 'an', 'am', 'he', 'id', 'pc', 'ui', 'ux', 'ai', 'ml', 'os', 'vr', 'ar', 'pr', 'hr']);

const langIdx = new Map<string, (typeof LANGS)[number]>();
for (const l of LANGS) { langIdx.set(norm(l.name), l); for (const a of l.aliases) langIdx.set(norm(a), l); }
const coIdx = new Map<string, (typeof COMPANIES)[number]>();
for (const c of COMPANIES) { coIdx.set(norm(c.name), c); for (const a of c.aliases) coIdx.set(norm(a), c); }
const peopleIdx = new Map<string, (typeof PEOPLE)[number]>();
for (const p of PEOPLE) { peopleIdx.set(norm(p.name), p); for (const a of p.aliases) peopleIdx.set(norm(a), p); }
const planetIdx = new Map(PLANETS.map((p) => [p.name.toLowerCase(), p] as const));

/* ---------- strict keyed facts (science, uganda, health, business, tech) ---------- */
const KEYED: Array<{ key: string; kw: string[]; f: Fact }> = [];
for (const f of [...SCIENCE, ...ALL_FACTS, ...GENERAL, ...MORE, ...EXTRA]) for (const k of f.keys) { const nk = norm(k); if (nk) KEYED.push({ key: nk, kw: content(nk), f }); }
KEYED.sort((a, b) => b.key.length - a.key.length);
function keyed(q: string): Fact | null {
  const qc = content(q);
  if (!qc.length || qc.length > 9) return null;
  let best: { f: Fact; score: number } | null = null;
  for (const { key, kw, f } of KEYED) {
    if (!hasPhrase(q, key) || !kw.length) continue;
    // the matched key must account for most of what the person asked
    const cov = kw.length / qc.length;
    if (cov < 0.75) continue;
    const score = cov * 10 + kw.length;
    if (!best || score > best.score) best = { f, score };
  }
  return best ? best.f : null;
}

/* ---------- time zones ---------- */
function zoneAnswer(q: string): WorldAnswer | null {
  const m = /^(?:what(?:s| is)? )?(?:the )?(?:current )?time (?:is it )?(?:now )?(?:in|at) (.+)$/.exec(q) || /^(.+?) time(?: now)?$/.exec(q);
  if (!m) return null;
  const place = m[1].replace(/^(?:the )/, '').trim();
  const z = ZONES.find(([n]) => n === place);
  if (!z) return null;
  const now = new Date(Date.now() + z[1] * 3600e3);
  const hh = now.getUTCHours(), mm = now.getUTCMinutes();
  const h12 = ((hh + 11) % 12) + 1;
  const t = `${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  const off = `UTC${z[1] >= 0 ? '+' : '−'}${Math.abs(Math.trunc(z[1]))}${z[1] % 1 ? ':30' : ''}`;
  return out('TIME', `In **${title(place)}** it is about **${t}** (${off}, ${z[2]}). Daylight saving can shift this by an hour in some places.`);
}
function zoneDiff(q: string): WorldAnswer | null {
  const m = /^(?:what(?:s| is)? )?(?:the )?time (?:difference|diff) (?:between )?(.+?) (?:and|to|vs) (.+)$/.exec(q);
  if (!m) return null;
  const a = ZONES.find(([n]) => n === m[1].trim()), b = ZONES.find(([n]) => n === m[2].trim());
  if (!a || !b) return null;
  const d = Math.abs(a[1] - b[1]);
  return out('TIME', `${title(m[1])} and ${title(m[2])} differ by about **${d} hour${d === 1 ? '' : 's'}** (standard time; daylight saving can change it).`);
}

/* ---------- countries ---------- */
function countryAnswer(q: string): WorldAnswer | null {
  let m: RegExpExecArray | null;
  const ask = (re: RegExp) => (m = re.exec(q));
  if (ask(/^(?:what )?(?:is )?(?:the )?capital(?: city)? (?:of )?(.+)$/) || ask(/^(.+?) capital(?: city)?$/)) {
    const c = findCountry(m![1]); if (c) return out('FACT', `The capital of ${bold(nameOnly(c))} is ${bold(c.capital)}.`);
  }
  if (ask(/^(?:what )?(?:is )?(?:the )?(?:national )?currency (?:of|in|used in) (.+)$/) || ask(/^(?:what )?currency does (.+?) (?:use|have)$/) || ask(/^(.+?) currency$/) || ask(/^(?:what )?money (?:does|do) (.+?) use$/)) {
    const c = findCountry(m![1]); if (c) return out('FACT', `${bold(nameOnly(c))} uses the ${bold(c.currency)}.`);
  }
  if (ask(/^(?:what )?(?:is )?(?:the )?(?:country |calling |dialing |dialling |phone |international )+(?:code|prefix) (?:of|for) (.+)$/) || ask(/^(.+?) (?:country |calling |dialing |dialling |phone )+(?:code|prefix)$/)) {
    const c = findCountry(m![1]); if (c) return out('FACT', `${bold(nameOnly(c))}’s international calling code is ${bold(c.code)}.`);
  }
  if (ask(/^(?:what )?(?:languages?|language) (?:is |are )?(?:spoken|used|official)? ?(?:in|of) (.+)$/) || ask(/^(?:what )?(?:languages?) do (?:they|people) speak in (.+)$/) || ask(/^(?:what )?(?:is )?(?:the )?official languages? of (.+)$/)) {
    const c = findCountry(m![1]); if (c) return out('FACT', `Main languages in ${bold(nameOnly(c))}: ${bold(c.languages)}.`);
  }
  if (ask(/^(?:which |what )?continent (?:is|does) (.+?)(?: belong to| in| on| located in| part of)?$/) || ask(/^(?:which |what )?continent (?:of|for) (.+)$/) || ask(/^(?:in )?which continent is (.+?)(?: in| located)?$/) || ask(/^where is (.+?)(?: located)?$/)) {
    const c = findCountry(m![1]); if (c) return out('FACT', `${bold(nameOnly(c))} is in ${bold(c.continent)}. Its capital is ${c.capital}.`);
  }
  if (ask(/^(?:tell me about|facts about|about|info on|information on|describe|country profile(?: of)?) (.+)$/) || ask(/^(?:what is|whats) (.+?) like$/)) {
    const c = findCountry(m![1]);
    if (c && norm(c.name) === norm(m![1]) || (c && c.aliases.map(norm).includes(norm(m![1])))) {
      return out('FACT', `**${c.name}**\n- Continent: ${c.continent}\n- Capital: ${c.capital}\n- Currency: ${c.currency}\n- Languages: ${c.languages}\n- Calling code: ${c.code}`, [`Currency of ${c.name}`, `Capital of ${c.name}`, 'Ask me something else']);
    }
  }
  return null;
}

/* ---------- elements & planets ---------- */
function scienceAnswer(q: string): WorldAnswer | null {
  let m: RegExpExecArray | null;
  const ask = (re: RegExp) => (m = re.exec(q));
  if (ask(/^(?:what )?(?:is )?(?:the )?(?:chemical )?symbol (?:of|for) (?:the )?(?:element )?(.+)$/) || ask(/^(.+?)(?: chemical)? symbol$/)) {
    const e = elByName.get(m![1].trim()); if (e) return out('FACT', `The chemical symbol for ${bold(e.name)} is ${bold(e.sym)}${elementNote(e)}. Atomic number ${e.n}.`);
  }
  if (ask(/^(?:what )?(?:is )?(?:the )?atomic number (?:of|for) (?:the )?(?:element )?(.+)$/) || ask(/^(.+?) atomic number$/)) {
    const key = m![1].trim(); const e = elByName.get(key) || elBySym.get(key);
    if (e) return out('FACT', `${bold(e.name)} (${e.sym}) has atomic number ${bold(String(e.n))}.`);
  }
  if (ask(/^(?:what |which )?(?:element|chemical element) (?:has |with |is )?(?:the )?(?:chemical )?symbol (.+)$/) || ask(/^(?:what )?(?:does |is )?(.+?) (?:stand for|mean) (?:in (?:the )?(?:periodic table|chemistry))$/)) {
    const e = elBySym.get(m![1].trim()); if (e) return out('FACT', `**${e.sym}** is the symbol for ${bold(e.name)} (atomic number ${e.n}).`);
  }
  if (ask(/^(?:what |which )?element (?:is )?(?:has )?(?:atomic )?(?:number|no) (\d{1,3})$/) || ask(/^(?:what )?(?:is )?element (?:number )?(\d{1,3})$/) || ask(/^(?:what )?element has (?:atomic number )?(\d{1,3})$/)) {
    const e = ELEMENTS[Number(m![1]) - 1]; if (e) return out('FACT', `Element ${e.n} is ${bold(e.name)} (symbol ${e.sym}).`);
  }
  if (ask(/^(?:what )?(?:is )?(?:the )?(\w+)(?:st|nd|rd|th)? planet from the sun$/)) { /* handled below */ }
  if (ask(/^(?:which |what )?planet (?:is )?(?:number |no )?(\d) (?:from the sun|in the solar system)$/) || ask(/^(?:what is )?planet number (\d)$/)) {
    const p = PLANETS.find((x) => x.order === Number(m![1])); if (p) return out('FACT', `Planet number ${p.order} from the Sun is ${bold(p.name)}.`);
  }
  if (ask(/^(?:tell me about|facts about|about|what is|whats|describe|info on) (?:the )?(?:planet )?(\w+)$/)) {
    const p = planetIdx.get(m![1]); if (p) return out('FACT', `**${p.name}** is planet number ${p.order} from the Sun: ${p.facts}`, ['How many planets are there?', 'Which planet is the largest?', 'Ask me something else']);
  }
  const bare = planetIdx.get(q.replace(/^(?:the )?(?:planet )?/, ''));
  if (bare) return out('FACT', `**${bare.name}** is planet number ${bare.order} from the Sun: ${bare.facts}`);
  const e = elByName.get(q.replace(/^(?:what is |tell me about |about )(?:the )?(?:element )?/, ''));
  if (e && /^(?:what is |tell me about |about |element )/.test(q)) return out('FACT', `**${e.name}** is element number ${e.n}, symbol ${bold(e.sym)}${elementNote(e)}.`);
  return null;
}

/* ---------- tech: acronyms, languages, companies ---------- */
function techAnswer(q: string): WorldAnswer | null {
  let m: RegExpExecArray | null;
  const ask = (re: RegExp) => (m = re.exec(q));
  // acronym expansion
  const cue = ask(/^(?:what )?(?:does )?(.+?) (?:stand for|stands for|mean)$/) || ask(/^(?:what )?(?:is )?(?:the )?(?:full form|full meaning|abbreviation|long form|expansion) (?:of|for) (.+)$/) || ask(/^(.+?) full form$/) || ask(/^(?:what )?(?:is )?(?:the )?meaning of (.+)$/);
  if (cue) {
    const a = acro.get(m![1].trim().replace(/\s+/g, ''));
    if (a) return out('FACT', `**${a.abbr}** stands for ${bold(a.full)}: ${a.meaning}.`);
  }
  // programming languages
  if (ask(/^(?:who )?(?:created|invented|made|designed|founded|developed|wrote) (?:the )?(?:programming )?(?:language )?(.+?)(?: (?:programming )?language)?$/) || ask(/^who is (?:the )?(?:creator|inventor|author|father) of (.+?)(?: (?:programming )?language)?$/) || ask(/^(.+?)(?: programming)?(?: language)? (?:creator|inventor|author)$/)) {
    const l = langIdx.get(m![1].trim()); if (l) return out('FACT', `${bold(l.name)} was created by ${bold(l.creator)} in ${bold(l.year)}.`);
  }
  if (ask(/^(?:when|what year|which year) (?:was|did) (.+?)(?: programming)?(?: language)? (?:created|invented|made|released|come out|first appear|start|begin|developed)$/)) {
    const l = langIdx.get(m![1].trim()); if (l) return out('FACT', `${bold(l.name)} first appeared in ${bold(l.year)}, created by ${l.creator}.`);
  }
  if (ask(/^(?:what )?(?:is |are )?(.+?)(?: programming)?(?: language)? (?:used for|good for|for)$/) || ask(/^(?:what )?(?:do|does|can) (?:people |you )?(?:use|do) (.+?)(?: programming)?(?: language)? for$/) || ask(/^what is (.+?) (?:programming )?language$/) || ask(/^(?:tell me about|about) (.+?) (?:programming )?language$/)) {
    const l = langIdx.get(m![1].trim()); if (l) return out('FACT', `${bold(l.name)} is a programming language by ${l.creator} (${l.year}), used for ${l.use}.`);
  }
  // companies / products
  if (ask(/^(?:when|what year|which year) (?:was|did) (.+?) (?:founded|started|created|launched|established|begin|released|come out|invented)$/)) {
    const c = coIdx.get(m![1].trim()); if (c) return out('FACT', `${bold(c.name)} dates from ${bold(c.year)} (${c.origin}). ${c.what}`);
  }
  if (ask(/^who (?:founded|started|created|made|owns|started) (.+)$/) || ask(/^(.+?) (?:founder|founders|creator)$/)) {
    const c = coIdx.get(m![1].trim()); if (c) return out('FACT', `${bold(c.name)}: ${c.origin}, ${c.year}. ${c.what}`);
  }
  if (ask(/^(?:what )?(?:does |do )(.+?) (?:do|make|sell|offer)$/) || ask(/^what (?:kind of )?(?:company )?is (.+)$/)) {
    const c = coIdx.get(m![1].trim()); if (c && (c.name.length > 3 || /company|what kind/.test(q))) return out('FACT', `${bold(c.name)} (${c.year}, ${c.origin}): ${c.what}`);
  }
  return null;
}

/* ---------- history ---------- */
function historyAnswer(q: string): WorldAnswer | null {
  const w = content(q);
  if (!w.length || w.length > 9) return null;
  let m: RegExpExecArray | null;
  const ask = (re: RegExp) => (m = re.exec(q));
  // people
  if (ask(/^(?:who )?(?:was|is|were) (.+)$/) || ask(/^(?:tell me about|about|who(?:s| is) )(.+)$/) || ask(/^(?:what )?(?:is )?(.+?) (?:known for|famous for)$/) || ask(/^what did (.+?) (?:do|invent|discover|create)$/)) {
    const key = m![1].trim().replace(/^(?:the )/, '');
    const p = peopleIdx.get(key);
    if (p) return out('FACT', `**${p.name}** (${p.lived}): ${p.known}.`, [`Who else is famous?`, 'Ask me something else']);
  }
  // events: whenever a question asks about an event's date or what it was
  const dateish = /\b(?:when|what year|which year|what date|date of|year of|what happened|start|started|begin|began|end|ended|happened|occur)\b/.test(q) || /^(?:what was|tell me about|about|what is|explain)\b/.test(q);
  if (dateish) {
    let best: { e: (typeof EVENTS)[number]; len: number } | null = null;
    for (const e of EVENTS) for (const k of e.keys) {
      const nk = norm(k);
      if (!/[a-z]/.test(nk)) continue; // pure year keys only support display
      if (hasPhrase(q, nk) && (!best || nk.length > best.len)) best = { e, len: nk.length };
    }
    if (best) {
      const kw = content(norm(best.e.keys.find((k) => hasPhrase(q, norm(k)))!)).length;
      if (kw / Math.max(1, w.length) >= 0.5) return out('FACT', `${best.e.what}.`);
    }
  }
  return null;
}

/* ---------- small maths ---------- */
function powerAnswer(q: string): WorldAnswer | null {
  let m = /^(?:what(?:s| is) )?(?:the )?(square|cube|square root) of (-?\d+(?:\.\d+)?)$/.exec(q);
  if (m) { const n = Number(m[2]); const v = m[1] === 'square' ? n * n : m[1] === 'cube' ? n ** 3 : Math.sqrt(n); if (Number.isFinite(v)) return out('MATH', `${m[1]} of ${n} = **${+v.toFixed(6)}**`); }
  m = /^(?:what(?:s| is) )?(-?\d+(?:\.\d+)?) (squared|cubed)$/.exec(q);
  if (m) { const n = Number(m[1]); const v = m[2] === 'squared' ? n * n : n ** 3; return out('MATH', `${n} ${m[2]} = **${+v.toFixed(6)}**`); }
  return null;
}

/* ---------- time zone by place ---------- */
function zoneQ(q: string): WorldAnswer | null {
  const m = /^(?:what )?time ?zone (?:is |does )?(.+?)(?: in| use| have| on)?$/.exec(q) || /^(.+?) time ?zone$/.exec(q);
  if (!m) return null;
  const z = ZONES.find(([n]) => n === m[1].replace(/^the /, '').trim());
  if (!z) return null;
  return out('FACT', `${title(z[0])} is on **${z[2]}**, UTC${z[1] >= 0 ? '+' : '−'}${Math.abs(Math.trunc(z[1]))}${z[1] % 1 ? ':30' : ''}.`);
}

/* ---------- dictionary & translation ---------- */
function dictAnswer(q: string): WorldAnswer | null {
  let m: RegExpExecArray | null;
  let word = '', wantSyn = false, wantDef = false;
  if ((m = /^(?:what(?:s| is) (?:the )?)?(?:synonyms?|another word|similar words?|other words?) (?:of|for) (?:the word )?(.+)$/.exec(q)) || (m = /^(?:give me )?(?:a )?synonyms? (?:for|of) (.+)$/.exec(q))) { word = m[1]; wantSyn = true; }
  else if ((m = /^(?:define|definition of|meaning of|what does) (?:the word )?(.+?)(?: mean)?$/.exec(q)) || (m = /^(?:what(?:s| is) )?(?:the )?(?:meaning|definition) of (?:the word )?(.+)$/.exec(q)) || (m = /^(.+?) (?:meaning|definition)$/.exec(q)) || (m = /^what (?:is )?(?:does )?(?:the word )?(.+?) mean$/.exec(q))) { word = m[1]; wantDef = true; }
  if (!word) return null;
  word = word.replace(/^(?:a |an |the |to )/, '').trim();
  const d = DICT[word];
  if (!d) return null;
  if (wantSyn) return out('FACT', `Words similar to **${word}**: ${d.syn || d.def}.`);
  void wantDef;
  return out('FACT', `**${word}** (${d.pos}): ${d.def}.${d.syn ? ` Similar: ${d.syn}.` : ''}`);
}

const LANG_ALIAS: Record<string, string> = { french: 'french', spanish: 'spanish', portuguese: 'portuguese', german: 'german', italian: 'italian', arabic: 'arabic', swahili: 'swahili', kiswahili: 'swahili', luganda: 'luganda', ganda: 'luganda', chinese: 'chinese', mandarin: 'chinese', japanese: 'japanese', hindi: 'hindi', kinyarwanda: 'kinyarwanda' };
function transAnswer(q: string): WorldAnswer | null {
  const m = /^(?:how (?:do|would) (?:you|i) say|how to say|what(?:s| is) |say |translate |translation of )?(?:the word |the phrase )?["']?(.+?)["']? (?:in|to|into) (\w+)(?: language)?$/.exec(q) || /^how (?:do|would) (?:you|i) say (.+?) in (\w+)$/.exec(q);
  if (!m) return null;
  const lang = LANG_ALIAS[m[2]];
  const phrase = m[1].replace(/^(?:the word |the phrase |say )/, '').trim();
  const row = TRANS[phrase];
  if (!lang || !row || !row[lang]) return null;
  return out('FACT', `“${phrase}” in ${title(lang)}: **${row[lang]}**`);
}

/* ---------- public API ---------- */
export function tryWorld(input: string): WorldAnswer | null {
  const q = norm(input).replace(/^(?:please )?(?:how (?:do|can|should|would|could|must) (?:i|we|you|one)|how (?:to|do you)|what(?:s| is) the way to|steps to|ways to|tips to) /, 'how to ');
  if (!q || q.length > 140) return null;
  const direct = zoneDiff(q) || zoneAnswer(q) || zoneQ(q) || powerAnswer(q) || transAnswer(q) || dictAnswer(q) || countryAnswer(q) || scienceAnswer(q) || techAnswer(q) || historyAnswer(q);
  if (direct) return direct;
  const f = keyed(q);
  return f ? out('FACT', f.a) : null;
}

export const WORLD_STATS = { countries: COUNTRIES.length, elements: ELEMENTS.length, acronyms: ACRONYMS.length, languages: LANGS.length, companies: COMPANIES.length, events: EVENTS.length, people: PEOPLE.length, facts: SCIENCE.length + ALL_FACTS.length + GENERAL.length + MORE.length + EXTRA.length, words: Object.keys(DICT).length };
