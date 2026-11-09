// src/utils/chatEngine/entities.ts
//
// Pulls structured facts out of what the visitor writes — which device, which brand, what is wrong,
// how urgent it is, how they feel — so later replies can be specific ("your Samsung phone") instead
// of generic. Pure functions, no browser APIs. Everything here is deterministic.

import { normalize } from './text';

export type DeviceType = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'pc';

export type SymptomId =
  | 'water'
  | 'no_power'
  | 'no_charge'
  | 'overheat'
  | 'black_screen'
  | 'cracked'
  | 'shutdown'
  | 'battery'
  | 'wifi'
  | 'noise'
  | 'storage'
  | 'audio'
  | 'slow';

export type ProjectKind = 'logo' | 'brand' | 'poster' | 'ui' | 'website' | 'embroidery' | 'convert';

export interface Entities {
  device?: DeviceType;
  brand?: string;
  model?: string;
  symptom?: SymptomId;
  project?: ProjectKind;
  urgent?: boolean;
  /** 0 calm … 3 very frustrated. Decays when the visitor is calm. */
  mood?: number;
  /** The visitor mentioned something they can't afford to lose (photos, work…). */
  dataAtRisk?: boolean;
}

const BRAND_DEVICE: Record<string, DeviceType> = {
  iphone: 'phone', samsung: 'phone', galaxy: 'phone', tecno: 'phone', infinix: 'phone', itel: 'phone',
  xiaomi: 'phone', redmi: 'phone', poco: 'phone', oppo: 'phone', realme: 'phone', vivo: 'phone',
  huawei: 'phone', honor: 'phone', nokia: 'phone', pixel: 'phone', oneplus: 'phone', motorola: 'phone',
  ipad: 'tablet', macbook: 'laptop', thinkpad: 'laptop', ideapad: 'laptop', chromebook: 'laptop',
  latitude: 'laptop', elitebook: 'laptop', probook: 'laptop', pavilion: 'laptop', inspiron: 'laptop',
  surface: 'laptop', alienware: 'laptop',
  hp: 'pc', dell: 'pc', lenovo: 'pc', asus: 'pc', acer: 'pc', toshiba: 'pc', msi: 'pc', apple: 'pc', lg: 'pc', sony: 'pc',
};

const DISPLAY_BRAND: Record<string, string> = {
  iphone: 'iPhone', ipad: 'iPad', macbook: 'MacBook', thinkpad: 'ThinkPad', ideapad: 'IdeaPad', hp: 'HP', lg: 'LG',
  msi: 'MSI', oneplus: 'OnePlus', itel: 'itel', tecno: 'Tecno', infinix: 'Infinix', redmi: 'Redmi', realme: 'realme',
};

const MODEL_RX =
  /\b(iphone ?\d{1,2}(?: ?(?:pro max|pro|plus|max|mini|e))?|ipad(?: ?(?:pro|air|mini))?(?: ?\d{1,2})?|samsung ?(?:galaxy ?)?[a-z]{1,2} ?\d{1,3}[a-z]?|galaxy ?[a-z]{1,2} ?\d{1,3}[a-z]?|redmi(?: note)? ?\d{1,2}[a-z]?|tecno ?(?:spark|camon|pova|phantom)[ a-z0-9]{0,8}|infinix ?(?:hot|note|zero|smart)[ a-z0-9]{0,8}|itel ?[a-z]{1,3} ?\d{1,3}|macbook(?: ?(?:air|pro))?|thinkpad ?[a-z]?\d{2,3}[a-z]?|(?:hp|dell|lenovo|asus|acer) ?[a-z]{2,10} ?[a-z0-9-]{0,6})\b/;

const DEVICE_RX: Array<[DeviceType, RegExp]> = [
  ['tablet', /\b(ipad|tablet|tab)\b/],
  ['laptop', /\b(laptop|notebook|macbook|chromebook|thinkpad|ultrabook)\b/],
  ['desktop', /\b(desktop|tower|gaming pc|workstation|system unit|cpu box)\b/],
  ['phone', /\b(phone|iphone|android|smartphone|mobile|cellphone|handset|cell)\b/],
  ['pc', /\b(pc|computer|machine)\b/],
];

/** Ordered: the first match wins, so risky / specific problems come before broad ones. */
const SYMPTOM_RX: Array<[SymptomId, RegExp]> = [
  ['water', /\b(water|liquid|spill\w*|wet|rain|soaked|drowned|coffee|juice|tea|dropped in|fell in)\b/],
  ['no_power', /\b(wont|will not|cant|cannot|doesnt|does not|not|never|stopped|refuses to|failed to)\b.{0,15}\b(turn(ing|s)? on|power(ing|s)? on|switch(ing)? on|start(ing|s|up)?|boot(ing|s)?|come on|coming on|wake|waking|power up)\b|\b(completely dead|totally dead|is dead|went dead|no power|bricked|wont start|dead phone|dead laptop)\b/],
  ['shutdown', /\b(boot ?loop|stuck on (the )?(logo|apple|boot|loading|startup|bios)|restart loop|reboot loop|keeps? (restarting|rebooting)|shut(s|ting)? (down|off)|turns? off (by itself|on its own|randomly|suddenly)|restarts? (by itself|randomly|suddenly|on its own)|random(ly)? (restart|shutdown|reboot)|blue screen|bsod|crash(es|ing)?)\b/],
  ['no_charge', /\b(not|wont|doesnt|isnt|cant|never|stopped|barely|slow(ly)?)\b.{0,14}\bcharg\w*|\bcharg\w* (port|issue|problem|stopped|slow\w*)|\bslow charg\w*|\bcharger\b.{0,20}\b(not|wont|doesnt)\b/],
  ['overheat', /\b(overheat\w*|over heat\w*|heat(s|ing)? up|gets? (very |too |so |really )?(hot|warm)|burning hot|running hot|too hot|very hot|is hot|fan (is |gets )?(loud|noisy|always|spinning)|loud fan|thermal throttl\w*)\b|\bhot\b/],
  ['black_screen', /\b(black screen|blank screen|no display|no picture|screen (is )?(black|blank|dark|off|white)|display (is )?(black|blank|dead)|nothing on (the )?screen|lines on (the )?screen|white screen|(green|pink|purple|vertical|horizontal) lines?|screen (is )?(flickering|glitching|flashing)|flicker\w*|backlight)\b/],
  ['cracked', /\b(crack\w*|shatter\w*|smash\w*|broken screen|screen (is )?broken|broke (my|the|its) screen|touch(screen)? (is )?(not|doesnt|wont|isnt)\b.{0,10}work\w*|ghost touch|touch (is )?(dead|unresponsive))\b/],
  ['battery', /\bbattery (drain\w*|dies|dying|life|health|percentage|jumps?|low|bad|weak|swell\w*|bulg\w*|puff\w*)|\bdrains? (fast|quickly)|\bdies (fast|quickly)|\b(dont|doesnt|not) hold(ing)? (a )?charge|\bloses? charge|\bswollen\b|\b(bulging|puffed up) battery\b/],
  ['wifi', /\b(wi-?fi|wireless|internet|network|bluetooth|hotspot|no signal|mobile data)\b.{0,25}\b(not|wont|doesnt|cant|isnt|fail\w*|drop\w*|slow|disconnect\w*|issue|problem|bad|poor)\b|\b(wi-?fi|bluetooth) (issue|problem|drops?|keeps? disconnecting)\b|\bno (wi-?fi|signal|network|internet)\b/],
  ['noise', /\b(beep\w*|click\w*|grind\w*|buzz\w*|rattl\w*|whin\w*|strange (noise|sound)|weird (noise|sound))\b/],
  ['storage', /\b(storage|memory|disk|space)\b.{0,10}\b(full|low|almost full|running out)|\bno (more )?(space|storage)\b|\bout of (space|storage)\b|\bdisk (is )?full\b/],
  ['audio', /\b(no sound|speakers?|mic(rophone)?|earpiece|audio|cant hear|cannot hear|crackl\w*)\b.{0,25}\b(not|wont|doesnt|cant|isnt|broken|dead|issue|problem|low|bad|crackl\w*)\b|\bno sound\b/],
  ['slow', /\b(slow|laggy|lag|lagging|sluggish|freez\w*|hang(s|ing)?|hanged|unresponsive|takes (forever|ages|long)|stuck)\b/],
];

const PROJECT_RX: Array<[ProjectKind, RegExp]> = [
  ['embroidery', /\b(embroider\w*|\.?jef|\.?dst|\.?pes|digiti[sz]\w*|name list)\b/],
  ['convert', /\b(vectori[sz]\w*|raster to vector|convert (my |a |the )?(image|logo|file|picture|photo)|trace (my |a |the )?logo|svg conversion|resize (my )?images?)\b/],
  ['logo', /\b(logo|logotype|emblem|monogram|wordmark)\b/],
  ['brand', /\b(brand(ing)?|brand identity|visual identity|brand guide\w*|style ?guide)\b/],
  ['poster', /\b(poster|flyer|flier|banner|brochure|leaflet|business card|invitation|billboard|social media (post|design|graphic)s?)\b/],
  ['ui', /\b(ui\/?ux|ux|ui design|app design|figma|prototype|wireframe|mockup|interface design|landing page design)\b/],
  ['website', /\b(website|web ?site|web app|webapp|web page|webpage|online store|e-?commerce|landing page|portfolio site|next\.?js site|build (me )?a site)\b/],
];

const URGENT_RX = /\b(urgent\w*|asap|as soon as possible|right now|immediately|today|tonight|emergency|rush|in a hurry|quickly|deadline)\b/;
const FRUSTRATED_RX = /\b(ugh+|argh+|damn|frustrat\w*|annoy\w*|so annoying|nothing works|nothing helps|im done|fed up|sick of|useless|terrible|worst|hate this|again and again|still not working|keeps happening|cant take it)\b|!{2,}|\b(why (is|does) (this|it) always)\b/;
const PANIC_RX = /\b(please help|help me|im worried|im scared|im stressed|panic\w*|desperate|dont know what to do|losing my mind)\b/;
const DATA_RX = /\b(photos?|pictures|videos?|files?|data|documents?|contacts|thesis|assignment|projects?|work|business|chats|whatsapp|memories)\b.{0,40}\b(lost|gone|inside|on it|on there|stuck|important|need|back ?up|recover\w*)\b|\b(important|precious|only copy)\b.{0,30}\b(photos?|files?|data|documents?|work)\b|\bno back ?up\b/;

/** Lower-case text with apostrophes removed, so "won't" and "wont" are the same word. */
export function flat(raw: string): string {
  return normalize(raw).replace(/'/g, '');
}

export function detectDevice(n: string): DeviceType | undefined {
  for (const [type, rx] of DEVICE_RX) if (rx.test(n)) {
    // "pc" is the weakest hint: a stronger brand hint (e.g. "samsung") should win over it.
    if (type !== 'pc') return type;
  }
  for (const w of n.split(' ')) {
    const t = BRAND_DEVICE[w];
    if (t && t !== 'pc') return t;
  }
  return DEVICE_RX[4][1].test(n) ? 'pc' : undefined;
}

export function detectBrand(n: string): string | undefined {
  for (const w of n.split(' ')) {
    if (BRAND_DEVICE[w]) return DISPLAY_BRAND[w] || w.charAt(0).toUpperCase() + w.slice(1);
  }
  return undefined;
}

export function detectModel(n: string): string | undefined {
  const m = MODEL_RX.exec(n);
  if (!m) return undefined;
  const s = m[1].trim();
  // Title-case words, keep digits as they are.
  return s.replace(/\b([a-z])([a-z]*)/g, (_, a: string, b: string) => a.toUpperCase() + b).replace(/\b(Hp|Lg|Msi|Ibm|Asus|Htc|Tcl)\b/g, (m) => m.toUpperCase()).replace('Iphone', 'iPhone').replace('Ipad', 'iPad').replace('Macbook', 'MacBook').slice(0, 40);
}

/** Every kind of project mentioned, in the order the visitor mentioned them ("a website and a logo" -> website, logo). */
export function detectProjects(n: string): ProjectKind[] {
  const found: Array<[number, ProjectKind]> = [];
  for (const [id, rx] of PROJECT_RX) {
    const m = rx.exec(n);
    if (m) found.push([m.index, id]);
  }
  // "website" also matches the loose landing-page pattern of "ui"; keep the one that appears first and drop exact duplicates.
  return found.sort((x, y) => x[0] - y[0]).map(([, id]) => id);
}

export function detectSymptom(n: string): SymptomId | undefined {
  for (const [id, rx] of SYMPTOM_RX) if (rx.test(n)) return id;
  return undefined;
}

export function detectProject(n: string): ProjectKind | undefined {
  for (const [id, rx] of PROJECT_RX) if (rx.test(n)) return id;
  return undefined;
}

export function isUrgent(n: string): boolean {
  return URGENT_RX.test(n);
}

export function frustration(raw: string, n: string): number {
  let s = 0;
  if (FRUSTRATED_RX.test(n) || /!{2,}/.test(raw)) s += 2;
  if (PANIC_RX.test(n)) s += 1;
  if (raw.length > 8 && raw === raw.toUpperCase() && /[A-Z]{4,}/.test(raw)) s += 1; // SHOUTING
  return Math.min(3, s);
}

export function dataAtRisk(n: string): boolean {
  return DATA_RX.test(n);
}

/** Merge what this message reveals into what we already knew. Never erases known facts. */
export function mergeEntities(prev: Entities | undefined, raw: string): Entities {
  const n = flat(raw);
  const out: Entities = { ...(prev || {}) };
  const dev = detectDevice(n);
  // A concrete device type replaces a vague "pc"; a vague one never replaces a concrete one.
  if (dev && (!out.device || out.device === 'pc' || dev !== 'pc')) {
    // Correcting the kind of device ("actually it's a laptop, not a phone") makes the old brand and model stale.
    if (out.device && out.device !== 'pc' && dev !== 'pc' && dev !== out.device) {
      delete out.brand;
      delete out.model;
    }
    out.device = dev;
  }
  const brand = detectBrand(n);
  const model = detectModel(n);
  // Correcting the brand ("actually it's a Samsung") drops the old brand's model unless a new one is given.
  if (brand && out.brand && brand.toLowerCase() !== out.brand.toLowerCase() && !model) delete out.model;
  if (brand) out.brand = brand;
  if (model) out.model = model;
  if (!out.device && brand) {
    const key = Object.keys(BRAND_DEVICE).find((k) => (DISPLAY_BRAND[k] || k).toLowerCase() === brand.toLowerCase());
    if (key) out.device = BRAND_DEVICE[key];
  }
  const sym = detectSymptom(n);
  if (sym) out.symptom = sym;
  const proj = detectProject(n);
  if (proj) out.project = proj;
  if (isUrgent(n)) out.urgent = true;
  if (dataAtRisk(n)) out.dataAtRisk = true;
  const f = frustration(raw, n);
  out.mood = f > 0 ? Math.max(out.mood || 0, f) : Math.max(0, (out.mood || 0) - 1);
  return out;
}

export function deviceLabel(e: Entities): string {
  // 'iPhone' / 'MacBook' already say what the device is; don't print 'iPhone phone'.
  const brandSaysDevice = !!e.brand && /(phone|pad|book|mac)$/i.test(e.brand);
  const base = e.model || [e.brand, brandSaysDevice ? '' : e.device && e.device !== 'pc' ? e.device : e.device === 'pc' ? 'computer' : ''].filter(Boolean).join(' ');
  return (base || 'device').trim();
}

export const SYMPTOM_LABEL: Record<SymptomId, string> = {
  water: 'liquid exposure',
  no_power: "won't turn on",
  no_charge: 'not charging',
  overheat: 'overheating',
  black_screen: 'display problem',
  cracked: 'cracked screen / touch problem',
  shutdown: 'restarting or shutting down',
  battery: 'battery problem',
  wifi: 'connection problem',
  noise: 'strange noises',
  storage: 'storage full',
  audio: 'sound problem',
  slow: 'slow or freezing',
};
