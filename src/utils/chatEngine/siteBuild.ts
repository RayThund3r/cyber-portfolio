// src/utils/chatEngine/siteBuild.ts
//
// "Build me a website": a short conversation (what kind of business, what is it called, anything to include) that ends with a real,
// editable draft site saved through the public builder API and a link to its editor. Everything is rule-based, so it works with the
// AI off or its daily limit used up. When the cloud model is available it may add nicer wording, which is validated before use.
// Runs only on what the visitor typed (never on model output).

import type { PersonaMode, SessionMemory } from './types';
import { INDUSTRIES, buildDraft, detectIndustry, industryById, mergeCopy, parseBrief, type Brief, type Copy, type Draft, type IndustryId } from '@/lib/builder/draft';
import { generateCloud, isCloudReady } from './remoteLLM';

export interface SbState { step: 'kind' | 'name' | 'more'; brief: Partial<Brief>; misses: number }
export interface SbResult { reply: string; suggestions?: string[]; nav?: { path: string; label: string }; state: SbState | null }
export interface SbDeps {
  /** Saves the draft and returns the editor path. Default: the public /api/builder (create + save). */
  save: (d: Draft) => Promise<{ path: string } | { error: string }>;
  /** Optional extra wording from the model. */
  copy: (b: Brief, signal?: AbortSignal) => Promise<Copy>;
}

const BUILD_VERB = /\b(build|make|create|design|draft|generate|set ?up|put together|whip up|develop|launch|code)\b/;
const SITE_NOUN = /\b(web ?site|web ?page|landing page|online (shop|store)|homepage|home page|site)\b/;
const QUESTION_LEAD = /^(how|what|why|when|where|which|who|whats|hows|do you|does|did you|is it|are you|will you|would it|could it|should i)\b/;
const MONEY = /\b(price|prices|cost|costs|how much|charge|quote|rates?|pay|fee|fees|budget)\b/;
const CANCEL = /^(cancel|stop|never ?mind|forget it|exit|quit|no thanks?|not now|leave it|drop it)\b/;
const GO = /^(build( it| now| it now)?|go( ahead)?|yes( please)?|yep|yeah|ok(ay)?|do it|skip|skip it|that'?s? (all|it)|nothing( else)?|no|nope|just build it|make it|start|continue)\b/;

export function siteBuildIntent(raw: string): boolean {
  const q = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!SITE_NOUN.test(q) || !BUILD_VERB.test(q)) return false;
  if (QUESTION_LEAD.test(q) || MONEY.test(q)) return false; // "how much to build a website", "do you build websites" belong to the normal answers
  if (/\b(how (do|can|to)|tutorial|learn|teach|guide)\b/.test(q)) return false;
  return /\b(me|us|my|our|for my|for our|for a|for the|one|now|please|for)\b/.test(q) || /^(can|could) you\b/.test(q) || /^(build|make|create|draft|generate|design)\b/.test(q);
}

export const readSb = (m: SessionMemory): SbState | null => {
  const s = m.userContext?.sb as SbState | undefined;
  return s && typeof s === 'object' && ['kind', 'name', 'more'].includes(s.step) ? { step: s.step, brief: s.brief || {}, misses: s.misses || 0 } : null;
};

const KIND_CHIPS = ['Salon', 'Restaurant', 'Shop', 'Phone repair', 'Clinic', 'Consulting', 'Something else'];
const titleCase = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/(^|\s)([a-z])/g, (_, a, b) => a + b.toUpperCase());

function cleanName(raw: string): string | null {
  let t = raw.trim().replace(/^(?:it'?s|its|it is|the name is|name is|my (?:business|shop|company|brand) is|we are|we're|i am|i'm|call it|called|named)\s+(?:called\s+|named\s+)?/i, '').replace(/^["“'‘]+|["”'’.!]+$/g, '').trim();
  if (!t || t.length < 2 || t.length > 40 || t.split(/\s+/).length > 6 || /[?]/.test(t)) return null;
  return t === t.toLowerCase() ? titleCase(t) : t;
}

const need = (b: Partial<Brief>): 'kind' | 'name' | null => (!b.kind ? 'kind' : !b.name ? 'name' : null);

function ask(step: 'kind' | 'name' | 'more', brief: Partial<Brief>): SbResult {
  const state: SbState = { step, brief, misses: 0 };
  if (step === 'kind') return { reply: 'Happy to build you a starter website right here. What kind of business is it?', suggestions: [...KIND_CHIPS, 'Cancel'], state };
  const ind = industryById(brief.kind || 'business');
  if (step === 'name') return { reply: `Nice, a ${ind?.label || 'business'} site. What is the business called?`, suggestions: ['Cancel'], state };
  return {
    reply: `Got it: **${brief.name}**${brief.city ? ` in ${brief.city}` : ''}. Anything you want on it? Tell me where you are, what you offer (e.g. "braids, nails, makeup") and a phone, WhatsApp or email, or say **build it** and I will start with what I have.`,
    suggestions: ['Build it', 'Cancel'], state,
  };
}

/** Starts or continues the build conversation. Returns null when this message is not part of it. */
export async function trySiteBuild(raw: string, mode: PersonaMode, memory: SessionMemory, deps: SbDeps, signal?: AbortSignal): Promise<SbResult | null> {
  const st = readSb(memory);
  const q = raw.toLowerCase().replace(/\s+/g, ' ').trim();

  if (!st) {
    if (!siteBuildIntent(raw)) return null;
    const brief = parseBrief(raw);
    const n = need(brief);
    if (n) return ask(n, brief);
    return brief.city || brief.services?.length || brief.phone || brief.email ? build(brief as Brief, deps, signal) : ask('more', brief);
  }

  if (CANCEL.test(q)) return { reply: 'No problem, I stopped. Say **build me a website** whenever you want to start again.', suggestions: ['Build me a website', 'Show me your projects'], state: null };
  const brief: Partial<Brief> = { ...st.brief };
  const miss = (): SbResult | null => (st.misses >= 1 ? null : { ...ask(st.step, brief), state: { step: st.step, brief, misses: st.misses + 1 }, reply: st.step === 'kind' ? 'I did not catch the type of business. Pick one below, or describe it in a few words (e.g. "I sell shoes").' : 'I did not catch that as a name. What should the business be called?' });

  if (st.step === 'kind') {
    const k: IndustryId | null = detectIndustry(raw) || (/\b(something else|other|not sure|anything|general|business)\b/.test(q) ? 'business' : null);
    if (!k) return miss();
    Object.assign(brief, { ...parseBrief(raw), kind: k });
  } else if (st.step === 'name') {
    const p = parseBrief(raw);
    const nm = p.name || cleanName(raw);
    if (!nm) return miss();
    Object.assign(brief, { ...p, name: nm });
  } else {
    if (!GO.test(q)) {
      const p = parseBrief(raw);
      // a bare answer like "Kampala" or "braids, nails and makeup"
      if (!p.city && /^[A-Za-z][A-Za-z ]{2,24}$/.test(raw.trim()) && raw.trim().split(/\s+/).length <= 2) p.city = titleCase(raw.trim());
      if (!p.services && /,/.test(raw) && raw.split(',').length <= 7 && raw.length < 160) p.services = raw.split(',').map((x) => titleCase(x.replace(/[.!?]+$/, '').trim())).filter((x) => x.length >= 3 && x.length <= 40).slice(0, 6);
      const { kind: _k, name: _n, ...rest } = p; // do not let a side remark change what was already settled
      Object.assign(brief, rest);
    }
    return build(brief as Brief, deps, signal);
  }
  const n = need(brief);
  if (n) return ask(n, brief);
  return brief.city || brief.services?.length || brief.phone || brief.email ? build(brief as Brief, deps, signal) : ask('more', brief);
}

async function build(brief: Brief, deps: SbDeps, signal?: AbortSignal): Promise<SbResult> {
  let copy: Copy = {};
  try { copy = await deps.copy(brief, signal); } catch { /* wording is optional */ }
  const draft = buildDraft(brief, copy);
  const saved = await deps.save(draft);
  if ('error' in saved) {
    return {
      reply: `I wrote the draft for **${draft.name}**, but could not save it just now (${saved.error}). You can start from the **${draft.templateName}** design in the builder and I will help you fill it in.`,
      suggestions: ['Open the builder', 'Send this to the owner'], state: null,
      nav: { path: '/builder', label: 'the builder' },
    };
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const sections = draft.config.sections.filter((s) => s.visible && s.type !== 'navbar' && s.type !== 'footer').length;
  const reply = [
    `Done. I built a draft website for **${draft.name}**${brief.city ? ` (${brief.city})` : ''} from our **${draft.templateName}** design, with ${sections} sections and your details filled in. Tap the button below to open the editor.`,
    '',
    ...draft.notes.map((n) => `- ${n}`),
    '',
    `Keep this private link, it is your key to edit the site: \`${origin}${saved.path}\``,
    '',
    'In the editor you can change any text, colour or picture, ask its assistant for changes, preview it, and order it when you are happy. Want me to change anything first?',
  ].join('\n');
  return {
    reply, state: null,
    suggestions: ['Send this to the owner', 'How much will it cost?', 'Build another website'],
    nav: { path: saved.path, label: 'your site editor' },
  };
}

/* ------------------------------------------------------------------ default dependencies (browser) ------------------------------------------------------------------ */
async function post(body: Record<string, unknown>): Promise<{ ok: boolean; data: any }> {
  const r = await fetch('/api/builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export const browserDeps: SbDeps = {
  async save(d) {
    try {
      const c = await post({ action: 'create', templateId: d.templateId });
      if (!c.ok || !c.data?.id) return { error: c.data?.error || 'the builder is busy' };
      const { id, key } = c.data as { id: string; key: string };
      const s = await post({ action: 'save', id, key, config: d.config, name: d.name });
      if (!s.ok) return { error: s.data?.error || 'saving failed' };
      return { path: `/builder/edit?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}` };
    } catch { return { error: 'no connection' }; }
  },
  async copy(b, signal) {
    if (!isCloudReady()) return {};
    const ind = industryById(b.kind);
    const prompt = [
      { role: 'system' as const, content: 'You write short, honest website copy for small businesses. Reply with ONE JSON object only, no markdown. Never invent prices, numbers, awards, links, phone numbers or customer quotes.' },
      { role: 'user' as const, content: `Business: ${b.name} (${ind?.label || 'business'})${b.city ? ` in ${b.city}` : ''}.${b.services?.length ? ` Services: ${b.services.join(', ')}.` : ''}\nReturn JSON: {"tagline":"max 9 words","about":"2 short paragraphs, friendly, plain words","services":[{"title":"2-4 words","text":"one short sentence"}]}${b.services?.length ? ' with exactly one entry per service listed' : ' with 4 entries'}.` },
    ];
    const ctl = new AbortController();
    const link = () => ctl.abort();
    signal?.addEventListener('abort', link);
    const timer = setTimeout(() => ctl.abort(), 25_000);
    try {
      const text = await generateCloud(prompt, undefined, ctl.signal);
      const m = text.match(/\{[\s\S]*\}/);
      return m ? mergeCopy(JSON.parse(m[0])) : {};
    } catch { return {}; } finally { clearTimeout(timer); signal?.removeEventListener('abort', link); }
  },
};

export const SITE_BUILD_KINDS = INDUSTRIES.map((i) => i.id);
