// src/utils/chatEngine/dialogue.ts
//
// The dialogue manager: what makes the assistant hold a real multi-turn conversation WITHOUT any
// language model.
//
//   * remembers what the visitor has said (device, brand, symptom, project, urgency, mood)
//   * runs guided flows that ask one clear question at a time and reason to a ranked conclusion:
//        diagnose  — "my phone won't charge"        -> questions -> ranked causes + safe steps
//        project   — "I need a logo"                -> brief -> deliverables, timeline, hand-off
//        decide    — "repair or replace?"           -> verdict with the reasons shown
//        quote     — "can I get a quote?"           -> routes into the right flow
//   * answers follow-ups using what it just said: "why?", "how long?", "how much?",
//     "what if that doesn't work?", "simpler", "more", "recap"
//   * lets the visitor stay in control: back / skip / cancel / "just tell me" / questions mid-flow
//
// Pure functions over a small JSON state kept in memory.userContext.dlg. No browser APIs.

import type { PersonaMode, SessionMemory, TopicDomain } from './types';
import {
  Entities,
  SYMPTOM_LABEL,
  SymptomId,
  ProjectKind,
  deviceLabel,
  detectBrand,
  detectDevice,
  detectModel,
  detectProject,
  detectProjects,
  detectSymptom,
  flat,
  mergeEntities,
} from './entities';
import { Answers, Cause, DEVICE_CHOICES, Question, TREES, makeCtx } from './diagnosis';
import { SERVICES } from '@/data/servicesData';

/* ------------------------------------------------------------------ state */

export type FlowId = 'diagnose' | 'project' | 'decide' | 'quote';

export interface ActiveFlow {
  id: FlowId;
  /** 'device' | 'q:<id>' | 'kind' | 'name' | ... — what we are currently waiting for */
  step: string;
  data: Record<string, string>;
  /** Failed attempts to understand the current answer. */
  misses: number;
  /** Turns spent on other topics while this flow waits. */
  off: number;
  /** Another symptom mentioned mid-flow, offered after the conclusion. */
  queued?: SymptomId;
  /** A design/web request made in the same breath as a repair; offered once the repair is dealt with. */
  queuedProject?: ProjectKind;
  /** Times a turn carried useful details (device, brand, numbers) but did not answer the question. */
  info?: number;
}

export interface LastAnswer {
  kind: 'diagnosis' | 'project' | 'decision' | 'kb' | 'other';
  text: string;
  why?: string[];
  causes?: Cause[];
  steps?: string[];
  /** Which cause the visitor has been steered to so far ("what if that doesn't work?"). */
  stage?: number;
  service?: 'hardware' | 'design' | 'ui' | 'assets';
  brief?: string;
  entryId?: string;
}

export interface DialogueState {
  v: 1;
  flow?: ActiveFlow;
  ent: Entities;
  last?: LastAnswer;
}

export interface DialogueOutput {
  reply: string;
  suggestions?: string[];
  handoff?: boolean;
  handoffNote?: string;
  /** Knowledge-base query whose picture (if any) should be shown with the reply. */
  imageQuery?: string;
  topic?: TopicDomain;
  state: DialogueState;
  /** True when this reply belongs to a flow step (as opposed to a one-off follow-up). */
  flow: boolean;
  trace?: string[];
}

const EMPTY: DialogueState = { v: 1, ent: {} };

export function readState(memory: SessionMemory): DialogueState {
  const raw = memory.userContext?.dlg as DialogueState | undefined;
  if (!raw || raw.v !== 1 || typeof raw !== 'object') return { v: 1, ent: {} };
  return { v: 1, flow: raw.flow, ent: raw.ent || {}, last: raw.last };
}

export function withState(memory: SessionMemory, state: DialogueState): SessionMemory {
  return { ...memory, userContext: { ...memory.userContext, dlg: state } };
}

/** Fold what this message reveals into the remembered facts. */
export function observe(state: DialogueState, raw: string): DialogueState {
  return { ...state, ent: mergeEntities(state.ent, raw) };
}

/* ------------------------------------------------------------------ small helpers */

const t = (mode: PersonaMode, human: string, expert: string) => (mode === 'EXPERT' ? expert : human);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const CANCEL = /^(cancel|stop( this)?|never ?mind|forget it|forget that|exit|quit|leave it|drop it|no more questions|enough)$/;
const RESTART = /^(start over|restart|begin again|again from the start|start again|redo)$/;
const BACK = /^(back|go back|previous|undo|wait go back|previous question)$/;
const SKIP = /^(skip|skip it|pass|i dont know|dont know|idk|not sure|no idea|unsure|i dunno|dunno|cant tell|i cant tell|whatever)$/;
const CONCLUDE_NOW = /^(just tell me|tell me now|give me the answer|skip (the )?questions|skip all|just (give|tell) me (the )?(answer|result|verdict)|conclude|wrap up|that is enough|thats enough|what do you think)$/;
const CONTINUE = /^(continue|resume|go on|carry on|back to (it|that|the (diagnosis|questions?|brief))|ok continue|lets continue|continue please)$/;
const LOOKS_LIKE_QUESTION = /\?|^(what|why|how|when|where|who|which|can|could|do|does|is|are|will|would|should|tell me|explain)\b/;
const GENERIC_START = /^(why (do|does|are|is)|what (causes|is|are|does)|whats|how (does|do|can) (i )?(prevent|avoid)|tips|explain|difference|what is the)\b/;
const POSSESSIVE = /\b(my|our|mine|ive|im|i have|i got)\b/;

const SYMPTOM_PHRASE: Record<SymptomId, string> = {
  water: 'it got wet',
  no_power: "it won't turn on",
  no_charge: "it's not charging",
  overheat: 'it is overheating',
  black_screen: 'the screen is black',
  cracked: 'the screen is cracked',
  shutdown: 'it keeps restarting',
  battery: 'the battery drains fast',
  wifi: 'my wifi keeps dropping',
  noise: 'it makes a strange noise',
  storage: 'my storage is full',
  audio: 'there is no sound',
  slow: 'it is very slow',
};

function empathy(state: DialogueState, mode: PersonaMode): string {
  if (mode === 'EXPERT') return '';
  const mood = state.ent.mood || 0;
  if (mood >= 2) return "I'm sorry this is stressing you out — let's sort it out together, one step at a time. 💛 ";
  if (mood === 1) return "That sounds frustrating — let's get to the bottom of it. ";
  return '';
}

function chipsFor(opts: Array<{ label: string }>, extra: string[] = []): string[] {
  return [...opts.map((o) => o.label), ...extra].slice(0, 6);
}

const norm = (raw: string) => flat(raw);

const LOOSE_STOP = new Set('that this with have from they them were been very just like also does more some than then when what your only about into over really still want need would could should there their which while where'.split(' '));
const stem5 = (w: string) => w.slice(0, 5);
const wordsOf = (s: string) => (s.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !LOOSE_STOP.has(w));

/** Second chance: the visitor's wording shares word stems ("booting" ~ "boot") with exactly one option. */
function looseOpt<T extends { test: RegExp; label: string }>(opts: T[], n: string): T | undefined {
  const user = new Set(wordsOf(n).map(stem5));
  if (!user.size || n.split(' ').length > 14) return undefined;
  const scored = opts
    .map((o) => {
      const own = new Set([...wordsOf(o.label), ...wordsOf(o.test.source)].map(stem5));
      let score = 0;
      user.forEach((u) => {
        if (own.has(u)) score++;
      });
      return { o, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return undefined;
  if (scored.length > 1 && scored[0].score === scored[1].score) return undefined;
  return scored[0].o;
}

function matchOpt<T extends { test: RegExp; label: string }>(opts: T[], n: string, raw: string): T | undefined {
  const lower = raw.trim().toLowerCase();
  const exact = opts.find((o) => o.label.toLowerCase() === lower);
  if (exact) return exact;
  return opts.find((o) => o.test.test(n)) || looseOpt(opts, n);
}

/** Does this message carry facts (device, brand, model, a quantity of time/size) even though it didn't answer? */
function carriesInfo(n: string): boolean {
  return !!(detectBrand(n) || detectModel(n) || detectDevice(n)) || /\b\d+\s*(sec|secs|seconds?|min|mins|minutes?|hours?|days?|weeks?|months?|years?|gb|tb|mb|gig\w*)\b/.test(n);
}

/** Phone release year from the model name, so "how old is it?" can be answered from "my Galaxy S21". */
const IPHONE_YEAR: Record<string, number> = { '6': 2014, '7': 2016, '8': 2017, x: 2017, xs: 2018, xr: 2018, '11': 2019, '12': 2020, '13': 2021, '14': 2022, '15': 2023, '16': 2024, '17': 2025 };
const GALAXY_S_YEAR: Record<string, number> = { '6': 2015, '7': 2016, '8': 2017, '9': 2018, '10': 2019, '20': 2020, '21': 2021, '22': 2022, '23': 2023, '24': 2024, '25': 2025 };
export function modelYear(n: string): number | undefined {
  let m = /\biphone (\d{1,2}|xs|xr|x)\b/.exec(n);
  if (m && IPHONE_YEAR[m[1]]) return IPHONE_YEAR[m[1]];
  m = /\b(?:galaxy )?s(\d{1,2})\b/.exec(n);
  if (m && /(galaxy|samsung|\bs\d)/.test(n) && GALAXY_S_YEAR[m[1]]) return GALAXY_S_YEAR[m[1]];
  m = /\bpixel (\d)\b/.exec(n);
  if (m) return 2015 + Number(m[1]);
  return undefined;
}

/* ------------------------------------------------------------------ diagnose flow */

function visibleQuestions(tree: (typeof TREES)[SymptomId], a: Answers, dev: Entities['device']): Question[] {
  const ctx = makeCtx(dev);
  return tree.questions.filter((q) => !(q.skip && q.skip(a, ctx)));
}

function nextQuestion(symptom: SymptomId, a: Answers, dev: Entities['device']): Question | undefined {
  const ctx = makeCtx(dev);
  return TREES[symptom].questions.find((q) => a[q.id] === undefined && !(q.skip && q.skip(a, ctx)));
}

function progressTag(symptom: SymptomId, a: Answers, dev: Entities['device'], mode: PersonaMode): string {
  const list = visibleQuestions(TREES[symptom], a, dev);
  if (list.length < 2) return '';
  const answered = list.filter((q) => a[q.id] !== undefined).length;
  return mode === 'EXPERT' ? `[${answered + 1}/${list.length}] ` : `**Question ${answered + 1} of ${list.length}** · `;
}

function askQuestion(flow: ActiveFlow, state: DialogueState, mode: PersonaMode, lead = ''): DialogueOutput {
  const symptom = flow.data.symptom as SymptomId;
  const dev = state.ent.device;
  const q = nextQuestion(symptom, flow.data, dev);
  if (!q) return concludeDiagnosis(flow, state, mode);
  const ctx = makeCtx(dev);
  const text = mode === 'EXPERT' && q.expert ? q.expert(ctx) : q.ask(ctx);
  flow.step = 'q:' + q.id;
  flow.misses = 0;
  return {
    reply: `${lead}${progressTag(symptom, flow.data, dev, mode)}${text}`,
    suggestions: chipsFor(q.opts.filter((o, i, arr) => arr.findIndex((x) => x.label === o.label) === i), ['Not sure']),
    state: { ...state, flow },
    flow: true,
    topic: 'HARDWARE_REPAIR',
  };
}

function askDevice(flow: ActiveFlow, state: DialogueState, mode: PersonaMode, lead = ''): DialogueOutput {
  flow.step = 'device';
  flow.misses = 0;
  return {
    reply: `${lead}${t(mode, 'What kind of device is it?', 'DIAG // Device class?')}`,
    suggestions: DEVICE_CHOICES.map((d) => d.label),
    state: { ...state, flow },
    flow: true,
    topic: 'HARDWARE_REPAIR',
  };
}

function startDiagnose(symptom: SymptomId, state: DialogueState, mode: PersonaMode, intent?: 'quote'): DialogueOutput {
  const flow: ActiveFlow = { id: 'diagnose', step: 'device', data: { symptom, ...(intent ? { intent } : {}) }, misses: 0, off: 0 };
  const tree = TREES[symptom];
  const ctx = makeCtx(state.ent.device);
  const urgentLead =
    symptom === 'water'
      ? t(mode, '⚠️ **First, switch it off and don’t charge it.** Quick questions so I can advise properly.\n\n', 'URGENT // Power off. Do not charge.\n')
      : '';
  const lead = `${urgentLead}${empathy(state, mode)}${mode === 'EXPERT' ? '' : tree.intro(ctx) + '\n\n'}`;
  if (!state.ent.device) return askDevice(flow, state, mode, lead);
  return askQuestion(flow, state, mode, lead);
}

const PHRASE_FOR_BRIEF: Record<string, string> = { yes: 'yes', no: 'no' };

function recapLines(symptom: SymptomId, a: Answers): string[] {
  const tree = TREES[symptom];
  const lines: string[] = [];
  for (const q of tree.questions) {
    const v = a[q.id];
    if (v === undefined) continue;
    if (v === 'unsure') {
      lines.push(`${q.recap}: you weren’t sure`);
      continue;
    }
    const opt = q.opts.find((o) => o.val === v);
    lines.push(`${q.recap}: ${opt ? opt.label.replace(/^Yes, |^No, /, '').toLowerCase() : PHRASE_FOR_BRIEF[v] || v}`);
  }
  return lines;
}

function concludeDiagnosis(flow: ActiveFlow, state: DialogueState, mode: PersonaMode): DialogueOutput {
  const symptom = flow.data.symptom as SymptomId;
  const ent = state.ent;
  const ctx = makeCtx(ent.device);
  const tree = TREES[symptom];
  const c = tree.conclude(flow.data, ctx);
  const label = deviceLabel(ent);
  const recap = recapLines(symptom, flow.data);
  const because = [...recap.map((r) => `You told me — ${r}.`), ...c.because];
  const top = c.causes[0];
  const quote = flow.data.intent === 'quote';

  const queued = flow.queued && flow.queued !== symptom ? flow.queued : undefined;
  const dataLine = ent.dataAtRisk
    ? t(mode, `\n**Your files:** since they matter, avoid repeated restarts and don’t reset or reinstall anything — say **send this to the owner** and mention the data so it’s handled carefully.`, '\nDATA // At risk. No resets. Flag to owner.')
    : '';
  const urgentLine = ent.urgent
    ? t(mode, `\n**Since it’s urgent:** say so when you contact the owner — the quickest route is the contact form or WhatsApp.`, '\nPRIORITY // Flag urgent on dispatch.')
    : '';
  const qp = flow.queuedProject;
  const qpNoun = qp ? KINDS.find((k) => k.val === qp)?.noun || 'project' : '';
  const queuedLine =
    (queued ? t(mode, `\nYou also mentioned **${SYMPTOM_LABEL[queued]}** — want me to look at that next?`, `\nQUEUED // ${SYMPTOM_LABEL[queued]}`) : '') +
    (qp ? t(mode, `\nAnd you mentioned wanting a **${qpNoun}** — shall we scope that next?`, `\nQUEUED // ${qpNoun} project`) : '');

  let reply: string;
  if (mode === 'EXPERT') {
    reply = [
      `DIAG_RESULT // ${label} · ${SYMPTOM_LABEL[symptom]}`,
      c.urgent ? `ALERT // ${c.urgent.replace(/\*\*/g, '')}` : '',
      `CAUSES // ${c.causes.map((x, i) => `${i + 1}) ${x.name}`).join(' ')}`,
      `ACTIONS // ${c.tryNow.map((x, i) => `${i + 1}) ${x.replace(/\*\*/g, '')}`).join(' ')}`,
      `ESCALATE_IF // ${c.stopIf.join('; ')}`,
      dataLine.trim(),
      urgentLine.trim(),
      queuedLine.trim(),
      quote ? 'NEXT // Dispatch details to owner for a quote.' : 'NEXT // Book a repair or dispatch details to owner.',
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    const head = c.urgent ? `⚠️ ${c.urgent}\n\n` : '';
    reply =
      `${head}**Here’s my read on your ${label}** (${SYMPTOM_LABEL[symptom]})\n\n` +
      `**Most likely, in order**\n${c.causes.map((x, i) => `${i + 1}. **${x.name}** — ${x.why}`).join('\n')}\n\n` +
      `**Try this now**\n${c.tryNow.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n` +
      `**Stop and bring it in if**\n${c.stopIf.map((x) => `- ${x}`).join('\n')}` +
      dataLine +
      urgentLine +
      queuedLine +
      `\n\nThis is a best guess from here — a hands-on check confirms it. ` +
      (quote
        ? 'Want me to send these details to the owner so they can reply with a quote?'
        : 'Want me to book it in, or send these details to the owner?');
  }

  const brief = [
    `Device: ${label}${ent.device && !label.toLowerCase().includes(ent.device === 'pc' ? 'computer' : ent.device) ? ` (${ent.device})` : ''}`,
    `Problem: ${SYMPTOM_LABEL[symptom]}`,
    recap.length ? `Details: ${recap.join('; ')}` : '',
    top ? `Likely cause: ${top.name}` : '',
    ent.urgent ? 'Urgent: yes' : '',
    ent.dataAtRisk ? 'Data at risk: yes — please do not reset' : '',
    quote ? 'Wants a quote.' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const chips = quote ? ['Send this to the owner', 'Why do you say that?', 'How long will it take?'] : ['Book a repair', 'Send this to the owner', 'Why do you say that?', 'How long will it take?'];
  if (queued) chips.unshift(`Also: ${SYMPTOM_PHRASE[queued]}`);
  if (qp) chips.unshift(`Also: I need a ${qpNoun}`);

  const last: LastAnswer = {
    kind: 'diagnosis',
    text: reply,
    why: because,
    causes: c.causes,
    steps: c.tryNow,
    stage: 0,
    service: 'hardware',
    brief,
  };
  return {
    reply,
    suggestions: chips.slice(0, 5),
    imageQuery: c.kbQuery,
    state: { ...state, flow: undefined, last },
    flow: true,
    topic: 'HARDWARE_REPAIR',
    trace: because,
  };
}

/* ------------------------------------------------------------------ project flow */

const KINDS: Array<{ val: ProjectKind; label: string; test: RegExp; noun: string }> = [
  { val: 'logo', label: 'Logo', test: /\b(logo|emblem|monogram|wordmark)\b/, noun: 'logo' },
  { val: 'brand', label: 'Brand identity', test: /\bbrand\w*|identity\b/, noun: 'brand identity' },
  { val: 'poster', label: 'Poster or flyer', test: /\b(poster|flyer|flier|banner|card|brochure|social|invitation)\b/, noun: 'poster / flyer' },
  { val: 'ui', label: 'App or web UI design', test: /\b(ui|ux|app|interface|figma|prototype|wireframe|mockup)\b/, noun: 'UI/UX design' },
  { val: 'website', label: 'Website', test: /\b(web\w*|site|store|shop|online)\b/, noun: 'website' },
  { val: 'embroidery', label: 'Embroidery file', test: /\b(embroid\w*|jef|dst|pes|stitch\w*|digiti\w*)\b/, noun: 'embroidery file' },
  { val: 'convert', label: 'File conversion', test: /\b(convert\w*|vector\w*|trace|resiz\w*|format)\b/, noun: 'file conversion' },
];

const STYLES = [
  { label: 'Modern & minimal', test: /\b(modern|minimal\w*|clean|simple|sleek)\b/, val: 'modern & minimal' },
  { label: 'Bold & colourful', test: /\b(bold|colou?rful|bright|vibrant|loud)\b/, val: 'bold & colourful' },
  { label: 'Classic & elegant', test: /\b(classic|elegant|luxur\w*|traditional|premium|formal)\b/, val: 'classic & elegant' },
  { label: 'Playful & friendly', test: /\b(playful|fun|friendly|cute|casual)\b/, val: 'playful & friendly' },
  { label: 'Not sure yet', test: /\b(not sure|dont know|idk|no idea|surprise|you decide|anything)\b/, val: 'open to suggestions' },
];

const DEADLINES = [
  { label: 'ASAP', test: /\b(asap|urgent\w*|now|today|tomorrow|rush|quick\w*|immediately|few days|2 days|two days|48)\b/, val: 'as soon as possible' },
  { label: 'This week', test: /\b(this week|week|7 days|seven days|few days)\b/, val: 'within the week' },
  { label: 'This month', test: /\b(month|weeks|two weeks|2 weeks|3 weeks|four weeks)\b/, val: 'within the month' },
  { label: 'Flexible', test: /\b(flexible|no rush|no hurry|whenever|not urgent|anytime|later|no deadline)\b/, val: 'flexible' },
];

const GOALS = [
  { label: 'Showcase my work', test: /\b(showcase|portfolio|display|present|gallery|information|info)\b/, val: 'showcase / portfolio' },
  { label: 'Sell products', test: /\b(sell\w*|shop|store|products?|e-?commerce|orders?|payments?)\b/, val: 'online shop' },
  { label: 'Bookings', test: /\b(book\w*|appointments?|schedul\w*|reserv\w*)\b/, val: 'bookings / appointments' },
  { label: 'Not sure yet', test: /\b(not sure|dont know|idk|no idea|help me decide)\b/, val: 'to be advised' },
];

function serviceFor(kind: ProjectKind) {
  if (kind === 'embroidery' || kind === 'convert') return { svc: SERVICES[3], key: 'assets' as const };
  if (kind === 'ui' || kind === 'website') return { svc: SERVICES[2], key: 'ui' as const };
  return { svc: SERVICES[1], key: 'design' as const };
}

function projectSteps(kind: ProjectKind | undefined): string[] {
  if (!kind) return ['kind', 'name', 'style', 'deadline'];
  if (kind === 'embroidery' || kind === 'convert') return ['name', 'details', 'deadline'];
  if (kind === 'website') return ['name', 'goal', 'style', 'deadline'];
  return ['name', 'style', 'deadline'];
}

function startProject(kind: ProjectKind | undefined, state: DialogueState, mode: PersonaMode, presetName?: string): DialogueOutput {
  const flow: ActiveFlow = { id: 'project', step: kind ? 'name' : 'kind', data: kind ? { kind } : {}, misses: 0, off: 0 };
  if (presetName) flow.data.name = presetName;
  const lead = empathy(state, mode);
  const intro = kind
    ? t(mode, `Love it — let’s scope your ${KINDS.find((k) => k.val === kind)?.noun || 'project'}. A few quick questions and I’ll put a brief together you can send straight to the owner.\n\n`, `BRIEF // ${kind}. Collecting parameters.\n`)
    : t(mode, 'Happy to help! A few quick questions and I’ll put together a brief you can send straight to the owner.\n\n', 'BRIEF // Collecting parameters.\n');
  return askProject({ ...flow }, { ...state, flow }, mode, lead + intro);
}

function askProject(flow: ActiveFlow, state: DialogueState, mode: PersonaMode, lead = ''): DialogueOutput {
  const kind = flow.data.kind as ProjectKind | undefined;
  // Find the first step still unanswered.
  const order = projectSteps(kind);
  const step = flow.data.kind ? order.find((s) => flow.data[s] === undefined) : 'kind';
  if (!step) return concludeProject(flow, state, mode);
  flow.step = step;
  flow.misses = 0;
  const noun = KINDS.find((k) => k.val === kind)?.noun || 'project';
  const idx = flow.data.kind ? order.indexOf(step) + 1 : 1;
  const tag = mode === 'EXPERT' ? `[${idx}/${order.length}] ` : `**Question ${idx} of ${order.length}** · `;
  let q = '';
  let chips: string[] = [];
  switch (step) {
    case 'kind':
      q = t(mode, 'What do you need made?', 'BRIEF // Deliverable type?');
      chips = KINDS.map((k) => k.label);
      break;
    case 'name':
      q = t(mode, `What’s the **name** of the business or project for this ${noun}? (Or say “skip”.)`, 'BRIEF // Project / business name?');
      break;
    case 'style':
      q = t(mode, 'What **style** are you going for?', 'BRIEF // Style direction?');
      chips = STYLES.map((s) => s.label);
      break;
    case 'goal':
      q = t(mode, 'What should the site **do** for you?', 'BRIEF // Site purpose?');
      chips = GOALS.map((s) => s.label);
      break;
    case 'details':
      q = t(mode, 'Tell me about the file: **what you have** and **what format you need** (for example “a JPG logo → clean SVG”, or “name list for .jef”).', 'BRIEF // Input file → required output format?');
      break;
    case 'deadline':
      q = t(mode, 'When do you need it by?', 'BRIEF // Deadline?');
      chips = DEADLINES.map((s) => s.label);
      break;
  }
  return { reply: `${lead}${tag}${q}`, suggestions: chips.length ? chips : ['Skip'], state: { ...state, flow }, flow: true, topic: 'DESIGN_BRANDING' };
}

function concludeProject(flow: ActiveFlow, state: DialogueState, mode: PersonaMode): DialogueOutput {
  const d = flow.data;
  const kind = (d.kind as ProjectKind) || 'logo';
  const kindInfo = KINDS.find((k) => k.val === kind)!;
  const { svc, key } = serviceFor(kind);
  const lines = [
    `**Project:** ${kindInfo.noun}`,
    d.name ? `**Name:** ${d.name}` : '',
    d.goal ? `**Purpose:** ${d.goal}` : '',
    d.style ? `**Style:** ${d.style}` : '',
    d.details ? `**Files:** ${d.details}` : '',
    d.pages ? `**Pages:** about ${d.pages}` : '',
    d.budget ? `**Budget:** ${d.budget}` : '',
    d.deadline ? `**Needed:** ${d.deadline}` : '',
  ].filter(Boolean);
  const plain = lines.map((l) => l.replace(/\*\*/g, ''));
  const rush = d.deadline === 'as soon as possible';
  const brief = [...plain, `Service: ${svc.title}`, state.ent.urgent || rush ? 'Urgent: yes' : ''].filter(Boolean).join('\n');

  const timeline = svc.timeline === 'Custom Scope' ? 'depends on scope — the owner will confirm after seeing your brief' : `typically **${svc.timeline}** (the owner confirms after seeing your brief)`;
  const reply =
    mode === 'EXPERT'
      ? `BRIEF_READY //\n${plain.join('\n')}\nSERVICE // ${svc.title} · ${svc.timeline}\nDELIVERABLES // ${svc.deliverables.join(', ')}\nNEXT // Dispatch brief to owner.`
      : `${empathy(state, mode)}**Here’s your brief** 🎯\n\n${lines.map((l) => `- ${l}`).join('\n')}\n\n` +
        `**What this usually includes** (${svc.title})\n${svc.deliverables.map((x) => `- ${x}`).join('\n')}\n\n` +
        `**Timeline:** ${timeline}.` +
        (rush ? '\n\nBecause you need it fast, mention the deadline when you send this — the owner can tell you what’s possible.' : '') +
        `\n\nI can't give an honest price from here — it depends on the scope — so the best next step is to send this brief to the owner for a quote. Shall I?`;

  const qp = flow.queuedProject;
  const qpNoun = qp ? KINDS.find((k) => k.val === qp)?.noun || 'project' : '';
  const queuedReply = qp ? (mode === 'EXPERT' ? `\nQUEUED // ${qpNoun} project` : `\n\nYou also mentioned a **${qpNoun}** — shall we scope that next?`) : '';
  const similar = key === 'design' ? 'Show branding projects' : kind === 'website' ? 'Show web projects' : kind === 'ui' ? 'Show UI/UX projects' : 'Show me your projects';
  return {
    reply: reply + queuedReply,
    suggestions: [...(qp ? [`Also: I need a ${qpNoun}`] : []), 'Send this brief to the owner', similar, 'How long will it take?', 'Start over'].slice(0, 5),
    state: { ...state, flow: undefined, last: { kind: 'project', text: reply, why: plain, service: key, brief, steps: svc.deliverables, stage: 0 } },
    flow: true,
    topic: kind === 'website' || kind === 'ui' ? 'WEB_DEV' : 'DESIGN_BRANDING',
    trace: plain,
  };
}

/* ------------------------------------------------------------------ decide flow (repair vs replace) */

const AGES = [
  { label: 'Under 2 years', test: /\b(under|less|new|recent\w*|1|one|month\w*|bought)\b/, val: 'new' },
  { label: '2–4 years', test: /\b(2|3|4|two|three|four|couple|few)\b/, val: 'mid' },
  { label: '5+ years', test: /\b(5|6|7|8|9|10|five|six|seven|old|ancient|ages|many)\b/, val: 'old' },
];
const ISSUES = [
  { label: 'Screen', test: /\b(screen|display|crack\w*|touch|glass)\b/, val: 'screen' },
  { label: 'Battery or charging', test: /\b(batter\w*|charg\w*|port)\b/, val: 'battery' },
  { label: 'Water damage', test: /\b(water|liquid|spill\w*|wet)\b/, val: 'water' },
  { label: 'Won’t turn on / board', test: /\b(turn on|power|dead|board|motherboard|boot)\b/, val: 'board' },
  { label: 'Slow', test: /\b(slow|lag\w*|freez\w*|performance)\b/, val: 'slow' },
];
const PREFS = [
  { label: 'Spend as little as possible', test: /\b(little|cheap\w*|budget|save|less|minimum|tight)\b/, val: 'cheap' },
  { label: 'Make it last', test: /\b(last|long|years|reliable|best|durable|future)\b/, val: 'long' },
];

function startDecide(state: DialogueState, mode: PersonaMode): DialogueOutput {
  const flow: ActiveFlow = { id: 'decide', step: state.ent.device ? 'age' : 'device', data: {}, misses: 0, off: 0 };
  const lead = t(mode, `${empathy(state, mode)}Good question — repair or replace depends on age, the fault and what you want from it. Let me ask a few things.\n\n`, 'DECIDE // Repair vs replace. Collecting parameters.\n');
  return askDecide(flow, state, mode, lead);
}

function askDecide(flow: ActiveFlow, state: DialogueState, mode: PersonaMode, lead = ''): DialogueOutput {
  const order = ['device', 'age', 'issue', 'pref'];
  const need = order.find((s) => (s === 'device' ? !state.ent.device : flow.data[s] === undefined));
  if (!need) return concludeDecide(flow, state, mode);
  flow.step = need;
  flow.misses = 0;
  let q = '';
  let chips: string[] = [];
  if (need === 'device') {
    q = t(mode, 'What device is it?', 'DECIDE // Device class?');
    chips = DEVICE_CHOICES.map((d) => d.label);
  } else if (need === 'age') {
    q = t(mode, 'How **old** is it?', 'DECIDE // Age?');
    chips = AGES.map((a) => a.label);
  } else if (need === 'issue') {
    q = t(mode, 'What’s the main **problem**?', 'DECIDE // Primary fault?');
    chips = ISSUES.map((a) => a.label);
  } else {
    q = t(mode, 'What matters more to you?', 'DECIDE // Priority?');
    chips = PREFS.map((a) => a.label);
  }
  return { reply: `${lead}${q}`, suggestions: chips, state: { ...state, flow }, flow: true, topic: 'HARDWARE_REPAIR' };
}

function concludeDecide(flow: ActiveFlow, state: DialogueState, mode: PersonaMode): DialogueOutput {
  const d = flow.data;
  const dev = state.ent.device;
  const isComputer = dev === 'laptop' || dev === 'desktop' || dev === 'pc';
  const reasons: string[] = [];
  let score = 0;
  if (d.age === 'old') { score += 2; reasons.push('At 5+ years, parts are harder to match and the next failure is closer.'); }
  else if (d.age === 'mid') { score += 1; reasons.push('At 2–4 years, there’s usually still plenty of life left.'); }
  else if (d.age === 'new') { reasons.push('A newer device keeps most of its value, so repair is rarely a waste.'); }
  if (d.issue === 'board' || d.issue === 'water') { score += 2; reasons.push(d.issue === 'water' ? 'Liquid damage can keep spreading, and board repairs are the least predictable.' : 'Board-level faults are the costliest and hardest to promise.'); }
  if (d.issue === 'battery') { score -= 1; reasons.push('Batteries and charging ports are routine, comparatively cheap repairs.'); }
  if (d.issue === 'screen') { reasons.push('A screen swap is a straightforward repair — worth it unless the device is old and cheap.'); if (d.age === 'old') score += 1; }
  if (d.issue === 'slow') {
    if (isComputer) { score -= 1; reasons.push('Slowness on a computer is often fixed by an SSD or more RAM — far cheaper than replacing.'); }
    else { score += 1; reasons.push('A slow older phone usually means a worn battery plus software it can no longer keep up with.'); }
  }
  if (d.pref === 'cheap') { score -= 1; reasons.push('You want to spend as little as possible, which favours a repair.'); }
  if (d.pref === 'long') { score += 1; reasons.push('You want it to last, which leans towards newer hardware.'); }

  let verdict: string;
  let tone: 'repair' | 'replace' | 'borderline';
  if (score >= 3) { verdict = 'Replacing likely makes more sense'; tone = 'replace'; }
  else if (score <= 0) { verdict = 'Repair is probably the better value'; tone = 'repair'; }
  else { verdict = 'It’s borderline — get a repair quote before deciding'; tone = 'borderline'; }

  const label = deviceLabel(state.ent);
  const rule = 'Rule of thumb: if the repair quote is **more than about half** the price of a comparable replacement, replacing usually wins.';
  const dataNote = 'Either way, **back up your data first** — and if the device is dead, say so and I can flag data recovery.';
  const reply =
    mode === 'EXPERT'
      ? `DECIDE_RESULT // ${verdict}\nFACTORS // ${reasons.join(' | ')}\nRULE // Quote > ~50% of replacement cost -> replace.\nNEXT // Obtain quote.`
      : `**My take on your ${label}: ${verdict}.**\n\n**Why**\n${reasons.map((r) => `- ${r}`).join('\n')}\n\n${rule}\n\n${dataNote}\n\nWant me to send the details to the owner so you get a real quote to compare?`;
  const brief = `Question: repair or replace?\nDevice: ${label}\nAge: ${AGES.find((a) => a.val === d.age)?.label || 'unknown'}\nMain problem: ${ISSUES.find((a) => a.val === d.issue)?.label || 'unknown'}\nPriority: ${PREFS.find((a) => a.val === d.pref)?.label || 'unknown'}\nMy view: ${verdict}`;
  return {
    reply,
    suggestions: ['Send this to the owner', 'Why do you say that?', 'Book a repair'],
    state: { ...state, flow: undefined, last: { kind: 'decision', text: reply, why: reasons, brief, service: 'hardware', steps: [rule], stage: 0 } },
    flow: true,
    topic: 'HARDWARE_REPAIR',
    trace: reasons,
  };
}

/* ------------------------------------------------------------------ quote flow */

function startQuote(state: DialogueState, mode: PersonaMode): DialogueOutput {
  const flow: ActiveFlow = { id: 'quote', step: 'what', data: {}, misses: 0, off: 0 };
  return {
    reply: t(mode, `${empathy(state, mode)}Happy to help you get a quote. What is it for?`, 'QUOTE // Select category.'),
    suggestions: ['A repair', 'A design', 'A website'],
    state: { ...state, flow },
    flow: true,
    topic: 'PRICING_RATES',
  };
}

/* ------------------------------------------------------------------ active-flow engine */

function handleActive(raw: string, n: string, state: DialogueState, mode: PersonaMode): DialogueOutput | null {
  const flow = clone(state.flow!);
  const ent = state.ent;

  if (CANCEL.test(n)) {
    return { reply: t(mode, 'No problem — I’ve dropped that. 👍 Ask me anything else, or start again whenever you like.', 'FLOW // Cancelled.'), suggestions: ['My device is not working', 'I need a logo', 'Show me your projects'], state: { ...state, flow: undefined }, flow: true };
  }
  if (RESTART.test(n)) {
    if (flow.id === 'diagnose') return startDiagnose(flow.data.symptom as SymptomId, { ...state, flow: undefined }, mode, flow.data.intent === 'quote' ? 'quote' : undefined);
    if (flow.id === 'project') return startProject(undefined, { ...state, flow: undefined }, mode);
    if (flow.id === 'decide') return startDecide({ ...state, flow: undefined }, mode);
    return startQuote({ ...state, flow: undefined }, mode);
  }
  if (CONTINUE.test(n)) return reAsk(flow, state, mode);
  if (CONCLUDE_NOW.test(n) || (flow.id === 'diagnose' && flow.step !== 'device' && /^(what (do|should) i do (first|now|next)|what first|first step|where do i start|what now|what next|what should i try|so what do i do|what do i try first|best guess|what is your best guess|whats your best guess)\b/.test(n))) {
    if (flow.id === 'diagnose') return concludeDiagnosis(flow, state, mode);
    if (flow.id === 'project') return concludeProject(flow, state, mode);
    if (flow.id === 'decide') return concludeDecide(flow, state, mode);
  }
  if (BACK.test(n)) return stepBack(flow, state, mode);

  switch (flow.id) {
    case 'diagnose':
      return diagnoseAnswer(raw, n, flow, state, mode);
    case 'project':
      return projectAnswer(raw, n, flow, state, mode);
    case 'decide':
      return decideAnswer(raw, n, flow, state, mode);
    case 'quote':
      return quoteAnswer(raw, n, flow, state, mode);
  }
  void ent;
  return null;
}

function reAsk(flow: ActiveFlow, state: DialogueState, mode: PersonaMode): DialogueOutput {
  flow.off = 0;
  const lead = t(mode, 'Picking up where we left off — ', 'RESUME // ');
  if (flow.id === 'diagnose') return flow.step === 'device' ? askDevice(flow, state, mode, lead) : askQuestion(flow, state, mode, lead);
  if (flow.id === 'project') return askProject(flow, state, mode, lead);
  if (flow.id === 'decide') return askDecide(flow, state, mode, lead);
  return startQuote({ ...state, flow: undefined }, mode);
}

function stepBack(flow: ActiveFlow, state: DialogueState, mode: PersonaMode): DialogueOutput {
  const lead = t(mode, 'Sure — ', 'BACK // ');
  if (flow.id === 'diagnose') {
    const symptom = flow.data.symptom as SymptomId;
    const answered = TREES[symptom].questions.filter((q) => flow.data[q.id] !== undefined);
    const lastQ = answered[answered.length - 1];
    if (lastQ) delete flow.data[lastQ.id];
    return askQuestion(flow, state, mode, lead);
  }
  if (flow.id === 'project') {
    const order = projectSteps(flow.data.kind as ProjectKind | undefined);
    const done = order.filter((s) => flow.data[s] !== undefined);
    const last = done[done.length - 1];
    if (last) delete flow.data[last];
    else delete flow.data.kind;
    return askProject(flow, state, mode, lead);
  }
  if (flow.id === 'decide') {
    const done = ['age', 'issue', 'pref'].filter((s) => flow.data[s] !== undefined);
    const last = done[done.length - 1];
    if (last) delete flow.data[last];
    return askDecide(flow, state, mode, lead);
  }
  return startQuote({ ...state, flow: undefined }, mode);
}

function rephrase(flow: ActiveFlow, state: DialogueState, mode: PersonaMode, again: (lead: string) => DialogueOutput): DialogueOutput {
  // Every ask*() resets the miss counter for a fresh question; re-asking the SAME question must keep it,
  // otherwise "after a second miss, move on" can never trigger and the flow loops forever.
  const misses = flow.misses + 1;
  const out = again(t(mode, misses > 1 ? 'Let me make it easier — ' : 'I want to be sure I get this right — ', 'CLARIFY // '));
  const f = out.state.flow || flow;
  f.misses = misses;
  return out;
}

/** The message gave useful details but not the answer: take them in (already merged by observe()) and re-ask, at most twice. */
function takeInfo(flow: ActiveFlow, mode: PersonaMode, again: (lead: string) => DialogueOutput, what = '', raw = ''): DialogueOutput | null {
  if ((flow.info || 0) >= 2) return null;
  const misses = flow.misses;
  // Keep what they said as a note for the owner; name the device only the first time.
  if (raw) flow.data.note = ((flow.data.note ? flow.data.note + '; ' : '') + raw.slice(0, 100)).slice(0, 300);
  const out = again(t(mode, what && !flow.info ? `Noted — ${what}. ` : 'Noted, thanks. ', 'NOTED // '));
  const f = out.state.flow || flow;
  f.misses = misses;
  f.info = (flow.info || 0) + 1;
  return out;
}

/** Messages that are clearly a different question: leave them to the rest of the pipeline. */
function isOffTopic(raw: string, n: string): boolean {
  return LOOKS_LIKE_QUESTION.test(n) || /\?/.test(raw) || n.split(' ').length > 14;
}

function diagnoseAnswer(raw: string, n: string, flow: ActiveFlow, state: DialogueState, mode: PersonaMode): DialogueOutput | null {
  const symptom = flow.data.symptom as SymptomId;

  if (flow.step === 'device') {
    const choice = matchOpt(DEVICE_CHOICES.map((d) => ({ ...d })), n, raw);
    if (choice) {
      const ent = { ...state.ent, device: choice.val };
      return askQuestion(flow, { ...state, ent }, mode, t(mode, `Thanks — a ${choice.label.toLowerCase()}. `, ''));
    }
    if (isOffTopic(raw, n)) return null;
    if (SKIP.test(n) || flow.misses >= 1) return askQuestion(flow, state, mode);
    return rephrase(flow, state, mode, (lead) => askDevice(flow, state, mode, lead));
  }

  const qid = flow.step.replace(/^q:/, '');
  const q = TREES[symptom].questions.find((x) => x.id === qid);
  if (!q) return askQuestion(flow, state, mode);

  const opt = matchOpt(q.opts, n, raw);
  if (opt && !SKIP.test(n)) {
    flow.data[q.id] = opt.val;
    return askQuestion(flow, state, mode, mode === 'EXPERT' ? '' : ack(opt.label));
  }
  if (SKIP.test(n)) {
    flow.data[q.id] = 'unsure';
    return askQuestion(flow, state, mode, t(mode, 'No worries. ', ''));
  }

  // A design/web request made while troubleshooting: remember it, finish the repair first.
  const projMid = flow.id === 'diagnose' ? detectProject(n) : undefined;
  if (projMid && PROJECT_INTENT.test(n) && !PRICE_Q.test(n)) {
    flow.queuedProject = projMid;
    const noun = KINDS.find((k) => k.val === projMid)?.noun || 'project';
    return askQuestion(flow, state, mode, t(mode, `Noted — I’ll come back to your **${noun}** after this. `, `QUEUED // ${noun} project\n`));
  }

  // A different problem mentioned mid-flow: urgent safety ones restart, others are queued.
  const other = detectSymptom(n);
  if (other && other !== symptom && !isOffTopic(raw, n)) {
    if (other === 'water') return startDiagnose('water', state, mode);
    flow.queued = other;
    return askQuestion(flow, state, mode, t(mode, `Noted — I’ll come back to the **${SYMPTOM_LABEL[other]}** after this. `, `QUEUED // ${SYMPTOM_LABEL[other]}\n`));
  }
  if (isOffTopic(raw, n)) return null;

  // Details without an answer ("it's a Dell"): take them in and ask again, without counting a miss.
  if (carriesInfo(n)) {
    const noted = takeInfo(flow, mode, (lead) => askQuestion(flow, state, mode, lead), deviceLabel(state.ent) !== 'device' && state.ent.brand ? deviceLabel(state.ent) : '', raw);
    if (noted) return noted;
  }

  // Free text we can't map to an option: keep it as a note and, after a second miss, move on.
  if (flow.misses >= 1) {
    flow.data[q.id] = 'unsure';
    flow.data.note = (flow.data.note ? flow.data.note + '; ' : '') + raw.slice(0, 120);
    return askQuestion(flow, state, mode, t(mode, 'Got it, thanks. ', ''));
  }
  return rephrase(flow, state, mode, (lead) => askQuestion(flow, state, mode, lead));
}

const ACKS = ['Got it. ', 'Thanks. ', 'Okay. ', 'Understood. ', 'That helps. '];
let ackIdx = 0;
function ack(label: string): string {
  void label;
  ackIdx = (ackIdx + 1) % ACKS.length;
  return ACKS[ackIdx];
}

/** Pull page counts and budgets out of free text whatever question is being asked ("about 5 pages", "budget is 500k ugx"). */
function harvestProject(flow: ActiveFlow, raw: string, n: string): { found: string[]; only: boolean } {
  const found: string[] = [];
  const pg = /\b(?:about |around |roughly |maybe )?(\d{1,3})\s*(?:pages?|screens?)\b/.exec(n);
  if (pg) {
    flow.data.pages = pg[1];
    found.push(`${pg[1]} pages`);
  }
  const bud = /\b(?:budget|spend|afford|pay|payment|around|about|up to|max(?:imum)?)\b[^0-9]{0,18}((?:ugx|shs|usd|\$)?\s?\d[\d,.]*\s?(?:k|m|million|thousand)?\s?(?:ugx|shs|usd|dollars)?)/.exec(n) || /\b((?:ugx|shs|usd|\$)\s?\d[\d,.]*\s?(?:k|m)?|\d[\d,.]*\s?(?:k|m|million|thousand)?\s?(?:ugx|shs|usd|dollars))\b/.exec(n);
  if (bud && /\d/.test(bud[1]) && (/(budget|ugx|shs|usd|dollars|\$|afford|spend)/.test(n))) {
    flow.data.budget = bud[1].trim().toUpperCase();
    found.push(`budget ${flow.data.budget}`);
  }
  // "Only" when nothing else of substance is in the message.
  const rest = n.replace(/\b(about|around|roughly|maybe|pages?|screens?|budget|is|are|its|it|of|my|our|the|a|an|for|i|have|has|ugx|shs|usd|dollars|k|m|million|thousand|around|up|to|max|maximum|spend|can|afford|pay)\b|[0-9.,$]+/g, '').replace(/\s+/g, ' ').trim();
  return { found, only: found.length > 0 && rest.length < 3 };
}

function projectAnswer(raw: string, n: string, flow: ActiveFlow, state: DialogueState, mode: PersonaMode): DialogueOutput | null {
  const step = flow.step;
  const again = (lead: string) => askProject(flow, state, mode, lead);

  const slots = step === 'kind' ? { found: [] as string[], only: false } : harvestProject(flow, raw, n);
  if (slots.only) {
    const misses = flow.misses;
    const out = again(t(mode, `Noted — ${slots.found.join(', ')}. `, `NOTED // ${slots.found.join(', ')}\n`));
    (out.state.flow || flow).misses = misses;
    return out;
  }

  if (step === 'kind') {
    const k = KINDS.find((x) => x.label.toLowerCase() === raw.trim().toLowerCase()) || KINDS.find((x) => x.test.test(n));
    if (k) {
      flow.data.kind = k.val;
      return askProject(flow, state, mode, t(mode, `Great — a ${k.noun}. `, ''));
    }
    if (isOffTopic(raw, n)) return null;
    return rephrase(flow, state, mode, again);
  }

  if (SKIP.test(n)) {
    flow.data[step] = '';
    return askProject(flow, state, mode);
  }

  if (step === 'name' || step === 'details') {
    if (isOffTopic(raw, n) && step === 'name') return null;
    if (raw.trim().length > (step === 'name' ? 70 : 220)) return rephrase(flow, state, mode, (lead) => askProject(flow, state, mode, lead + t(mode, 'Could you keep it shorter? ', '')));
    // "Logo" / "website" / "skip" is not a business name: treat a bare project word as no answer.
    const generic = SKIP.test(n) || (step === 'name' && !!detectProject(n) && n.split(' ').length <= 2);
    if (generic) flow.data[step] = '';
    else flow.data[step] = raw.trim();
    return askProject(flow, state, mode, generic ? t(mode, 'No problem. ', '') : t(mode, 'Nice. ', ''));
  }

  const list = step === 'style' ? STYLES : step === 'goal' ? GOALS : DEADLINES;
  const hit = matchOpt(list, n, raw);
  if (hit) {
    flow.data[step] = hit.val;
    return askProject(flow, state, mode, ack(hit.label));
  }
  if (isOffTopic(raw, n)) return null;
  // Free text is fine for style/goal; deadlines need a hint of time.
  if ((step === 'style' || step === 'goal') && raw.trim().length <= 80) {
    flow.data[step] = raw.trim();
    return askProject(flow, state, mode, ack(raw));
  }
  if (step === 'deadline' && /\b(\d+|day|days|week|weeks|month|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(n) && raw.trim().length <= 60) {
    flow.data[step] = raw.trim();
    return askProject(flow, state, mode, ack(raw));
  }
  if (flow.misses >= 1) {
    flow.data[step] = step === 'deadline' ? 'flexible' : 'open to suggestions';
    return askProject(flow, state, mode);
  }
  return rephrase(flow, state, mode, again);
}

function decideAnswer(raw: string, n: string, flow: ActiveFlow, state: DialogueState, mode: PersonaMode): DialogueOutput | null {
  const step = flow.step;
  const again = (lead: string) => askDecide(flow, state, mode, lead);
  if (step === 'device') {
    const c = matchOpt(DEVICE_CHOICES.map((d) => ({ ...d })), n, raw);
    if (c) return askDecide(flow, { ...state, ent: { ...state.ent, device: c.val } }, mode, ack(c.label));
    if (isOffTopic(raw, n)) return null;
    return rephrase(flow, state, mode, again);
  }
  const list = step === 'age' ? AGES : step === 'issue' ? ISSUES : PREFS;
  let hit = matchOpt(list, n, raw);
  // "my Galaxy S21 screen cracked": answer "how old is it?" from the model's release year.
  if (!hit && step === 'age') {
    const yr = modelYear(n) ?? modelYear(`${state.ent.model || ''} ${state.ent.brand || ''}`.toLowerCase());
    if (yr) {
      const age = new Date().getFullYear() - yr;
      hit = age < 2 ? AGES[0] : age < 5 ? AGES[1] : AGES[2];
      flow.data[step] = hit.val;
      return askDecide(flow, state, mode, t(mode, `A ${state.ent.model || 'phone from ' + yr} is roughly ${age} year${age === 1 ? '' : 's'} old — I'll count it as **${hit.label}**. `, `AGE // ~${age}y\n`));
    }
  }
  if (hit) {
    flow.data[step] = hit.val;
    return askDecide(flow, state, mode, ack(hit.label));
  }
  if (SKIP.test(n) || flow.misses >= 1) {
    flow.data[step] = 'unknown';
    return askDecide(flow, state, mode);
  }
  if (isOffTopic(raw, n)) return null;
  if (carriesInfo(n)) {
    const noted = takeInfo(flow, mode, again, '', raw);
    if (noted) return noted;
  }
  return rephrase(flow, state, mode, again);
}

function quoteAnswer(raw: string, n: string, flow: ActiveFlow, state: DialogueState, mode: PersonaMode): DialogueOutput | null {
  const wantsRepair = /\b(repair|fix|phone|laptop|pc|device|screen|battery|computer)\b/.test(n);
  const wantsDesign = /\b(design|logo|brand\w*|poster|flyer|ui|ux|graphic)\b/.test(n);
  const wantsWeb = /\b(web\w*|site|app|store|shop)\b/.test(n);
  const st = { ...state, flow: undefined };
  if (wantsRepair) {
    const sym = state.ent.symptom;
    if (sym) return startDiagnose(sym, st, mode, 'quote');
    // No symptom yet: ask what is wrong in the next turn through a diagnose-style prompt.
    return { reply: t(mode, 'Okay — a repair quote. Tell me **the device and what it’s doing** (for example “my Samsung won’t charge”) and I’ll gather the details for the owner.', 'QUOTE // Provide device + symptom.'), suggestions: ["My phone won't charge", 'My laptop is slow', 'My screen is cracked'], state: st, flow: true, topic: 'PRICING_RATES' };
  }
  if (wantsDesign) return startProject(detectProject(n) || undefined, st, mode);
  if (wantsWeb) return startProject('website', st, mode);
  if (isOffTopic(raw, n)) return null;
  flow.misses += 1;
  if (flow.misses > 1) return { reply: t(mode, 'No problem — you can also open the contact form and describe it there.', 'QUOTE // Use contact form.'), suggestions: ['Open contact page'], state: st, flow: true };
  return { reply: t(mode, 'Is it for a **repair**, a **design**, or a **website**?', 'QUOTE // [REPAIR] [DESIGN] [WEB]?'), suggestions: ['A repair', 'A design', 'A website'], state: { ...state, flow }, flow: true };
}

/* ------------------------------------------------------------------ follow-ups using what was just said */

const WHY = /^(why|why so|why is that|why do you say that|why did you say that|how come|how do you know|what makes you say that|what is your reasoning|how did you get (that|there)|explain (that|why|your reasoning)|whats your reasoning|reasoning|show (your )?reasoning|really)$/;
const HOW_LONG = /^(how long( will (it|this) take)?|how many days|how soon|when (will|can) (it|i)|turnaround|time ?frame|timeline|how fast|how quickly|when would it be ready)\b/;
const HOW_MUCH = /^(how much( will (it|this) (cost|be))?|what will it cost|what does (it|this) cost|price|cost|how expensive|is it expensive|what (are|is) the (price|cost|rate))\b/;
const FIRST_STEP = /^(what (do|should) i do (first|now|next)|what first|first step|where do i start|what now|what next|what should i try|so what do i do|what do i try first)\b/;
const DIDNT_WORK = /^(that )?(didnt|did not|doesnt|does not|still|it didnt|no luck|not working|same|nothing changed|already tried|i tried that|tried that|tried it|no change)\b.{0,40}$/;
const MORE = /^(more|tell me more|go on|elaborate|explain more|more details?|in detail|more info|expand|and then|what else)\b/;
const SIMPLER = /^(simpler|simple|eli5|explain (it )?(simply|like (im|i am) 5)|shorter|tldr|tl;?dr|in short|too long|summar\w* (that|it)|make it shorter|short version|briefly)\b/;
const RECAP = /\b(recap|summar(y|ize|ise) (of )?(our )?(chat|conversation|discussion|everything)( so far)?|what have we (covered|discussed|talked about)|what did (i|we) (say|talk about|discuss)|where were we|remind me)\b/;
const MY_NAME = /\b(what('?s| is) my name|do you (know|remember) my name|who am i)\b/;
const MY_DEVICE = /\b(what (device|phone|laptop|computer|pc) do i have|which (device|phone|laptop) (is it|do i have)|what did i say (it|my \w+) (was|is))\b/;
const WRONG = /^(thats|that is|youre|you are|this is) (wrong|incorrect|not (right|helpful|what i (asked|meant|wanted)))|^(wrong|incorrect|not what i asked|you didnt answer|you dont understand|that doesnt help|useless|not helpful|that is not what i asked)$/;

function firstSentences(text: string, count: number): string {
  // Skip an introductory header line ("Here's the closest thing I know about — x:") so the summary is the substance.
  const lines = text.split('\n');
  if (lines.length > 1 && /:\s*$/.test(lines[0].trim())) text = lines.slice(1).join('\n');
  const plain = text.replace(/\*\*/g, '').replace(/^[-•\d.\s]+/gm, '').replace(/\n+/g, ' ').trim().replace(/\s{2,}/g, ' ');
  const parts = plain.match(/[^.!?]+[.!?]+/g) || [plain];
  return parts.slice(0, count).join(' ').trim();
}

const TIMELINE: Record<string, { label: string; svc: number }> = {
  hardware: { label: 'repairs', svc: 0 },
  design: { label: 'design work', svc: 1 },
  ui: { label: 'web and UI work', svc: 2 },
  assets: { label: 'file conversion and embroidery files', svc: 3 },
};

export interface FollowUpHooks {
  /** Looks up a knowledge entry by id (kept out of this module to avoid a dependency cycle). */
  entryById?: (id: string) => { title: string; content: string; reply: string; expert: string; suggestions?: string[] } | undefined;
  name?: string;
}

function followUp(raw: string, n: string, state: DialogueState, mode: PersonaMode, hooks: FollowUpHooks): DialogueOutput | null {
  const last = state.last;
  const ent = state.ent;
  const out = (reply: string, suggestions?: string[], more: Partial<DialogueOutput> = {}): DialogueOutput => ({ reply, suggestions, state, flow: false, ...more });

  if (WRONG.test(n)) {
    return out(
      t(mode, "I'm sorry about that — let me try again. Could you tell me a little more: **what device or project** is it, and **what exactly is happening**? Or I can pass your message to the owner directly.", 'FEEDBACK // Mismatch. Provide device + symptom, or dispatch to owner.'),
      ['Send this to the owner', 'My device is not working', 'I need a design'],
      { handoffNote: undefined }
    );
  }

  if (MY_NAME.test(n)) {
    const name = hooks.name;
    return out(name ? t(mode, `You're **${name}** — nice to talk with you again. 😊`, `OPERATOR // ${name}`) : t(mode, "I don't know your name yet — tell me with “my name is …” and I'll remember it for this chat.", 'OPERATOR // Alias not set.'));
  }
  if (MY_DEVICE.test(n)) {
    return out(ent.device || ent.brand ? t(mode, `You've mentioned a **${deviceLabel(ent)}**${ent.symptom ? ` with a problem: ${SYMPTOM_LABEL[ent.symptom]}` : ''}.`, `CONTEXT // ${deviceLabel(ent)}`) : t(mode, "You haven't told me yet — what device is it?", 'CONTEXT // Device unknown.'), ent.device ? undefined : DEVICE_CHOICES.map((d) => d.label));
  }

  if (RECAP.test(n)) return out(recap(state, mode), ['Send this to the owner', 'Continue']);

  if (!last) return null;

  if (WHY.test(n) && last.why?.length) {
    const body = last.why.map((w) => `- ${w}`).join('\n');
    return out(
      t(mode, `Here's how I got there:\n${body}\n\nIt's a best guess from what you've told me — if something doesn't fit, correct me and I'll rethink it.`, `REASONING //\n${last.why.join('\n')}`),
      last.kind === 'diagnosis' ? ['Send this to the owner', 'What if that doesn’t work?', 'Book a repair'] : ['Send this to the owner', 'Tell me more']
    );
  }
  if (WHY.test(n) && last.kind === 'kb') {
    return out(t(mode, "That answer comes from the built-in knowledge about this site's services. If it doesn't fit your situation, tell me more and I'll narrow it down — or I can pass your question to the owner.", 'SOURCE // Built-in knowledge base.'), ['Send this to the owner', 'Tell me more']);
  }

  if (HOW_LONG.test(n) && last.service) {
    const tl = TIMELINE[last.service];
    const svc = SERVICES[tl.svc];
    const custom = svc.timeline === 'Custom Scope';
    return out(
      t(mode, custom ? `For ${tl.label} the timeline depends on scope — the owner will give you a date once they've seen the brief. 🗓️` : `For ${tl.label} the usual turnaround is **${svc.timeline}**. It can be longer if a part has to be ordered or the job is complex, and the owner will confirm once they've seen the details.`, `ETA // ${svc.timeline}. Owner confirms.`),
      ['Send this to the owner', last.kind === 'diagnosis' ? 'Book a repair' : 'Show me your projects']
    );
  }
  if (HOW_MUCH.test(n) && (last.kind === 'diagnosis' || last.kind === 'project' || last.kind === 'decision')) {
    return out(
      t(mode, "I can't give an honest price from here — it depends on the exact model, the part and what the owner finds on inspection, so I won't guess a number. 🙂 The quickest way to a real quote is to send what we've worked out; it saves them asking the same questions again.", 'PRICE // Not estimable remotely. Dispatch details for a quote.'),
      ['Send this to the owner', 'Open contact page']
    );
  }
  if (FIRST_STEP.test(n) && last.steps?.length) {
    return out(t(mode, `Start with this: **${last.steps[0].replace(/\*\*/g, '')}**\n\nTell me what happens and I'll help with the next step.`, `STEP_1 // ${last.steps[0].replace(/\*\*/g, '')}`), ["That didn't work", 'Why do you say that?', 'Send this to the owner']);
  }
  if (last.kind === 'diagnosis' && last.causes && (DIDNT_WORK.test(n) || /^what if (that|it) (doesnt|didnt|does not|did not) work\b/.test(n))) {
    const stage = (last.stage ?? 0) + 1;
    const next = last.causes[stage];
    const stepsLeft = last.steps && last.steps[stage];
    const newLast = { ...last, stage };
    if (next) {
      return out(
        t(mode, `Thanks for trying it — that rules the first idea down. The next most likely cause is **${next.name}** — ${next.why}${stepsLeft ? `\n\nNext thing to try: ${stepsLeft}` : ''}\n\nIf that doesn't help either, it's time for a hands-on check.`, `NEXT_CAUSE // ${next.name}${stepsLeft ? ` | ${stepsLeft.replace(/\*\*/g, '')}` : ''}`),
        ['That didn’t work either', 'Book a repair', 'Send this to the owner'],
        { state: { ...state, last: newLast } }
      );
    }
    return out(
      t(mode, "That's the end of what I can safely try from here — so it likely needs a hands-on check. 🔧 I can send the details to the owner (including what you've already tried) so they can pick it up quickly.", 'ESCALATE // Remote options exhausted. Dispatch to owner.'),
      ['Send this to the owner', 'Book a repair'],
      { state: { ...state, last: { ...last, stage } } }
    );
  }

  if (MORE.test(n)) {
    if (last.kind === 'kb' && last.entryId && hooks.entryById) {
      const e = hooks.entryById(last.entryId);
      if (e) return out(t(mode, `Here's more on **${e.title.toLowerCase()}**:\n\n${e.content}`, `DETAIL // ${e.title}\n${e.content}`), e.suggestions);
    }
    if (last.kind === 'diagnosis' && last.causes) {
      return out(t(mode, `Here's the detail behind each possibility:\n\n${last.causes.map((c, i) => `${i + 1}. **${c.name}** — ${c.why}`).join('\n')}`, `DETAIL //\n${last.causes.map((c, i) => `${i + 1}) ${c.name}: ${c.why}`).join('\n')}`), ['Send this to the owner', 'Why do you say that?']);
    }
    if (last.kind === 'project' && last.steps) {
      return out(t(mode, `What's usually included:\n${last.steps.map((s) => `- ${s}`).join('\n')}`, `DELIVERABLES //\n${last.steps.join('\n')}`), ['Send this brief to the owner', 'How long will it take?']);
    }
  }

  if (SIMPLER.test(n) && last.text) {
    const oneLine = /\b(one|1) (line|sentence)\b|\bin a (line|sentence)\b|\bshort(est)?\b|\bbriefly\b/.test(n);
    const short = oneLine ? firstSentences(last.text, 1).slice(0, 200) : firstSentences(last.text, 2);
    if (short) return out(t(mode, `The short version: ${short}\n\nSay **more** if you want the full detail.`, `TLDR // ${short}`), ['More', 'Send this to the owner']);
  }

  return null;
}

function recap(state: DialogueState, mode: PersonaMode): string {
  const e = state.ent;
  const bits: string[] = [];
  if (e.device || e.brand || e.model) bits.push(`Device: ${deviceLabel(e)}`);
  if (e.symptom) bits.push(`Problem: ${SYMPTOM_LABEL[e.symptom]}`);
  if (e.project) bits.push(`Project: ${KINDS.find((k) => k.val === e.project)?.noun || e.project}`);
  if (e.urgent) bits.push('Urgency: you need it soon');
  if (e.dataAtRisk) bits.push('Your data matters');
  const l = state.last;
  if (l?.kind === 'diagnosis' && l.causes?.[0]) bits.push(`My best guess: ${l.causes[0].name}`);
  if (l?.kind === 'decision') bits.push('We compared repair vs replace');
  if (l?.kind === 'project') bits.push('We drafted a project brief');
  if (state.flow) bits.push(`We're partway through a ${state.flow.id === 'diagnose' ? 'diagnosis' : state.flow.id === 'project' ? 'project brief' : state.flow.id === 'decide' ? 'repair-or-replace check' : 'quote request'} — say “continue” to pick it back up`);
  if (!bits.length) return t(mode, "We haven't covered much yet — tell me what you need (a repair, a design or a website) and I'll take it from there.", 'RECAP // No context yet.');
  return t(mode, `Here's where we are:\n${bits.map((b) => `- ${b}`).join('\n')}`, `RECAP //\n${bits.join('\n')}`);
}

/* ------------------------------------------------------------------ entry points */

/**
 * Called when the visitor's message exactly equals one of the buttons of the current step
 * ("Laptop", "Not sure", "ASAP"...). Handled before site commands so a button like "Website" is
 * never mistaken for a navigation request.
 */
export function answerChip(raw: string, mode: PersonaMode, state: DialogueState): DialogueOutput | null {
  if (!state.flow) return null;
  const lower = raw.trim().toLowerCase();
  const labels = currentLabels(state.flow);
  if (!labels.includes(lower) && lower !== 'continue' && lower !== 'start over') return null;
  return handleActive(raw, norm(raw), state, mode);
}

function currentLabels(flow: ActiveFlow): string[] {
  const all: string[] = ['not sure', 'skip'];
  if (flow.id === 'diagnose') {
    if (flow.step === 'device') all.push(...DEVICE_CHOICES.map((d) => d.label.toLowerCase()));
    else {
      const q = TREES[flow.data.symptom as SymptomId]?.questions.find((x) => 'q:' + x.id === flow.step);
      if (q) all.push(...q.opts.map((o) => o.label.toLowerCase()));
    }
  } else if (flow.id === 'project') {
    const lists: Record<string, string[]> = {
      kind: KINDS.map((k) => k.label),
      style: STYLES.map((s) => s.label),
      goal: GOALS.map((s) => s.label),
      deadline: DEADLINES.map((s) => s.label),
    };
    all.push(...(lists[flow.step] || []).map((s) => s.toLowerCase()));
  } else if (flow.id === 'decide') {
    const lists: Record<string, string[]> = { device: DEVICE_CHOICES.map((d) => d.label), age: AGES.map((a) => a.label), issue: ISSUES.map((a) => a.label), pref: PREFS.map((a) => a.label) };
    all.push(...(lists[flow.step] || []).map((s) => s.toLowerCase()));
  } else {
    all.push('a repair', 'a design', 'a website');
  }
  return all;
}

const PROJECT_INTENT = /\b(i|we)\s*(need|want|would like|d like|am looking for|m looking for|require)\b|\b(can|could|will|would) you (make|design|build|create|do|help)\b|\b(make|design|build|create|get) (me|us)\b|\blooking for\b|\bhire\b|\bhelp me (with|make|design|build|get)\b|\bi'?d like\b|\bid like\b|^(a |an )?(logo|website|poster|flyer)( please)?$/;
const PRICE_Q = /\b(how much|price|prices|pricing|cost|costs|rates?|charge|charges|fee|fees)\b/;
const QUOTE_INTENT = /\b(get|want|need|give me|can i get|could i get|request|ask for)\b.{0,14}\b(a |an )?(quote|quotation|estimate)\b|^(quote|estimate)( please)?$|\bhow do i get a quote\b/;
const DECIDE_INTENT = /\b(repair|fix|fixing|repairing)\b.{0,30}\b(or|vs|versus)\b.{0,20}\b(replace|replacing|buy|new one|new)\b|\b(replace|buy)\b.{0,30}\b(or|vs)\b.{0,20}\b(repair|fix)\b|\bis it worth (repairing|fixing|it)\b|\bworth (repairing|fixing)\b|\bshould i (repair|fix|replace|buy a new|get a new)\b/;

export interface RunHooks extends FollowUpHooks {}

/**
 * Main entry (after safety, hand-off and site commands). Returns null when the dialogue manager has
 * nothing to add and the normal pipeline should answer.
 */
export function runDialogue(raw: string, mode: PersonaMode, state: DialogueState, hooks: RunHooks = {}): DialogueOutput | null {
  const n = norm(raw);
  if (!n) return null;

  if (state.flow) {
    // Questions ABOUT the conversation ("why do you ask?", "recap", "how much?") are answered without
    // being mistaken for a wrong answer to the current question.
    const meta = flowMeta(raw, n, state, mode, hooks);
    if (meta) return meta;
    const r = handleActive(raw, n, state, mode);
    if (r) return r;
    // Off-topic during a flow: still let a follow-up like "why?" through, otherwise defer.
    return followUp(raw, n, state, mode, hooks);
  }

  const fu = followUp(raw, n, state, mode, hooks);
  if (fu) return fu;

  if (CONTINUE.test(n) || CANCEL.test(n) || BACK.test(n)) {
    return {
      reply: t(mode, "We're not in the middle of anything right now. 🙂 Tell me what you need — a repair, a design or a website — or pick one below.", 'FLOW // Nothing active.'),
      suggestions: ['My device is not working', 'I need a logo', 'Build me a website', 'Get a quote'],
      state,
      flow: false,
    };
  }

  const words = n.split(' ').length;

  if (QUOTE_INTENT.test(n)) return startQuote(state, mode);
  if (DECIDE_INTENT.test(n)) return startDecide(state, mode);

  // A personal problem statement ("my phone won't charge") starts a guided diagnosis.
  const sym = detectSymptom(n);
  if (sym && words <= 40) {
    const possessive = POSSESSIVE.test(n);
    const generic = GENERIC_START.test(n) && !possessive;
    const personal = possessive || (!generic && /\b(it|its|this|the (phone|laptop|pc|computer|tablet|device|screen|battery))\b/.test(n)) || (!generic && !!state.ent.device && words <= 8);
    const priceOnly = PRICE_Q.test(n) && !possessive;
    if (personal && !generic && !priceOnly && !(words <= 2 && !state.ent.device && sym === 'slow')) {
      const out = startDiagnose(sym, state, mode);
      // "...and also I'd like a logo": do the repair first, keep the design request for afterwards.
      const alsoProj = detectProject(n);
      if (alsoProj && PROJECT_INTENT.test(n) && out.state.flow) {
        out.state.flow.queuedProject = alsoProj;
        const noun = KINDS.find((k) => k.val === alsoProj)?.noun || 'project';
        out.reply = t(mode, `Two things — got it. Let’s sort the ${SYMPTOM_LABEL[sym]} first, then your **${noun}**.\n\n`, `QUEUED // ${noun} project after diagnosis\n`) + out.reply;
      }
      return out;
    }
  }

  // A request to get something made starts the project brief.
  const proj = detectProject(n);
  if (proj && PROJECT_INTENT.test(n) && !PRICE_Q.test(n)) {
    // "a website for my salon and a logo too": start with the one mentioned first and keep the other for afterwards.
    const all = detectProjects(n);
    const first = all.length > 1 && /\b(and|plus|also|as well|too|then)\b/.test(n) ? all[0] : proj;
    const second = all.find((k) => k !== first && !(first === 'website' && k === 'ui') && !(first === 'ui' && k === 'website'));
    const out = startProject(first, state, mode);
    if (second && all.length > 1 && out.state.flow && /\b(and|plus|also|as well|too|then)\b/.test(n)) {
      out.state.flow.queuedProject = second;
      const noun = KINDS.find((k) => k.val === second)?.noun || 'project';
      out.reply = t(mode, `Two things — got it. Let’s scope the ${KINDS.find((k) => k.val === first)?.noun || 'project'} first, then your **${noun}**.\n\n`, `QUEUED // ${noun} project after this brief\n`) + out.reply;
    }
    return out;
  }

  return null;
}

const CONTINUE_CHIPS = ['Continue', 'Skip', 'Cancel'];

function flowMeta(raw: string, n: string, state: DialogueState, mode: PersonaMode, hooks: FollowUpHooks): DialogueOutput | null {
  const flow = state.flow!;
  const out = (reply: string): DialogueOutput => ({ reply, suggestions: CONTINUE_CHIPS, state, flow: true });
  const resume = t(mode, '\n\nSay **continue** to carry on, or **just tell me** and I’ll wrap up with what I have.', '\nNEXT // "continue" or "just tell me".');

  if (RECAP.test(n)) return out(recap(state, mode));

  if (MY_NAME.test(n) || MY_DEVICE.test(n)) {
    const r = followUp(raw, n, { ...state, last: undefined }, mode, hooks);
    return r ? out(r.reply + resume) : null;
  }

  if (WHY.test(n) || /^why (do|did) you (ask|need)\b/.test(n) || /^(what|why) (is|are) (that|this) for$/.test(n)) {
    let because: string;
    if (flow.id === 'diagnose' && flow.step === 'device') {
      because = 'Phones and computers fail in different ways, so I need the device type before anything else.';
    } else if (flow.id === 'diagnose') {
      const q = TREES[flow.data.symptom as SymptomId]?.questions.find((x) => 'q:' + x.id === flow.step);
      because = q
        ? `I’m checking ${q.recap}: the answer separates the likely causes, so it changes what I recommend.`
        : 'Each answer narrows down the likely cause.';
    } else if (flow.id === 'project') {
      because = 'Each answer shapes the brief — style, goal and deadline decide what the owner would deliver and how long it takes.';
    } else if (flow.id === 'decide') {
      because = 'Age, the main fault and your priority are what decide whether a repair is worth it.';
    } else {
      because = 'I just need to know whether it is a repair, a design or a website so I route you properly.';
    }
    return out(t(mode, because + resume, `WHY // ${because}${resume}`));
  }

  if (HOW_MUCH.test(n)) {
    return out(
      t(mode, "I can't give an honest price from here — it depends on the exact model, the part and the scope — so I won't guess a number. 🙂 Finish these quick questions and I'll package the details so the owner can quote properly." + resume, 'PRICE // Not estimable remotely. Finish intake; dispatch for quote.' + resume)
    );
  }

  if (HOW_LONG.test(n)) {
    const idx = flow.id === 'project' ? (['website', 'ui'].includes(flow.data.kind) ? 2 : ['embroidery', 'convert'].includes(flow.data.kind) ? 3 : 1) : 0;
    const svc = SERVICES[idx];
    const custom = svc.timeline === 'Custom Scope';
    return out(
      t(mode, (custom ? 'The timeline depends on scope — the owner confirms a date after seeing your brief.' : `The usual turnaround here is **${svc.timeline}**, and the owner confirms it once they've seen the details.`) + resume, `ETA // ${svc.timeline}.${resume}`)
    );
  }

  return null;
}

/** The text pre-filled into the "send to the owner" card: what the visitor and I worked out so far. */
export function handoffNoteFor(state: DialogueState): string {
  if (state.last?.brief) return state.last.brief;
  const e = state.ent;
  const lines: string[] = [];
  if (e.device || e.brand || e.model) lines.push(`Device: ${deviceLabel(e)}`);
  if (e.symptom) lines.push(`Problem: ${SYMPTOM_LABEL[e.symptom]}`);
  if (e.project) lines.push(`Project: ${KINDS.find((k) => k.val === e.project)?.noun || e.project}`);
  if (state.flow?.id === 'diagnose') {
    const rec = recapLines(state.flow.data.symptom as SymptomId, state.flow.data);
    if (rec.length) lines.push(`Details: ${rec.join('; ')}`);
  }
  if (e.urgent) lines.push('Urgent: yes');
  if (e.dataAtRisk) lines.push('Data at risk: yes — please do not reset');
  return lines.join('\n');
}

/** Bookkeeping the orchestrator applies after any non-flow reply (see index.ts). */
export function noteOffTopic(state: DialogueState): { state: DialogueState; resumeChip: boolean } {
  if (!state.flow) return { state, resumeChip: false };
  const flow = { ...state.flow, off: state.flow.off + 1 };
  if (flow.off > 3) return { state: { ...state, flow: undefined }, resumeChip: false };
  return { state: { ...state, flow }, resumeChip: true };
}

export function lastFromResult(
  reply: string,
  source: string,
  entryId?: string,
  trace?: string[]
): LastAnswer | undefined {
  if (source === 'knowledge') return { kind: 'kb', text: reply, entryId, why: trace };
  if (source === 'rules' && trace && trace.length) return { kind: 'other', text: reply, why: trace };
  if (source === 'web' || source === 'local-ai' || source === 'remote-ai') return { kind: 'other', text: reply };
  return undefined;
}

export { EMPTY as EMPTY_DIALOGUE };
