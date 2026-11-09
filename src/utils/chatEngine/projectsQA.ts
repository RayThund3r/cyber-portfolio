// src/utils/chatEngine/projectsQA.ts
//
// Answers QUESTIONS about the portfolio from the real project data (data/portfolioData.ts), so the
// assistant can talk about the work instead of only linking to it:
//
//   "which of your projects is best for hardware?"   -> the matching projects, with what each shows
//   "what have you built with Figma?"                 -> projects that list that tool
//   "tell me about the embroidery one"                -> a project summary (title, tools, result)
//   "tell me more about the second one"               -> resolves "second" against the list just shown
//   "what tools do you use?" / "how many projects?"   -> aggregates over all projects
//
// Navigation ("show me hardware projects", "open project 3") is handled earlier by siteCommands.ts;
// this module only handles questions. Nothing here is invented: every fact comes from ALL_PROJECTS.

import { ALL_PROJECTS, ProjectItem } from '../../data/portfolioData';
import type { ChatCard, PersonaMode, SessionMemory } from './types';
import type { ReasonReply } from './reasoner';
import { findProject } from './siteCommands';

export interface ProjectAnswer {
  human: string;
  expert: string;
  suggestions: string[];
  /** Ids of the projects just listed, so "the second one" can be resolved next turn. */
  list?: string[];
  /** When set, the visitor asked to open this project (the reasoner turns it into a site command). */
  open?: string;
  cards?: ChatCard[];
}

const CAT_LABEL: Record<ProjectItem['category'], string> = { 'UI/UX': 'UI/UX', BRANDING: 'branding', WEBAPP: 'web', HARDWARE: 'hardware' };

const CAT_RX: Array<[ProjectItem['category'], RegExp]> = [
  ['HARDWARE', /\b(hardware|repairs?|diagnostics?|phones?|pcs?|laptops?|computers?|fix(ing)?|unlock\w*)\b/],
  ['UI/UX', /\b(ui\/?ux|ui|ux|interface|figma|prototyp\w*|wireframes?|design system)\b/],
  ['BRANDING', /\b(brand\w*|logos?|posters?|identity|graphic\w*|embroidery|jef|fabric|print)\b/],
  ['WEBAPP', /\b(web ?apps?|websites?|web|apps?|next\.?js|react|coding|code|development|developer|frontend|front-end)\b/],
];

const ORDINALS: Array<[RegExp, number]> = [
  [/\b(first|1st|top|opening)\b/, 0],
  [/\b(second|2nd)\b/, 1],
  [/\b(third|3rd)\b/, 2],
  [/\b(fourth|4th)\b/, 3],
  [/\b(fifth|5th)\b/, 4],
  [/\b(last|final|bottom)\b/, -1],
];

const t = (mode: PersonaMode, h: string, e: string) => (mode === 'EXPERT' ? e : h);
const firstSentence = (s: string) => (s.match(/^[^.!?]+[.!?]?/) || [s])[0].trim();
const shortTitle = (p: ProjectItem) => p.title.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

const cardOf = (p: ProjectItem): ChatCard => ({
  id: p.id,
  title: shortTitle(p),
  subtitle: [CAT_LABEL[p.category], p.metrics].filter(Boolean).join(' · '),
  image: p.image,
  badge: p.id,
  send: `Open project ${p.id}`,
});

function describe(p: ProjectItem, mode: PersonaMode): string {
  const tools = p.tools?.length ? p.tools.join(', ') : '';
  if (mode === 'EXPERT') return `PROJECT_${p.id} // ${p.title} [${p.category}]\n${p.description}${p.metrics ? `\nRESULT // ${p.metrics}` : ''}${tools ? `\nTOOLS // ${tools}` : ''}`;
  return [
    `**${p.title}** — ${CAT_LABEL[p.category]} project${p.clientType ? ` (${p.clientType.toLowerCase()})` : ''}.`,
    p.description,
    p.metrics ? `**Result:** ${p.metrics}` : '',
    tools ? `**Tools:** ${tools}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function openChips(ps: ProjectItem[]): string[] {
  return ps.slice(0, 2).map((p) => `Open project ${p.id}`);
}

function listAnswer(ps: ProjectItem[], intro: string, mode: PersonaMode): ProjectAnswer {
  const lines = ps.map((p) => `- **${shortTitle(p)}** (project ${p.id}) — ${firstSentence(p.description)}${p.metrics ? ` Result: ${p.metrics}.` : ''}`);
  const human = `${intro}\n${lines.join('\n')}\n\nSay "tell me about the first one" for details, or open one to see the full case study.`;
  const expert = `PROJECTS // ${ps.map((p) => `${p.id}:${shortTitle(p)}`).join(' | ')}`;
  return { human: t(mode, human, expert), expert, suggestions: ['Show me your projects', 'Get a quote'], list: ps.map((p) => p.id), cards: ps.map(cardOf) };
}

const QUESTION = /^(which|what|who|how many|how much|tell me|do you|have you|did you|can you show|any|is there|are there|whats|what's)\b|\?$/;
const PROJECT_WORDS = /\b(projects?|work|portfolio|built|made|created|designed|case stud(?:y|ies)|samples?|examples?|clients?)\b/;

/**
 * `list` is the ids shown by the previous project answer (stored in memory.userContext.projList).
 * Returns null for anything that is not a question about the portfolio.
 */
function answerOf(n: string, mode: PersonaMode, memory: SessionMemory): ProjectAnswer | null {
  if (n.length > 160) return null;
  const prev = String(memory.userContext?.projList || '')
    .split(',')
    .filter((id) => ALL_PROJECTS.some((p) => p.id === id));

  // 0. "open the second one" is an action: hand the reasoner a site command for it.
  if (prev.length && /^(open|show|view|see|take me to|go to|pull up|launch)\b/.test(n) && /\b(one|ones|that|it|this|project)\b/.test(n)) {
    for (const [rx, i] of ORDINALS) {
      if (rx.test(n)) {
        const id = prev[i < 0 ? prev.length - 1 : i];
        const p = ALL_PROJECTS.find((x) => x.id === id);
        if (p) {
          const human = t(mode, `Opening **${shortTitle(p)}** for you. 📂`, `OPEN // PROJECT_${p.id}`);
          return { human, expert: `OPEN // PROJECT_${p.id}`, suggestions: ['Next project', 'Show me your projects', 'Book a repair'], list: [p.id], open: p.id };
        }
      }
    }
  }

  // 1. "the second one" / "tell me more about that one" -> resolve against the list just shown.
  if (prev.length && /\b(one|ones|that|it|this|those)\b|\bproject\b/.test(n) && /\b(more|about|details?|tell|explain|what|how|show|describe)\b/.test(n)) {
    for (const [rx, i] of ORDINALS) {
      if (rx.test(n)) {
        const id = prev[i < 0 ? prev.length - 1 : i];
        const p = ALL_PROJECTS.find((x) => x.id === id);
        if (p) return { human: t(mode, `${describe(p, mode)}\n\nWant to see it in full?`, describe(p, mode)), expert: describe(p, mode), suggestions: ['Next project', 'Book a repair'], list: [p.id], cards: [cardOf(p)] };
      }
    }
    if (prev.length === 1 && /\b(more|about|details?|tell|explain)\b/.test(n) && /\b(it|that|this|one)\b/.test(n)) {
      const p = ALL_PROJECTS.find((x) => x.id === prev[0]);
      if (p) return { human: t(mode, `${describe(p, mode)}\n\nWant to see it in full?`, describe(p, mode)), expert: describe(p, mode), suggestions: ['Show me your projects'], list: [p.id], cards: [cardOf(p)] };
    }
  }

  if (!QUESTION.test(n)) return null;

  // 2. How many / what kinds of projects.
  if (/\bhow many (projects|case stud\w*|things|works?)\b/.test(n)) {
    const cats = Array.from(new Set(ALL_PROJECTS.map((p) => CAT_LABEL[p.category])));
    const human = `There are **${ALL_PROJECTS.length} projects** in the archive, across ${cats.join(', ')}. Ask about a category or a tool and I'll pick out the relevant ones.`;
    return { human: t(mode, human, `PROJECTS // ${ALL_PROJECTS.length} total | ${cats.join(', ')}`), expert: `PROJECTS // ${ALL_PROJECTS.length}`, suggestions: ['Show me your projects', 'Show hardware projects', 'Show branding projects'] };
  }

  // 3. Tools / software overall.
  if (/\b(what|which) (tools?|software|programs?|apps?|stack|technolog\w*|languages?)\b.{0,25}\b(do you|did you|you)\b.{0,12}\b(use|used|work with|know)\b|\byour (tools|tech stack|stack|software)\b/.test(n)) {
    const byCat = (['HARDWARE', 'BRANDING', 'UI/UX', 'WEBAPP'] as const).map((c) => {
      const tools = Array.from(new Set(ALL_PROJECTS.filter((p) => p.category === c).flatMap((p) => p.tools || [])));
      return tools.length ? `- **${CAT_LABEL[c][0].toUpperCase() + CAT_LABEL[c].slice(1)}:** ${tools.join(', ')}` : '';
    }).filter(Boolean);
    const human = `Here's what the projects were built with:\n${byCat.join('\n')}`;
    return { human: t(mode, human, `TOOLS //\n${byCat.map((l) => l.replace(/\*\*/g, '')).join('\n')}`), expert: 'TOOLS //', suggestions: ['Show me your projects', 'What have you built with Figma?', 'Get a quote'] };
  }

  // 4. A tool named in the question: "what have you built with figma", "which project uses react".
  const toolHits = ALL_PROJECTS.filter((p) => (p.tools || []).some((tool) => {
    const k = tool.toLowerCase().replace(/[^a-z0-9. ]/g, ' ').trim();
    const first = k.split(' ')[0];
    return (k.length >= 4 && n.includes(k)) || (first.length >= 5 && new RegExp(`\\b${first.replace(/\./g, '\\.')}\\b`).test(n));
  }));
  if (toolHits.length && /\b(with|using|use|uses|used|in|on|made|built|done)\b/.test(n) && (PROJECT_WORDS.test(n) || /\b(which|what)\b/.test(n))) {
    return listAnswer(toolHits, toolHits.length === 1 ? 'One project used that:' : `${toolHits.length} projects used that:`, mode);
  }

  // 5. "which of your projects is best for hardware / what branding work do you have".
  if (PROJECT_WORDS.test(n) || /\b(best|good|relevant|similar)\b.{0,30}\b(for|to)\b/.test(n)) {
    const cat = CAT_RX.find(([, rx]) => rx.test(n));
    if (cat && /\b(which|what|any|have|best|good|relevant|similar|show|got|examples?|samples?)\b/.test(n)) {
      const ps = ALL_PROJECTS.filter((p) => p.category === cat[0]);
      if (ps.length) {
        const intro = ps.length === 1 ? `The ${CAT_LABEL[cat[0]]} project is:` : `For ${CAT_LABEL[cat[0]]}, these fit best:`;
        return listAnswer(ps, intro, mode);
      }
    }
    // "what's your best work": no ranking is claimed; the featured ones are offered.
    if (/\b(best|favou?rite|proudest|strongest|top)\b.{0,20}\b(work|project|piece|job)\b/.test(n)) {
      const ps = ALL_PROJECTS.slice(0, 3);
      return listAnswer(ps, "I don't rank them — each shows a different skill — but these three are the featured ones:", mode);
    }
  }

  // 6. A single project named ("tell me about the embroidery one", "project 5", "what is the diagnostics suite").
  if (/\b(tell me|about|what is|what's|whats|describe|explain|details?|more on|more about|how did you)\b/.test(n) || /^project \d/.test(n)) {
    const hit = findProject(n);
    if (hit) {
      const p = ALL_PROJECTS.find((x) => x.id === hit.id);
      if (p) return { human: t(mode, `${describe(p, mode)}\n\nWant to see it in full?`, describe(p, mode)), expert: describe(p, mode), suggestions: ['Next project', 'Book a repair'], list: [p.id], cards: [cardOf(p)] };
    }
  }

  return null;
}

const norm = (raw: string) => raw.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9'\s/+.-]/g, ' ').replace(/\s+/g, ' ').trim();

/** Questions about the portfolio, answered from the project data. Returns null for anything else. */
export function tryProjectQA(raw: string, mode: PersonaMode, memory: SessionMemory): ReasonReply | null {
  const a = answerOf(norm(raw), mode, memory);
  if (!a) return null;
  return {
    human: a.human,
    expert: a.expert,
    suggestions: a.suggestions,
    cards: a.cards,
    topic: 'PORTFOLIO',
    learn: a.list ? { projList: a.list.join(',') } : undefined,
    command: a.open ? { type: 'project', id: a.open, view: 'modal', label: `PROJECT ${a.open}` } : undefined,
    trace: a.list ? [`Looked through the ${ALL_PROJECTS.length} projects in the archive.`, `Matched: ${a.list.join(', ')}`] : undefined,
  };
}
