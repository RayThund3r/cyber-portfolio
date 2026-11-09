// src/utils/chatEngine/reasoner.ts
//
// The reasoning layer. No model, no network: small, explicit, inspectable rules that make the assistant
// *think about what was said* instead of only matching keywords.
//
//   cleanup      stripLead()        "ok and how long?" -> "how long?"         (conversational filler)
//                rewriteNegation()  "I don't want a website, just a logo" -> "I need a logo"
//   reasoning    evidence           "it charges on another cable"  -> what that rules in / out
//                estimate           "if I drop it Monday, when is it ready?" -> a date range, with caveats
//                facts              "how long and how much for a battery?" -> every part answered
//                advice             "which should I pick for my salon?" / "which is better for me?"
//                vague              "it's broken" -> ask the right clarifying question
//                statement          "I have an HP laptop" -> acknowledge, remember, ask what's wrong
//                nextStep           "what now?" / "and then?" -> the actual next step
//
// Rules for this file: never invent prices, hours, warranty or policies; say "points to", not "is",
// when evidence is circumstantial; every reply offers a way forward (a chip) and a way out (the owner).

import type { ChatCard, PersonaMode, SessionMemory, SiteCommand, TopicDomain } from './types';
import { SERVICES } from '@/data/servicesData';
import type { DialogueState, LastAnswer } from './dialogue';
import { deviceLabel, detectBrand, detectDevice, detectModel, detectProject, detectSymptom, flat, mergeEntities } from './entities';
import { comparisonFromAnswer } from './compare';
import { termReply, tryGlossary } from './glossary';
import { tryProjectQA } from './projectsQA';

export interface ReasonReply {
  human: string;
  expert: string;
  suggestions?: string[];
  topic?: TopicDomain;
  /** Keep the previous topic so a bare "yes" still continues what we were discussing. */
  keepTopic?: boolean;
  /** Plain-language "how I got there", shown by "why?" */
  trace?: string[];
  /** Tappable cards shown under the reply. */
  cards?: ChatCard[];
  /** Facts to remember for later turns (merged into the chat memory). */
  learn?: Record<string, any>;
  /** A site action the visitor asked for in words ("open the second one"). */
  command?: SiteCommand;
  /** What to remember as "the last answer", so follow-ups like "and then?" continue it. */
  last?: LastAnswer;
}

const INTERROGATIVE = '(?:and then|then|what|how|when|where|why|which|who|can|could|do|does|is|are|will|would|should|any|is there)';
const LEAD = new RegExp(`^(?:(?:ok|okay|alright|right|so|well|then|and|also|but|hmm+|um+|uh+)[,\\s]+)+(?=${INTERROGATIVE}\\b)`, 'i');

/** Drop conversational filler in front of a question so the matchers see the question itself. */
export function stripLead(raw: string): string {
  const out = raw.replace(LEAD, '');
  return out.length >= 2 ? out : raw;
}

/* ------------------------------------------------------------------ negation */

const POSITIVE = (y: string) => !!(detectProject(flat(y)) || detectDevice(flat(y)) || detectSymptom(flat(y)));
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const article = (y: string) => (/^(a|an|the|my|some|new)\b/i.test(y) ? y : /^[aeiou]/i.test(y) ? `an ${y}` : `a ${y}`);

/**
 * "I don't want a website, just a logo" / "I need a logo, not a website" / "no website, only a logo"
 * mean the OPPOSITE of what keyword matching sees. Rewrites them to the positive request. Conservative:
 * only fires when the part that is wanted is clearly a project, device or fault.
 */
export function rewriteNegation(raw: string): { text: string; changed: boolean } {
  const s = raw.trim().replace(/[’`]/g, "'").replace(/\s+/g, ' ');
  const lower = s.toLowerCase().replace(/[.!?]+$/g, '');
  const neg = "(?:i )?(?:do ?n't|dont|do not|no longer|never|don't)";
  let m = new RegExp(`^${neg} (?:want|need|require|looking for|care for|like) (?:a |an |the |any )?(.{1,40}?)[,;]?\\s*(?:,| but| though)?\\s*(?:just|only|rather|instead|but i (?:want|need)|i (?:want|need))\\s+(?:a |an |the )?(.{1,40})$`).exec(lower);
  if (!m) m = /^no (.{1,30}?),?\s+(?:just|only)\s+(?:a |an |the )?(.{1,40})$/.exec(lower);
  if (m && words(m[1]) <= 5 && words(m[2]) <= 6 && POSITIVE(m[2])) return { text: `I need ${article(m[2].trim())}`, changed: true };

  const m2 = /^(?:i )?(?:want|need|looking for|would like) (?:a |an |the )?(.{1,40}?)[,;]?\s*(?:but )?(?:not|rather than|instead of|no)\s+(?:a |an |the )?(.{1,30})$/.exec(lower);
  if (m2 && words(m2[1]) <= 6 && words(m2[2]) <= 4 && POSITIVE(m2[1])) return { text: `I need ${article(m2[1].trim())}`, changed: true };
  return { text: raw, changed: false };
}

/* ------------------------------------------------------------------ helpers */

const lc = (raw: string) => raw.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9'\s/+.-]/g, ' ').replace(/\s+/g, ' ').trim();
const t = (mode: PersonaMode, h: string, e: string) => (mode === 'EXPERT' ? e : h);
const reply = (human: string, expert: string, extra: Partial<ReasonReply> = {}): ReasonReply => ({ human, expert, ...extra });

type Service = 'hardware' | 'design' | 'web' | 'assets';
const SERVICE_IDX: Record<Service, number> = { hardware: 0, design: 1, web: 2, assets: 3 };
const SERVICE_NOUN: Record<Service, string> = { hardware: 'repairs', design: 'design work', web: 'web and UI work', assets: 'file conversion and embroidery files' };

function serviceOf(n: string, dlg?: DialogueState): Service | undefined {
  if (/\b(embroider\w*|jef|vectori[sz]\w*|convert\w*|digiti[sz]\w*)\b/.test(n)) return 'assets';
  if (/\b(website|web ?site|web app|web page|ui|ux|figma|landing page|online store)\b/.test(n)) return 'web';
  if (/\b(logo|brand\w*|poster|flyer|banner|business card|graphic\w*|design\w*)\b/.test(n)) return 'design';
  if (/\b(phone|iphone|laptop|pc|computer|desktop|tablet|screen|battery|charger|repair\w*|fix\w*|device|motherboard|ssd|ram)\b/.test(n)) return 'hardware';
  if (dlg?.ent.device) return 'hardware';
  const k = dlg?.last?.service;
  if (k === 'hardware') return 'hardware';
  if (k === 'design') return 'design';
  if (k === 'ui') return 'web';
  if (k === 'assets') return 'assets';
  return undefined;
}

/** [min, max] days for a service, or null when the timeline depends on scope. */
function daysFor(s: Service): [number, number] | null {
  const tl = SERVICES[SERVICE_IDX[s]].timeline;
  const m = /(\d+)\s*-\s*(\d+)\s*Hours/i.exec(tl);
  if (m) return [Math.max(1, Math.round(Number(m[1]) / 24)), Math.max(1, Math.round(Number(m[2]) / 24))];
  const h = /^(\d+)\s*Hours?$/i.exec(tl);
  if (h) return [Math.max(1, Math.round(Number(h[1]) / 24)), Math.max(1, Math.round(Number(h[1]) / 24))];
  const d = /(\d+)\s*-\s*(\d+)\s*Days/i.exec(tl);
  if (d) return [Number(d[1]), Number(d[2])];
  return null;
}

/* ------------------------------------------------------------------ evidence */

interface Evidence {
  rx: RegExp;
  /** Only applies when the conversation is (or could be) about one of these. */
  human: string;
  expert: string;
  chips: string[];
  trace: string[];
}

const EVIDENCE: Evidence[] = [
  {
    rx: /\b(charg\w*|work\w*|power\w*)\b.{0,30}\b(with|on|using|from)\b.{0,12}\b(another|a different|different|other|my (friend'?s|brother'?s|sister'?s)|a new|spare)\b.{0,12}\b(cable|charger|adapter|adaptor|plug|socket|outlet|wire)\b|\b(another|different|other|spare|new)\b.{0,10}\b(cable|charger|adapter|adaptor|plug|socket|outlet)\b.{0,25}\b(works?|worked|charges|charged|fixed|helped|solved)\b/,
    human: "That's a useful clue: if it charges with another cable or charger, the **phone/laptop itself is probably fine** — the original cable, charger or wall socket was the weak link. 🔌\n\nWhat I'd do: retire the old one (frayed or bent cables can overheat), buy a quality replacement that matches the device's rating, and keep an eye on it. If it ever stops charging on **every** cable, tell me and we'll look at the charging port and battery instead.",
    expert: 'EVIDENCE // Charges on alternate cable/charger -> accessory fault (not port/battery). ACTION // Replace accessory. Re-test; if all accessories fail -> port/battery.',
    chips: ["It still won't charge", 'Book a repair', 'Send this to the owner'],
    trace: ['You said it charges with a different cable or charger.', 'A fault in the device would show up on every cable, so the accessory is the likely culprit.'],
  },
  {
    rx: /\b(still|even with|doesn'?t|does not|won'?t|will not|not)\b.{0,40}\b(charg\w*|power\w*)\b.{0,40}\b(another|different|new|any|every|all|other)\b.{0,12}\b(cable|charger|adapter|adaptor|plug|socket|outlet)s?\b|\b(tried|used)\b.{0,15}\b(different|another|several|three|two|many|all|new)\b.{0,12}\b(cables?|chargers?)\b.{0,30}\b(still|same|nothing|no luck|doesn'?t|won'?t)\b/,
    human: "Good test — that **rules out the cable and charger**. So the fault is in the device: most often the **charging port** (lint or a loose/damaged connector), then the **battery**, then the charging circuit on the board. 🔍\n\nSafe things to try: power it off, then look into the port with a torch and gently clear lint with a wooden or plastic toothpick (never metal). Try a different wall socket once. If neither helps, it needs a hands-on check — port and battery replacements are common, quick jobs.",
    expert: 'EVIDENCE // Fails on all accessories -> device-side. CAUSES // 1) port debris/damage 2) battery 3) charge IC. ACTION // Power off, inspect port (non-metal), re-test; else dispatch.',
    chips: ['Book a repair', 'Send this to the owner', 'Why do you say that?'],
    trace: ['It does not charge even with other cables or chargers.', 'That removes the accessories from the list, so the port, battery or board is left.'],
  },
  {
    rx: /\b(works?|working|runs?|fine|ok|okay|normal)\b.{0,25}\b(when|while|only when|if)\b.{0,15}\b(plugged|charging|on charge|connected to (power|the charger|mains))\b.{0,40}\b(not|doesn'?t|won'?t|dies?|off|shuts?)\b.{0,20}\b(battery|unplugged)\b|\b(only (works?|turns? on|runs?|stays? on)|dies?|shuts? (down|off)) (when|as soon as|the moment|once) (i )?(unplug\w*|disconnect\w*|remove\w*)\b/,
    human: "Running fine on the charger but dying the moment you unplug it points strongly to a **worn-out or failing battery** — the charger is supplying the power while the battery isn't holding any. 🔋\n\nIt's usually a straightforward replacement (the battery is the part that wears out first). I'd avoid leaving a swollen or very hot battery plugged in; if the case is bulging, stop using it and tell the owner right away.",
    expert: 'EVIDENCE // Runs on AC, dies on battery -> battery cell wear. ACTION // Battery replacement. SAFETY // Bulging cell: stop use.',
    chips: ['Book a repair', 'Send this to the owner', 'Why do you say that?'],
    trace: ['It only stays on while plugged in.', 'That means the power supply works but the battery no longer holds charge.'],
  },
  {
    rx: /\b(external|another|second|different|other)\b.{0,12}\b(monitor|screen|display|tv|projector)\b.{0,40}\b(works?|worked|shows?|showing|fine|ok|okay|picture|image)\b|\b(works?|shows?|fine)\b.{0,20}\b(on|with|via|through)\b.{0,10}\b(an? )?(external|another|different)\b.{0,10}\b(monitor|screen|display|tv)\b|\b(hdmi|vga)\b.{0,30}\b(works?|shows?|fine|ok)\b/,
    human: "If the picture shows up on an **external monitor** but the built-in screen stays black, the computer's graphics and system are alive — the problem is the **laptop's own display panel, its cable, or the backlight**, not the motherboard. 🖥️\n\nThat's good news: those are repairable parts. Try a gentle brightness-up key and shine a torch at an angle onto the black screen — a faint image means a backlight fault. Then it's a hands-on job.",
    expert: 'EVIDENCE // External display OK, internal blank -> panel/cable/backlight. GPU/board likely OK. ACTION // Torch test for backlight; dispatch.',
    chips: ['Book a repair', 'Send this to the owner', 'Why do you say that?'],
    trace: ['The picture appears on a second display.', 'So the graphics output works and the built-in screen path is the problem.'],
  },
  {
    rx: /\b(works?|working|fine|ok|okay|opens?|reads?|detected|recogni[sz]ed|shows?)\b.{0,30}\b(on|in|with)\b.{0,10}\b(another|a different|different|other|my (friend'?s|brother'?s)|second)\b.{0,12}\b(pc|computer|laptop|phone|port|usb|machine)\b/,
    human: "If it works on **another computer or port**, the device itself is fine — the fault is on the **first machine's side**: that USB port, a driver, or a setting. 🔧\n\nTry a different port on the original machine, restart it, and check that the device shows up in Device Manager (Windows) or System Information (Mac). If the port is dead on every device you plug in, that's a hardware repair on that machine.",
    expert: 'EVIDENCE // Device OK on alt host -> original host port/driver. ACTION // Alt port, reboot, driver check; port repair if dead.',
    chips: ['Fix my computer', 'Book a repair', 'Send this to the owner'],
    trace: ['It works on a different machine or port.', 'So the device is healthy and the original host is the suspect.'],
  },
  {
    rx: /\b(safe mode|clean boot|new (user|profile|account)|another (user|account|profile))\b.{0,40}\b(works?|fine|ok|okay|fast|faster|no (problem|issue|crash)|normal)\b|\b(works?|fine|ok|fast|normal)\b.{0,30}\b(in|on|with|under)\b.{0,6}\b(safe mode|a new (user|profile|account))\b/,
    human: "Fine in **safe mode or a new user profile** but not normally means the hardware is probably healthy — the culprit is **software**: a startup program, a driver, or a corrupted profile. 💡\n\nNext: uninstall recent programs/drivers, disable startup apps one by one, and run a full malware scan. If you'd rather not dig, a clean reinstall of the OS is the reliable fix (back up first).",
    expert: 'EVIDENCE // OK in safe mode/new profile -> software/driver/profile corruption. ACTION // Remove recent installs, disable startup, malware scan, or clean OS install (backup first).',
    chips: ['Book a repair', 'Back up my files first', 'Send this to the owner'],
    trace: ['It behaves in safe mode or a fresh profile.', 'Safe mode loads minimal software, so the fault is in what normally loads.'],
  },
  {
    rx: /\b(i )?(already|have|ve)?\s*(tried|did|done)\b.{0,20}\b(restart\w*|reboot\w*|turning it off and on|power cycl\w*|hard reset|force restart)\b|\b(restart\w*|reboot\w*|force restart|hard reset)\b.{0,25}\b(didn'?t|did not|doesn'?t|does not|no|not)\b.{0,12}\b(help|work|fix|change)\b/,
    human: "Thanks — a restart that changes nothing **rules out a one-off software glitch**, which narrows things down. 🧩 The problem is more likely something persistent: a failing component, corrupted system files or a bad update.\n\nTell me the **device** and **exactly what it does** (won't turn on, black screen, restarts…) and I'll walk through the likely causes in order.",
    expert: 'EVIDENCE // Restart ineffective -> persistent fault (hardware/OS corruption), not transient glitch. REQUEST // Device + symptom.',
    chips: ['My phone is broken', 'My laptop is broken', 'My PC won’t start', 'Send this to the owner'],
    trace: ['A restart did not change the behaviour.', 'Transient glitches usually clear on restart, so this is likely persistent.'],
  },
  {
    rx: /\b(dried|drying|left it|let it dry|waited|rice)\b.{0,40}\b(days?|hours?|night|week|weeks)\b.{0,50}\b(still|but|and)\b.{0,25}\b(won'?t|doesn'?t|not|no|dead)\b.{0,15}\b(turn on|power on|start|work|charge|boot|switch on)\b/,
    human: "Drying it for days and it **still won't switch on** suggests the water has left **corrosion or a short** on the board — that doesn't dry away. 💧 Please **stop trying to power or charge it** (each attempt can burn more components).\n\nA hands-on clean-up (opening it, cleaning the board, testing components) gives it the best chance, and the sooner the better. If there's data on it, tell the owner so it's handled carefully.",
    expert: 'EVIDENCE // Dried, still dead -> corrosion/short. ACTION // Stop power attempts. Board-level cleaning; flag data.',
    chips: ['Book a repair', 'Send this to the owner', 'Can my data be saved?'],
    trace: ['It was dried for a long time and still does not work.', 'Moisture damage leaves corrosion that drying cannot remove.'],
  },
  {
    rx: /\b(fan|fans)\b.{0,30}\b(loud|noisy|spins? fast|screaming|roaring|always (on|running))\b.{0,60}\b(hot|heat\w*|warm|burning)\b|\b(hot|heat\w*|warm)\b.{0,40}\b(fan|fans)\b.{0,30}\b(loud|noisy|spins? fast|screaming|roaring|always (on|running))\b/,
    human: "A loud fan **plus** heat while the laptop otherwise runs means it's struggling to shed heat: usually **dust-clogged vents or heatsink**, then **dried thermal paste**. 🌡️ That's maintenance, not a failure — cleaning and re-pasting often drops temperatures dramatically.\n\nUntil then: use it on a hard flat surface (not a bed), and compressed air through the vents (power off) can help. If it shuts itself off, don't keep forcing it.",
    expert: 'EVIDENCE // Loud fan + heat, stable otherwise -> airflow restriction / thermal paste. ACTION // Clean vents, repaste.',
    chips: ['Book a repair', 'How long will it take?', 'Send this to the owner'],
    trace: ['The fan is loud and the machine is hot but still running.', 'That pattern is a cooling problem rather than a failed part.'],
  },
];

function evidence(n: string, mode: PersonaMode, dlg: DialogueState): ReasonReply | null {
  // Questions ("does it matter if…?") and very long messages are left to the other layers.
  if (n.length > 260) return null;
  for (const e of EVIDENCE) {
    if (e.rx.test(n)) return reply(t(mode, e.human, e.expert), e.expert, { suggestions: e.chips, topic: 'HARDWARE_REPAIR', trace: e.trace });
  }
  void dlg;
  return null;
}

/* ------------------------------------------------------------------ date estimates */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_ALIAS: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };

function dayOffset(n: string, now: Date): { offset: number; label: string } | null {
  if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(n)) return { offset: 0, label: 'today' };
  if (/\btomorrow\b/.test(n)) return { offset: 1, label: 'tomorrow' };
  if (/\bnext week\b/.test(n)) return { offset: ((8 - now.getDay()) % 7) || 7, label: 'next Monday' };
  if (/\b(this )?weekend\b/.test(n)) return { offset: (6 - now.getDay() + 7) % 7, label: 'Saturday' };
  const m = /\b(next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thurs?|fri|sat)\b/.exec(n);
  if (m) {
    const idx = WEEKDAYS.indexOf(m[2]) >= 0 ? WEEKDAYS.indexOf(m[2]) : DAY_ALIAS[m[2]];
    let off = (idx - now.getDay() + 7) % 7;
    if (m[1] && off < 7) off = off === 0 ? 7 : off;
    return { offset: off, label: WEEKDAYS[idx][0].toUpperCase() + WEEKDAYS[idx].slice(1) };
  }
  return null;
}

const fmtDay = (d: Date) => `${WEEKDAYS[d.getDay()][0].toUpperCase()}${WEEKDAYS[d.getDay()].slice(1)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

function estimate(n: string, mode: PersonaMode, dlg: DialogueState, now: Date): ReasonReply | null {
  const asksWhen = /\b(when|how soon|what day|by when|will it be|would it be|can i (get|have|collect|pick)|be ready|ready by|done by|back by|finished by)\b/.test(n) && /\b(ready|done|finished|back|complete|completed|collect|pick(ed)? ?up|get it back|have it)\b/.test(n);
  if (!asksWhen) return null;
  const when = dayOffset(n, now);
  if (!when) return null;
  const svc = serviceOf(n, dlg);
  if (!svc) {
    return reply(
      t(mode, "I can estimate that — is it a **repair**, a **design** (logo, poster…), a **website**, or a **file conversion**? Each has its own usual turnaround.", 'ESTIMATE // Need service type: repair | design | web | assets.'),
      'ESTIMATE // Need service type.',
      { suggestions: ['A repair', 'A logo or poster', 'A website', 'A file conversion'], keepTopic: true }
    );
  }
  const range = daysFor(svc);
  const tl = SERVICES[SERVICE_IDX[svc]].timeline;
  if (!range) {
    return reply(
      t(mode, `For ${SERVICE_NOUN[svc]} the time depends on the **scope** (pages, features, revisions), so I can't put a date on it. 🗓️ If you send the details, the owner can give you a real delivery date. Starting ${when.label} won't change that.`, `ESTIMATE // ${tl}. Date not computable.`),
      'ESTIMATE // Scope-dependent.',
      { suggestions: ['Send this to the owner', 'Build me a website', 'Get a quote'], topic: 'WEB_DEV', keepTopic: true }
    );
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + when.offset);
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() + range[0]);
  const to = new Date(start.getFullYear(), start.getMonth(), start.getDate() + range[1]);
  const span = range[0] === range[1] ? fmtDay(from) : `${fmtDay(from)} to ${fmtDay(to)}`;
  const trace = [`Service: ${SERVICES[SERVICE_IDX[svc]].title}`, `Usual turnaround: ${tl}`, `Start: ${fmtDay(start)}`, `Range: ${span}`];
  return reply(
    t(mode, `If it's with the owner on **${when.offset <= 1 || /^next/i.test(when.label) ? `${when.label}, ${fmtDay(start)}` : fmtDay(start)}**, ${SERVICE_NOUN[svc]} usually take **${tl}**, so think **${span}**. 🗓️\n\nThat's the typical range, **not a promise**: a part that has to be ordered, the queue, and what the owner finds on inspection can all change it. I also don't know the working days, so ask the owner to confirm the date when you send the details.`, `ETA // ${span} (typical ${tl}). Not guaranteed; owner confirms.`),
    `ETA // ${span}.`,
    { suggestions: ['Book a repair', 'Send this to the owner', 'What could delay it?'], keepTopic: true, trace }
  );
}

/* ------------------------------------------------------------------ several questions at once */

type FactId = 'time' | 'price' | 'warranty' | 'payment' | 'visit' | 'location' | 'hours';
const FACT_RX: Array<[FactId, RegExp]> = [
  ['time', /\b(how long|how many (days|hours|weeks)|how soon|how fast|how quick(ly)?|turnaround|time ?frame|timeline|when (will|would|can) (it|i|they|you)|ready (by|in))\b/],
  ['price', /\b(how much|price|prices|pricing|cost|costs|rate|rates|fee|fees|quote|expensive|cheap)\b/],
  ['warranty', /\b(warranty|guarantee|guaranteed|insured|insurance)\b/],
  ['payment', /\b(pay|payment|payments|mobile money|momo|cash|deposit|installments?|instalments?|invoice)\b/],
  ['visit', /\b(come to (me|my)|home visit|house call|on ?site|at my (house|home|office|shop)|deliver\w*|pick ?up|pickup|collect\w*|courier|drop ?off)\b/],
  ['location', /\b(where are you|where is (it|the shop)|location|address|based|located)\b/],
  ['hours', /\b(opening hours|open on|are you open|working hours|what time (do|are)|closing time|business hours|open (today|tomorrow|now))\b/],
];

function factLines(ids: FactId[], n: string, dlg: DialogueState, mode: PersonaMode): Array<[string, string]> {
  const svc = serviceOf(n, dlg);
  const out: Array<[string, string]> = [];
  for (const id of ids) {
    if (id === 'time') {
      if (svc) {
        const tl = SERVICES[SERVICE_IDX[svc]].timeline;
        out.push(['How long', tl === 'Custom Scope' ? `${SERVICE_NOUN[svc]} depend on scope, so the owner gives a date after seeing the details.` : `${SERVICE_NOUN[svc]} usually take **${tl}** (longer if a part must be ordered).`]);
      } else out.push(['How long', 'repairs usually **24 - 48 hours**, design work **3 - 5 days**, file conversions **24 hours**; websites depend on scope.']);
    } else if (id === 'price') out.push(['How much', "I won't guess a number — it depends on the exact job (device + fault + parts, or design/web scope). Send the details and you get a clear quote."]);
    else if (id === 'warranty') out.push(['Warranty', "depends on the job and the part, and I don't want to promise one I can't back up — the owner states exactly what's covered in the quote."]);
    else if (id === 'payment') out.push(['Payment', "I don't have the accepted methods or deposit rules, so I won't say yes or no — the owner confirms with the quote."]);
    else if (id === 'visit') out.push(['Visits / delivery', 'design and web work is done remotely; for repairs, drop-off, pickup or delivery is arranged per job — ask the owner what works for your location.']);
    else if (id === 'location') out.push(['Where', 'based in **Ndejje, Makindye Ssabagabo, Uganda**.']);
    else if (id === 'hours') out.push(['Hours', "no set opening hours are listed, and I won't guess — message the owner to check who's free."]);
  }
  void mode;
  return out;
}

function facts(n: string, mode: PersonaMode, dlg: DialogueState): ReasonReply | null {
  if (n.length > 220) return null;
  const ids = FACT_RX.filter(([, rx]) => rx.test(n)).map(([id]) => id);
  const questionish = /\?|^(how|what|when|where|do|does|can|is|are|will|would|and)\b/.test(n) || /\b(and|also|plus)\b/.test(n);
  // Two or more different questions in one message; a single question is handled by the knowledge base.
  const solo = ids.length === 1 && ids[0] === 'visit' && questionish; // the KB used to miss "do you come to my house"
  if (!(ids.length >= 2 || solo) || !questionish) return null;
  // "charge" etc. in a symptom sentence is not a price question.
  if (detectSymptom(flat(n)) && !/\b(how much|price|cost|quote)\b/.test(n) && ids.length < 2) return null;
  const lines = factLines(ids, n, dlg, mode);
  const human = lines.map(([k, v]) => `- **${k}:** ${v}`).join('\n') + '\n\nWant me to send these questions to the owner so you get exact answers?';
  const expert = 'ANSWERS //\n' + lines.map(([k, v]) => `${k.toUpperCase()}: ${v.replace(/\*\*/g, '')}`).join('\n');
  return reply(t(mode, human, expert), expert, { suggestions: ['Send my question to the owner', 'Get a quote', 'Book a repair'], topic: 'PRICING_RATES', keepTopic: true, trace: ids.map((i) => `Detected question: ${i}`) });
}

/* ------------------------------------------------------------------ advice */

interface Biz {
  noun: string;
  rx: RegExp;
  pages: string[];
  extra: string;
}

const BUSINESSES: Biz[] = [
  { noun: 'salon', rx: /\b(salon|barber\w*|hair ?(dresser|stylist)?|beauty|spa|nails?|makeup|braids?)\b/, pages: ['Home', 'Services & price list', 'Gallery of your work', 'Book / contact', 'About'], extra: 'A **book-now button** (WhatsApp or a form) matters more than extra pages, and a before/after gallery sells better than text.' },
  { noun: 'restaurant or café', rx: /\b(restaurant|cafe|caf[eé]|bar|bakery|catering|food|kitchen|eatery|hotel)\b/, pages: ['Home', 'Menu', 'Gallery', 'Location & hours', 'Contact / reservations'], extra: 'Put the **menu and location** one tap from the home page — that is what people open it for.' },
  { noun: 'shop', rx: /\b(shop|store|boutique|retail|supermarket|kiosk|market)\b/, pages: ['Home', 'Products', 'About', 'Location & contact'], extra: 'If you sell online later, the site can grow into a store; start with a clear product page and an easy way to order or ask.' },
  { noun: 'school or organisation', rx: /\b(school|college|university|church|ministry|ngo|charity|foundation|community|club|association|nonprofit)\b/, pages: ['Home', 'About / mission', 'Programmes or activities', 'News / events', 'Contact'], extra: 'A clear **who we are and how to join or give** message on the home page does most of the work.' },
  { noun: 'creative or freelancer', rx: /\b(photograph\w*|artist|musician|band|dj|singer|designer|freelanc\w*|videograph\w*|model|writer|portfolio)\b/, pages: ['Home', 'Work / portfolio', 'About', 'Contact'], extra: 'Lead with your **best 6 pieces**, not everything — a tight portfolio converts better than a big one.' },
  { noun: 'clinic or pharmacy', rx: /\b(clinic|pharmacy|hospital|dental|dentist|doctor|health)\b/, pages: ['Home', 'Services', 'About the team', 'Location & hours', 'Contact / appointments'], extra: 'Trust matters most: clear services, real photos and contact details people can find fast.' },
  { noun: 'garage or workshop', rx: /\b(mechanic|garage|workshop|carpent\w*|welding|tailor\w*|construction|plumb\w*|electrician|repair shop)\b/, pages: ['Home', 'Services', 'Gallery of finished jobs', 'Contact / quote request'], extra: 'Photos of finished jobs plus a **request-a-quote** form are what win customers here.' },
  { noun: 'business', rx: /\b(business|company|startup|start-up|brand|enterprise|agency|firm|venture|boutique)\b/, pages: ['Home', 'About', 'Services or products', 'Gallery / portfolio', 'Contact'], extra: 'Keep it to what a customer needs to decide: what you do, proof, and how to reach you.' },
];

function businessOf(text: string): Biz | undefined {
  return BUSINESSES.find((b) => b.rx.test(text));
}

function historyText(memory: SessionMemory): string {
  return (memory.conversationHistory || [])
    .filter((h) => h.role === 'user')
    .slice(-8)
    .map((h) => lc(h.text))
    .join(' . ');
}

const RECOMMEND = /\b(which (one |option |service )?(should|would|do) (i|you|we)|what (do|would|should) you (recommend|suggest|advise)|what (would|should) you (do|pick|choose)|what('?s| is) (best|better) for (me|my|us)|which is (the )?(best|better|right) for (me|my|us)|where (should|do) i start|what (should|would) i (get|pick|choose|go with|start with|do first)|what would you do first|what('?s| is) the (best|right) (option|choice|one)|(which|what) (do|would) you (pick|choose|prefer)|i (cant|can't|cannot) (decide|choose)|help me (choose|decide|pick))\b/;
const PAGES_Q = /\b(how many pages|what pages|which pages|pages (do|would|should) (i|we) (need|have)|how big (should|would) (it|the site) be)\b/;

function comparisonAdvice(text: string, mode: PersonaMode): ReasonReply | null {
  const c = comparisonFromAnswer(text);
  if (!c) return null;
  const best = c.rows.find(([l]) => /best for|good for|use (it )?for/i.test(l));
  const lines = [
    best ? `- Choose **${c.a}** if: ${best[1]}` : '',
    best ? `- Choose **${c.b}** if: ${best[2]}` : '',
  ].filter(Boolean);
  const human = `It depends on how you'll use it — here's how I'd decide:\n${lines.length ? lines.join('\n') + '\n' : ''}\n**My pick, in short:** ${c.verdict}\n\nTell me what you'll use it for (and roughly your budget) and I'll narrow it to one.`;
  const expert = `DECISION // ${c.a} vs ${c.b}\n${lines.map((l) => l.replace(/\*\*/g, '')).join('\n')}\nVERDICT // ${c.verdict}`;
  return reply(t(mode, human, expert), expert, { suggestions: ['Mostly everyday use', 'Gaming or heavy work', 'Tight budget', 'Send this to the owner'], topic: 'GENERAL_QA', keepTopic: true, trace: [`Compared ${c.a} and ${c.b}.`, `Verdict: ${c.verdict}`] });
}

function advice(n: string, mode: PersonaMode, dlg: DialogueState, memory: SessionMemory): ReasonReply | null {
  const pages = PAGES_Q.test(n);
  const rec = RECOMMEND.test(n);
  if (!pages && !rec) return null;

  // After a diagnosis, brief or decision the dialogue knows the real first step; don't answer generically.
  // ("what should I do first?" is about the visitor's own next action; "what would YOU do first?" is a request for advice.)
  const ownAction = /\b(should|can|could|do|shall) i (do|try|start)\b/.test(n);
  if (!pages && ownAction && (dlg.flow || (dlg.last && ['diagnosis', 'project', 'decision'].includes(dlg.last.kind)))) return null;

  if (rec && dlg.last?.text) {
    const cmp = comparisonAdvice(dlg.last.text, mode);
    if (cmp) return cmp;
  }

  const biz = businessOf(n) || businessOf(historyText(memory));
  if (pages) {
    if (!biz) {
      return reply(
        t(mode, 'It depends on the kind of site: a portfolio is usually **3 - 5 pages**, a small business **4 - 6**, a shop grows from there. 📄 What is it for — a salon, shop, restaurant, school, freelancer…? Tell me and I\'ll list the exact pages.', 'PAGES // Typical 3-6. Specify business type.'),
        'PAGES // Specify business type.',
        { suggestions: ['A salon', 'A shop', 'A restaurant', 'A portfolio'], topic: 'WEB_DEV', keepTopic: true }
      );
    }
    const human = `For a **${biz.noun}** I'd keep it to about **${biz.pages.length} pages**:\n${biz.pages.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n${biz.extra}\n\nMore pages can come later; a small, clear site beats a big unfinished one.`;
    return reply(t(mode, human, `PAGES // ${biz.pages.join(' | ')}`), `PAGES // ${biz.pages.join(' | ')}`, { suggestions: ['Build me a website', 'Send this to the owner', 'Show web projects'], topic: 'WEB_DEV', keepTopic: true, trace: [`Business type: ${biz.noun}`, `Suggested pages: ${biz.pages.join(', ')}`] });
  }

  if (biz) {
    const human = `For a **${biz.noun}** I'd go in this order:\n1. **Logo / brand look** — the website, posters and social posts all borrow from it, so doing it first saves redoing work later.\n2. **A simple website** — about ${biz.pages.length} pages (${biz.pages.slice(0, 3).join(', ').toLowerCase()}…) so people can find and contact you.\n3. **Posters or social graphics** when you have an offer or event.\n\n${biz.extra}\n\nI can't quote prices here, but I can draft a brief for the first step and send it to the owner. Want to start with the logo?`;
    return reply(t(mode, human, `PLAN // 1) logo/brand 2) website (${biz.pages.length} pages) 3) posters/social. Owner quotes.`), 'PLAN // logo -> site -> posters.', { suggestions: ['I need a logo', 'Build me a website', 'Send this to the owner'], topic: 'DESIGN_BRANDING', keepTopic: true, trace: [`Business type: ${biz.noun}`, 'Brand first because every other asset reuses it.'] });
  }

  return reply(
    t(mode, "It depends on what you're after, so here's how I'd choose:\n- **Something is broken** (phone, laptop, PC) → a repair — start with a quick diagnosis.\n- **You want to look professional** → a logo / brand look first.\n- **You want to be found online** → a website.\n\nWhich of those is closest to your situation?", 'ADVICE // broken -> repair | look -> brand | online -> website. Specify.'),
    'ADVICE // Specify goal.',
    { suggestions: ['Something is broken', 'I need a logo', 'Build me a website', 'Get a quote'], keepTopic: true }
  );
}

/** "why?" right after a comparison explains the verdict. */
function whyCompare(n: string, mode: PersonaMode, dlg: DialogueState): ReasonReply | null {
  if (!/^(why|why is that|how come|why so|explain|explain why|how so)$/.test(n)) return null;
  if (!dlg.last?.text) return null;
  const c = comparisonFromAnswer(dlg.last.text);
  if (!c) return null;
  const top = c.rows.slice(0, 3).map(([l, a, b]) => `- **${l}:** ${c.a} — ${a}; ${c.b} — ${b}`).join('\n');
  const human = `Because of the trade-offs:\n${top}\n\nThat's why: ${c.verdict}`;
  return reply(t(mode, human, `WHY // ${c.verdict}`), `WHY // ${c.verdict}`, { suggestions: ['Which is better for me?', 'Send this to the owner'], keepTopic: true });
}

/* ------------------------------------------------------------------ vague trouble, statements, next step */

const VAGUE = /^(?:it'?s?|its|it is|my (?:thing|stuff|device|machine|gadget)|something|everything|this) ?(?:is |has )?(?:broken|broke|not working|isn'?t working|doesn'?t work|does not work|not right|wrong|dead|damaged|messed up|bad|faulty|acting up|acting weird|playing up|buggy|glitchy|gone)$|^(?:i have a problem|i have an issue|there'?s a problem|something'?s wrong|something is wrong|not working|broken|it broke|it died|it'?s dead)$/;

function vague(n: string, mode: PersonaMode, dlg: DialogueState): ReasonReply | null {
  if (!VAGUE.test(n)) return null;
  const dev = dlg.ent.device;
  if (dev) {
    const label = deviceLabel(dlg.ent).toLowerCase();
    return reply(
      t(mode, `Sorry it's giving you trouble. 😕 What is your ${label} actually doing?`, `QUERY // ${label}: symptom?`),
      'QUERY // Symptom?',
      { suggestions: [`My ${label} won't turn on`, `My ${label} screen is black`, `My ${label} won't charge`, `My ${label} is overheating`, `My ${label} is slow`], topic: 'HARDWARE_REPAIR', keepTopic: true }
    );
  }
  return reply(
    t(mode, "Sorry to hear that — let's sort it out. 🔧 What is it that's acting up: a **phone**, a **laptop / PC**, or something else (a design or website)?", 'QUERY // Which device or project?'),
    'QUERY // Device?',
    { suggestions: ['My phone is broken', 'My laptop is broken', 'My PC won’t start', 'It’s a website or design'], keepTopic: true }
  );
}

const STATEMENT = /^(?:i (?:have|got|own|use|bought|am using|ve got)|ive got|my (?:phone|laptop|pc|computer|tablet|device|machine) (?:is|=)|it'?s|its|it is|this is|that is|mine is|i'?m on|im on|the (?:phone|laptop|pc|computer|device) is)\b/;

function statement(raw: string, n: string, mode: PersonaMode, dlg: DialogueState): ReasonReply | null {
  if (!STATEMENT.test(n) || /\?/.test(raw) || n.split(' ').length > 12) return null;
  const f = flat(raw);
  if (detectSymptom(f) || detectProject(f)) return null;
  const dev = detectDevice(f);
  const brand = detectBrand(f);
  const model = detectModel(f);
  if (!dev && !brand && !model) return null;
  const ent = mergeEntities(dlg.ent, raw);
  const label = deviceLabel(ent) || [brand, dev].filter(Boolean).join(' ');
  const d = (ent.device || dev || 'device') as string;
  const noun = d === 'desktop' ? 'desktop PC' : d === 'pc' ? 'computer' : d;
  return reply(
    t(mode, `Got it — **${label}**. 👍 What's going on with it: a fault, a slowdown, an upgrade, or something else?`, `CONTEXT // ${label}. Query: issue?`),
    `CONTEXT // ${label}.`,
    { suggestions: [`My ${noun} won't turn on`, `My ${noun} is slow`, `My ${noun} won't charge`, 'Repair or replace it?'], topic: 'HARDWARE_REPAIR', keepTopic: true }
  );
}

const NEXT_Q = /^(?:what now|what next|and then|then|and then what|then what|what do i do (?:now|next)|what should i do(?: right now| now| next| first)?|what (?:do|should) i do (?:first|now|next|then)|so what now|ok and then|what happens next|next step|what'?s next|whats next|what (?:can|should) i (?:try|do)(?: now| next)?)$/;

function numberedSteps(text: string): string[] {
  return text
    .split('\n')
    .map((l) => /^\s*(?:\d+[.)]|[-•])\s+(.*)$/.exec(l)?.[1]?.replace(/\*\*/g, '').trim())
    .filter((s): s is string => !!s && s.length > 3);
}

function nextStep(n: string, mode: PersonaMode, dlg: DialogueState): ReasonReply | null {
  if (!NEXT_Q.test(n)) return null;
  if (dlg.flow) return null; // an open guided flow already knows its next step
  const last = dlg.last;
  if (last && (last.kind === 'diagnosis' || last.kind === 'project' || last.kind === 'decision')) return null; // dialogue follow-ups handle these
  const chips = ['Send this to the owner', 'Book a repair', 'That didn’t work'];

  // Continuing a list of steps we already started giving ("and then?").
  if (last?.kind === 'other' && last.steps?.length && typeof last.stage === 'number') {
    const rest = last.steps.slice(last.stage);
    if (rest.length) {
      const next = rest.slice(0, 3);
      const human = `Next:\n${next.map((s, i) => `${(last.stage as number) + i + 1}. ${s}`).join('\n')}${rest.length > 3 ? '\n\nSay **and then?** for more.' : '\n\nThat covers the steps I can give from here — after that it needs a hands-on check.'}`;
      return reply(t(mode, human, `NEXT //\n${next.join('\n')}`), 'NEXT // see steps.', {
        suggestions: chips,
        keepTopic: true,
        last: { ...last, stage: (last.stage as number) + next.length },
      });
    }
    return reply(
      t(mode, "That's everything I can safely suggest from here. 🔧 The next step is a hands-on check — I can send the details to the owner (with what you've already tried) so it's picked up quickly.", 'NEXT // Remote steps exhausted. Dispatch to owner.'),
      'NEXT // dispatch.',
      { suggestions: ['Send this to the owner', 'Book a repair'], keepTopic: true }
    );
  }

  const steps = last?.text ? numberedSteps(last.text) : [];
  if (steps.length >= 2) {
    const first = steps.slice(0, 3);
    const more = steps.length > 3;
    const human = `Right now, in this order:\n${first.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${more ? 'Say **and then?** and I\'ll give you the rest.' : 'After that, the next step is a hands-on check — I can send the details to the owner so it\'s picked up quickly.'}`;
    return reply(t(mode, human, `NEXT //\n${first.map((s, i) => `${i + 1}) ${s}`).join('\n')}\nTHEN // Dispatch to owner.`), 'NEXT // see steps.', {
      suggestions: chips,
      keepTopic: true,
      last: { kind: 'other', text: human, steps, stage: first.length },
    });
  }
  if (last?.text && !RECOMMEND.test(n)) {
    return reply(
      t(mode, "The best next step is to tell me the **device** and **what exactly is happening** — I'll ask a couple of quick questions and narrow it down. Or, if you'd rather talk to a person, I can send everything so far to the owner. 📨", 'NEXT // Provide device + symptom, or dispatch to owner.'),
      'NEXT // device + symptom.',
      { suggestions: ['My device is not working', 'I need a logo', 'Send this to the owner'], keepTopic: true }
    );
  }
  return null;
}

/** "explain what an operating system is, then give me an example" */
function definitionPlus(raw: string, n: string, mode: PersonaMode): ReasonReply | null {
  const m = /^(?:please )?(?:explain|define|what is|what's|whats|describe|tell me (?:what|about))\s+(?:what\s+)?(?:an?\s+|the\s+)?(.{2,40}?)\s+(?:is\s+)?(?:,|and|then|and then)\s+(?:also\s+)?(?:give|show|tell|add|with)\s+(?:me\s+)?(?:an?\s+|some\s+)?(example|analogy|comparison|real[- ]life example)s?\b/.exec(n);
  if (!m) return null;
  const q = tryGlossary(`explain ${m[1]}`);
  if (!q) return null;
  const g = termReply(q);
  const plain = q.term;
  const human = `${g.human.split('\n\n')[0]}\n\n**${m[2] === 'analogy' || m[2] === 'comparison' ? 'Analogy' : 'Example'}:** ${plain.eli5}`;
  return reply(t(mode, human, `${g.expert}\nEXAMPLE // ${plain.eli5}`), `${g.expert}`, { suggestions: g.suggestions, topic: 'GENERAL_QA', trace: [`Looked up “${m[1]}” in the glossary.`] });
}

/* ------------------------------------------------------------------ entry point */

export interface ReasonContext {
  memory: SessionMemory;
  dlg: DialogueState;
  mode: PersonaMode;
  /** Injected for tests. */
  now?: Date;
}

/**
 * Runs the reasoners in order of specificity. `flowStep` is the current step of an active guided
 * flow, so evidence like "it charges on another cable" is not mistaken for the answer to a question
 * the flow is waiting on.
 */
export function tryReason(raw: string, ctx: ReasonContext): ReasonReply | null {
  const n = lc(raw);
  if (!n) return null;
  const { mode, dlg, memory } = ctx;
  const flowStep = dlg.flow?.step;
  const flowIsAskingDevice = !flowStep || flowStep === 'device';

  // Evidence only while no flow question could be answered by it.
  if (!dlg.flow || flowIsAskingDevice) {
    const ev = evidence(n, mode, dlg);
    if (ev) return ev;
  }

  const est = estimate(n, mode, dlg, ctx.now ?? new Date());
  if (est) return est;

  const f = facts(n, mode, dlg);
  if (f) return f;

  const dp = definitionPlus(raw, n, mode);
  if (dp) return dp;

  const pq = tryProjectQA(raw, mode, memory);
  if (pq) return pq;

  const wc = whyCompare(n, mode, dlg);
  if (wc) return wc;

  // "what now?" continues the steps we were giving; it comes before general advice but yields to it when nothing is in progress.
  if (!dlg.flow) {
    const nx = nextStep(n, mode, dlg);
    if (nx) return nx;
  }

  const a = advice(n, mode, dlg, memory);
  if (a) return a;

  if (!dlg.flow) {
    const v = vague(n, mode, dlg);
    if (v) return v;
    const s = statement(raw, n, mode, dlg);
    if (s) return s;
  }
  return null;
}

export function reasonReply(r: ReasonReply, mode: PersonaMode): string {
  return mode === 'EXPERT' ? r.expert : r.human;
}
