// src/utils/chatEngine/navigation.ts
//
// Lets visitors move around the site by talking to the chat:
//   "go to services" · "take me to the portfolio" · "book a repair" · "show me branding projects"
//   "open the Rainmeter project" · "track SYS-AB12CD" · "back" · "scroll to the bottom" · "what pages are there?"
//
// Rules of thumb (so normal questions are never hijacked):
//   • An explicit command (nav verb + destination, or a bare destination like "services") navigates immediately.
//   • A *question* that merely mentions a destination ("where can I see your prices?") is answered normally
//     and a "Open Services →" button is attached to that answer instead (see index.ts).
//   • The admin area is deliberately not reachable from chat.
import { portfolioUrl } from '@/lib/siteUrls';
import { normalize } from './text';

export interface NavProject { id: string; title: string; category: string }
export interface NavTarget { path: string; label: string }
export type PageControl = 'BACK' | 'TOP' | 'BOTTOM';
export interface NavIntent {
  kind: 'go' | 'suggest' | 'overview' | 'page';
  target?: NavTarget;
  page?: PageControl;
  /** Extra sentence shown with the confirmation (e.g. "pick a time slot"). */
  hint?: string;
}

interface Route { path: string; label: string; phrases: string[]; hint?: string }

// Longer / more specific phrases win. Phrases flagged generic only count when a nav verb is present.
const ROUTES: Route[] = [
  { path: '/', label: 'Home', phrases: ['home', 'homepage', 'home page', 'main page', 'front page', 'landing page', 'start page'] },
  { path: '/portfolio', label: 'Portfolio', phrases: ['portfolio', 'projects', 'your work', 'past work', 'previous work', 'case studies', 'case study', 'gallery', 'showcase', 'archive', 'work', 'project'] },
  { path: '/services', label: 'Services', phrases: ['services', 'service page', 'pricing', 'prices', 'price list', 'rates', 'what you offer', 'what you do', 'offerings'] },
  { path: '/contact', label: 'Contact', phrases: ['contact', 'contact page', 'contact form', 'contact section', 'get in touch', 'reach you', 'message you'] },
  { path: '/contact?type=repair', label: 'Repair booking', phrases: ['book a repair', 'book repair', 'repair booking', 'book an appointment', 'book appointment', 'book a visit', 'schedule a repair', 'repair appointment', 'booking', 'appointment'], hint: 'Pick a date and time slot on the form if you want to bring your device in.' },
  { path: '/contact?type=design', label: 'Design / web request', phrases: ['design request', 'design inquiry', 'design enquiry', 'request a design', 'request a website', 'start a project', 'hire you', 'hire'] },
  { path: '/games', label: 'Games', phrases: ['games', 'game page', 'games page', 'arcade', 'brain games'] },
  { path: '/builder', label: 'Template builder', phrases: ['template builder', 'website builder', 'site builder', 'website templates', 'web templates', 'website template', 'diy website', 'templates', 'template'], hint: 'Pick a template, customize it with no code, then download your site.' },
  { path: '/track', label: 'Track request', phrases: ['track', 'track request', 'track my request', 'track my repair', 'track my order', 'repair status', 'check status', 'order status', 'ticket status', 'my ticket', 'status of my repair'], hint: 'You will need your reference (like SYS-AB12CD) and the phone number or email you used.' },
  { path: '/privacy', label: 'Privacy notice', phrases: ['privacy', 'privacy policy', 'privacy notice', 'data protection'] },
];

// Single, very common words: only meaningful together with an explicit nav verb.
const GENERIC = new Set(['template', 'work', 'project', 'projects', 'booking', 'appointment', 'hire', 'track', 'archive', 'gallery', 'showcase']);

const NAV_VERB = /\b(go to|go|open|take me to|take me|show me|show|navigate to|navigate|bring me to|bring up|pull up|visit|head to|jump to|switch to|let me see|i want to see|i'?d like to see|i want to go to|check out|view|display|load|see)\b/;
const QUESTION = /^(where|how|what|which|can i|could i|do you|is there|are there|why|who|when|will|does)\b/;
const FILLER = /\b(the|a|an|your|my|me|please|pls|now|page|section|tab|screen|site|website|to|for|up|out|over|there|here|can|you|could|would|just|quickly|again)\b/g;

const CATEGORIES: [RegExp, string, string][] = [
  [/\b(branding|brand|logo|logos|identity|poster|posters|flyer|flyers)\b/, 'BRANDING', 'Branding'],
  [/\b(ui\/?ux|ui|ux|interface|figma|prototype|prototypes|app design)\b/, 'UI/UX', 'UI/UX'],
  [/\b(web|website|websites|webapp|web app|coding|code|development|next\.?js)\b/, 'WEBAPP', 'Web & app'],
  [/\b(hardware|repair|repairs|phone|pc|laptop|device)\b/, 'HARDWARE', 'Hardware'],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const has = (q: string, phrase: string) => new RegExp(`(^|\\s)${esc(phrase)}(?=\\s|$)`).test(q);

const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'from', 'into', 'that', 'this', 'a', 'of', 'to', 'in']);
const sigTokens = (s: string) => normalize(s).split(' ').filter((w) => w.length >= 4 && !STOP.has(w));

function matchProject(q: string, projects: NavProject[], hasVerb: boolean): NavProject | null {
  if (!projects.length) return null;
  const idMatch = q.match(/\b(?:project|module|id|#)\s*#?0*(\d{1,3})\b/);
  if (idMatch) {
    const n = parseInt(idMatch[1], 10);
    const byId = projects.find((p) => parseInt(p.id, 10) === n);
    if (byId) return byId;
  }
  if (!hasVerb && !/\bproject\b/.test(q)) return null;
  let best: { p: NavProject; score: number } | null = null;
  const qTokens = new Set(q.split(' '));
  for (const p of projects) {
    const t = sigTokens(p.title);
    if (!t.length) continue;
    const hit = t.filter((w) => qTokens.has(w) || [...qTokens].some((x) => x.length >= 5 && (w.startsWith(x) || x.startsWith(w)))).length;
    // One distinctive word (8+ letters, e.g. "embroidery") is enough; otherwise require two title words.
    const distinctive = t.some((w) => w.length >= 8 && (qTokens.has(w) || [...qTokens].some((x) => x.length >= 6 && w.startsWith(x))));
    const need = t.length <= 2 || distinctive ? 1 : 2;
    const score = hit / t.length;
    if (hit >= need && (score >= 0.4 || distinctive) && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

export function detectNavigation(raw: string, projects: NavProject[] = []): NavIntent | null {
  const q = normalize(raw);
  if (!q) return null;
  const words = q.split(' ');
  if (words.length > 14) return null;

  // ── tracking reference anywhere in the message ──
  const ref = raw.match(/\bsys-?([a-z0-9]{6})\b/i);
  if (ref) {
    const id = `SYS-${ref[1].toUpperCase()}`;
    return { kind: 'go', target: { path: `/track?id=${id}`, label: `Track ${id}` }, hint: 'Enter the phone number or email you used to see the status.' };
  }

  // ── page controls ──
  if (/^(go )?back$|\b(go back|previous page|take me back|back to (the )?(last|previous) page)\b/.test(q) && !/back to top/.test(q)) return { kind: 'page', page: 'BACK' };
  if (/\b(back to top|scroll (up|to (the )?(top|start|beginning))|(go|jump|take me) to (the )?(top|beginning)|top of (the )?page)\b/.test(q)) return { kind: 'page', page: 'TOP' };
  if (/\b(scroll (down|to (the )?(bottom|end|footer))|(go|jump|take me) to (the )?(bottom|end|footer)|bottom of (the )?page)\b/.test(q)) return { kind: 'page', page: 'BOTTOM' };

  // ── overview ──
  if (/\b(what|which) (pages|sections)\b|\bsite ?map\b|^menu$|\bnavigation (menu|options)\b|\bwhere (else )?can i go\b|\bwhat can i (see|visit|open)\b|\blist (of )?(the )?pages\b|\bwhat'?s on (this|the) (site|website)\b|\bhelp me navigate\b/.test(q)) {
    return { kind: 'overview' };
  }

  const hasVerb = NAV_VERB.test(q);
  // "can you take me to…", "please open…" are commands; "where can I find…" is a request to be taken there.
  // Other questions ("what are your prices?") get answered normally, with an "Open …" button attached.
  const polite = /^(can|could|would|will) you\b|^please\b/.test(q);
  const locational = /^where\b|\bhow (do|can|would) i (get to|find|reach|see|view|open|go to|navigate to|check)\b|\bwhere (do|can) i\b/.test(q);
  const isQuestion = (QUESTION.test(q) || raw.trim().endsWith('?')) && !polite && !locational;

  // ── a specific project ──
  const proj = matchProject(q, projects, hasVerb);
  if (proj && !(isQuestion && !hasVerb)) {
    return { kind: isQuestion ? 'suggest' : 'go', target: { path: `/portfolio/${proj.id}`, label: proj.title } };
  }

  // ── best route by longest phrase ──
  let best: { route: Route; len: number; generic: boolean } | null = null;
  for (const r of ROUTES) {
    for (const ph of r.phrases) {
      if (!has(q, ph)) continue;
      const generic = GENERIC.has(ph);
      if (generic && !hasVerb) continue;
      if (!best || ph.length > best.len) best = { route: r, len: ph.length, generic };
    }
  }
  if (!best) return null;

  let { path, label } = best.route;
  let hint = best.route.hint;

  // portfolio category filter: "show me branding projects"
  if (path === '/portfolio') {
    for (const [re, cat, nice] of CATEGORIES) {
      if (re.test(q)) { path = portfolioUrl({ category: cat }); label = `${nice} projects`; break; }
    }
  }
  const target = { path, label };

  // "Bare" = the destination plus at most one extra word (e.g. a category). Stops "i work from home" matching Home.
  const bestPhrase = best.route.phrases.filter((ph) => has(q, ph)).sort((a, b) => b.length - a.length)[0] || '';
  const remainder = q.replace(bestPhrase, ' ').replace(NAV_VERB, ' ').replace(FILLER, ' ').split(' ').filter(Boolean);
  const bare = words.length <= 4 && remainder.length <= 1;

  if (isQuestion) return { kind: 'suggest', target, hint };      // answer normally + attach an "Open …" button
  const wantsTo = /\b(i want to|i'?d like to|i need to|i would like to|let me|lemme)\b/.test(q);
  if (hasVerb || locational || polite || wantsTo || bare) return { kind: 'go', target, hint }; // explicit command → navigate
  return null;                                                    // merely mentions a page word → leave alone
}

/** Human-readable list used by the "what pages are there?" overview. */
export const OVERVIEW_ITEMS = ROUTES.filter((r) => ['/', '/portfolio', '/services', '/games', '/builder', '/contact?type=repair', '/contact?type=design', '/track'].includes(r.path)).map((r) => r.label);

/* ───────────────────────── replies ───────────────────────── */

export interface NavReply {
  reply: string;
  navigate?: { path: string; label: string; auto: boolean };
  suggestions?: string[];
  page?: PageControl;
}

const stripQuery = (p: string) => p.split('?')[0];
const MORE = ['Where else can I go?', 'Book a repair', 'Track my request'];

export function navReply(intent: NavIntent, mode: 'HUMAN' | 'EXPERT', currentPath = ''): NavReply {
  const expert = mode === 'EXPERT';

  if (intent.kind === 'overview') {
    const list = OVERVIEW_ITEMS.join(' · ');
    return {
      reply: expert
        ? `NAV // Available: ${list}. Say "open <name>".`
        : `I can take you anywhere on the site — just say where. 🧭\n\n**${list}**\n\nYou can also say things like "show me branding projects", "open project 03", or "scroll to the bottom".`,
      suggestions: ['Open services', 'Open portfolio', 'Book a repair', 'Track my request'],
    };
  }

  if (intent.kind === 'page') {
    const map = {
      BACK: ['Going back to the previous page. ↩️', 'NAV // Back.'],
      TOP: ['Scrolling to the top. ⬆️', 'NAV // Top.'],
      BOTTOM: ['Scrolling to the bottom. ⬇️', 'NAV // Bottom.'],
    } as const;
    return { reply: map[intent.page!][expert ? 1 : 0], page: intent.page, suggestions: MORE };
  }

  const t = intent.target!;
  if (intent.kind === 'suggest') {
    // Not an interception — index.ts attaches this as a button on the normal answer.
    return { reply: '', navigate: { ...t, auto: false } };
  }

  const here = !t.path.includes('?') && stripQuery(currentPath) === t.path;
  const reply = here
    ? expert
      ? `NAV // Already on ${t.label}. Scrolled to top.`
      : `You're already on **${t.label}** — I've scrolled you to the top. 👍`
    : expert
    ? `NAV // Opening ${t.label}.${intent.hint ? ' ' + intent.hint : ''}`
    : `Taking you to **${t.label}** now. 🚀${intent.hint ? ' ' + intent.hint : ''}`;
  return { reply, navigate: { ...t, auto: true }, suggestions: MORE };
}
