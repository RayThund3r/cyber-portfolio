// src/utils/chatEngine/slang.ts
//
// Turns texting-style input into plain words BEFORE the engine tries to understand it:
//   "hw mch for scren repar"          -> "how much for screen repair"
//   "laptop heatin up n shutin down"  -> "laptop heating up and shutting down"
//   "wat is ur portfolio"             -> "what is your portfolio"
// Conservative on purpose: only whole words from a fixed list are replaced, so real words, names and
// pasted text are never "corrected" into something else. Pure function, no browser APIs.

const WORDS: Record<string, string> = {
  hw: 'how', mch: 'much', wat: 'what', wht: 'what', wut: 'what', whats: "what's", ur: 'your', u: 'you', r: 'are',
  pls: 'please', plz: 'please', plss: 'please', thx: 'thanks', thnx: 'thanks', thanx: 'thanks', ty: 'thanks',
  cuz: 'because', bcz: 'because', coz: 'because', bcoz: 'because', abt: 'about', rn: 'right now',
  tmrw: 'tomorrow', tmr: 'tomorrow', tmw: 'tomorrow', wanna: 'want to', gonna: 'going to', gotta: 'got to',
  dunno: 'do not know', idk: 'i do not know', ya: 'you', yah: 'yes', yeah: 'yes', yep: 'yes', yup: 'yes',
  nope: 'no', nah: 'no', ok: 'ok', k: 'ok', okk: 'ok', okey: 'ok', okie: 'ok', msg: 'message', info: 'information',
  pic: 'picture', pics: 'pictures', doc: 'document', docs: 'documents', diff: 'difference', approx: 'approximately',
  asap: 'as soon as possible', btw: 'by the way', fyi: 'for your information', lemme: 'let me', gimme: 'give me',
  // device words people shorten or misspell
  scren: 'screen', scrn: 'screen', screan: 'screen', sreen: 'screen', repar: 'repair', repiar: 'repair', repiar_: 'repair',
  bateri: 'battery', batery: 'battery', battrey: 'battery', chrager: 'charger', chargr: 'charger', charge_: 'charge',
  labtop: 'laptop', lap: 'laptop', leptop: 'laptop', compter: 'computer', computr: 'computer', phne: 'phone', fone: 'phone',
  mobil: 'mobile', moble: 'mobile', wifi_: 'wifi', wi_fi: 'wifi', passwrd: 'password', pasword: 'password',
  servise: 'service', sevice: 'service', servics: 'services', websit: 'website', webiste: 'website', wesite: 'website',
  porfolio: 'portfolio', portfolo: 'portfolio', portofolio: 'portfolio', desing: 'design', desgin: 'design',
  prise: 'price', prce: 'price', cost_: 'cost', quote_: 'quote', contct: 'contact', conact: 'contact',
};

/** Words that lost their "g" ("heatin"), or lost a doubled consonant too ("shutin" -> "shutting"). */
const ING = new Set(
  (
    'heat cool run charg work load freez crash restart reboot flicker blink buzz lag hang drain die beep vibrat glitch ' +
    'look try need want do go get make fix repair build design order pay send talk help think ask turn show stop start ' +
    'open clos updat install download upload connect disconnect freez overheat slow shak ring click scroll typ print ' +
    'scan stream play watch hear see feel mean com leav stay wait hav be say tell call text'
  ).split(' ')
);
const DOUBLED: Record<string, string> = {
  shutin: 'shutting', gettin: 'getting', settin: 'setting', hittin: 'hitting', sittin: 'sitting', cuttin: 'cutting',
  putin: 'putting', runnin: 'running', stoppin: 'stopping', droppin: 'dropping', plugin: 'plugging', pluggin: 'plugging',
  swipin: 'swiping', beggin: 'beginning', beginin: 'beginning', rebootin: 'rebooting', stuckin: 'sticking',
};
const IN_ENDING_EXCLUDE = new Set(['login', 'plugin', 'begin', 'main', 'again', 'domain', 'admin', 'mobilein', 'within', 'basin', 'cabin', 'robin', 'satin', 'resin', 'pin', 'bin', 'win', 'thin', 'skin', 'chin', 'fin', 'gin', 'tin', 'sin', 'kin', 'lin']);

function fixIn(word: string): string | null {
  const w = word.toLowerCase();
  if (DOUBLED[w] && w !== 'plugin') return DOUBLED[w];
  if (w.length < 5 || !w.endsWith('in') || IN_ENDING_EXCLUDE.has(w)) return null;
  const stem = w.slice(0, -2);
  // charg/updat/clos drop an "e": chargin -> charging
  if (ING.has(stem)) return stem + 'ing';
  if (ING.has(stem + 'e')) return stem + 'ing';
  return null;
}

export interface SlangResult {
  text: string;
  changed: boolean;
}

export function normalizeSlang(raw: string): SlangResult {
  if (!raw || raw.length > 600) return { text: raw, changed: false };
  let changed = false;
  let s = raw;

  // "heatin'" / "shutin'" with a trailing apostrophe
  s = s.replace(/\b([A-Za-z]{3,})in['’]/g, (m, stem) => {
    const f = fixIn(stem + 'in');
    if (f) {
      changed = true;
      return f;
    }
    return m;
  });
  // "up n down", "wifi n bluetooth": a lone n between words means "and"
  s = s.replace(/(?<=[A-Za-z0-9]) n (?=[A-Za-z0-9])/g, () => {
    changed = true;
    return ' and ';
  });
  // Only STANDALONE words are touched: never part of "5k", "3k-5k", "r2", an email, a URL or a path.
  s = s.replace(/(?<![\w@./:#-])[A-Za-z]+(?![\w@/:#-]|\.\w)/g, (word) => {
    const lower = word.toLowerCase();
    // "R programming", "Vitamin C", "U2": a capitalised short word is a name, not texting.
    if (word.length <= 2 && word !== lower) return word;
    const mapped = WORDS[lower];
    if (mapped !== undefined && mapped !== lower) {
      changed = true;
      return mapped;
    }
    const ing = fixIn(word);
    if (ing) {
      changed = true;
      return ing;
    }
    return word;
  });
  return { text: s, changed };
}
