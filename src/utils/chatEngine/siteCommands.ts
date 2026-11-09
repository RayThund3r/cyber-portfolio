// src/utils/chatEngine/siteCommands.ts
//
// "Take me to your services", "show branding projects", "open the diagnostics suite", "book a
// repair", "go amber", "back to top" ... Turns what the visitor TYPED into a SiteCommand the widget
// can execute, plus the reply to show alongside it.
//
// Safety design:
//   * Pure + deterministic (regex/keyword rules). No language model is involved, so model output
//     (or text fetched from the web) can never trigger navigation.
//   * A command needs an explicit intent: a navigation verb ("show", "take me", "open"...) or a
//     bare destination word ("services"). Questions such as "how much does a website cost" or
//     "show me how to fix a slow pc" do NOT navigate.
//   * Every destination comes from the site's own data (siteMap + portfolioData), never from input.

import { PersonaMode, ProjectCategory, SiteCommand, ThemeName } from './types';
import { normalize, tokens } from './text';
import { ALL_PROJECTS } from '../../data/portfolioData';
import { ROUTES } from '../../lib/siteMap';
import { GAMES } from '../../data/gamesData';

export interface ProjectLite { id: string; title: string; category: string }

export interface DetectContext {
  /** Current page path, e.g. "/portfolio" or "/portfolio/03". */
  pathname?: string;
  /** Live project list (includes projects added in /admin). Falls back to the built-in list. */
  projects?: ProjectLite[];
}

export interface Detected {
  command?: SiteCommand;
  human: string;
  expert: string;
  suggestions?: string[];
}

const VERB =
  "(?:take me|bring me|send me|guide me|lead me|navigate|jump|skip|scroll|go|goto|head|open|show|see|view|visit|load|pull up|check out|check|look at|let me see|lemme see|i want to see|i wanna see|i'd like to see|id like to see|where (?:can|do) i (?:see|find|view|read|check))";
// The verb must OPEN the request (optionally after "please", "can you", "i want to"...). An unanchored
// "go"/"see"/"check" matched ordinary questions like "how do projects usually go".
const LEAD = "(?:(?:hey|hi|hello|ok|okay|so|and|then|now|just|please|pls|kindly|can you|could you|would you|will you|can i|could i|may i|lets|let's|i want to|i wanna|i'd like to|id like to|i would like to|i need to|you can|you should)\\s+)*";
const NAV_VERB = new RegExp(`^${LEAD}${VERB}\\b`);

const PORTFOLIO_NOUN =
  /\b(projects?|portfolio|archive|gallery|showcase|case stud(?:y|ies)|samples?|(?:your|previous|past|recent|latest|earlier|best)\s+(?:work|jobs|builds|creations|designs)|examples? of (?:your|previous|past)\s+work)\b/;

const CATEGORY_RULES: { cat: ProjectCategory; label: string; re: RegExp }[] = [
  { cat: 'UI/UX', label: 'UI/UX', re: /\b(ui\/ux|ui ux|ui|ux|interface|figma|prototypes?|wireframes?)\b/ },
  { cat: 'BRANDING', label: 'Branding', re: /\b(brand(?:ing)?|logos?|posters?|identity|identities|graphic|embroidery|jef)\b/ },
  { cat: 'WEBAPP', label: 'Web apps', re: /\b(web ?apps?|websites?|web|apps?|next\.?js|react|coding|development)\b/ },
  { cat: 'HARDWARE', label: 'Hardware', re: /\b(hardware|repairs?|diagnostics?|phones?|pcs?|laptops?|computers?)\b/ },
];

const THEME_COLORS: Record<string, ThemeName> = {
  cyan: 'cyan', blue: 'cyan', teal: 'cyan', aqua: 'cyan',
  amber: 'amber', orange: 'amber', yellow: 'amber', gold: 'amber',
  emerald: 'emerald', green: 'emerald',
};

const GENERIC_TITLE_WORDS = new Set(['project', 'module', 'suite', 'hub', 'system', 'design', 'portfolio', 'archive', 'cyber']);

const pad = (n: string | number) => String(n).padStart(2, '0');

function route(path: string) {
  return ROUTES.find((r) => r.path === path);
}

/** Which project does the sentence name? By number ("project 3") or by distinctive title words. */
export function findProject(q: string, list: ProjectLite[] = ALL_PROJECTS): { id: string; strong: boolean } | null {
  const num = q.match(/\b(?:project|module|number|no\.?|#|id)\s*#?0*(\d{1,3})\b/);
  if (num) {
    const hit = list.find((p) => parseInt(p.id, 10) === parseInt(num[1], 10));
    if (hit) return { id: hit.id, strong: true };
  }

  const qTokens = new Set(tokens(q).filter((t) => !GENERIC_TITLE_WORDS.has(t)));
  if (qTokens.size === 0) return null;

  const titleTokens = list.map((p) => new Set(tokens(p.title).filter((t) => !GENERIC_TITLE_WORDS.has(t))));
  const df = new Map<string, number>();
  titleTokens.forEach((set) => set.forEach((t) => df.set(t, (df.get(t) || 0) + 1)));

  let bestId: string | null = null;
  let bestScore = 0;
  let tie = false;
  list.forEach((p, i) => {
    let score = 0;
    titleTokens[i].forEach((t) => {
      if (qTokens.has(t)) score += (df.get(t) === 1 && t.length >= 5 ? 1.5 : 1);
    });
    if (score > bestScore) {
      bestScore = score;
      bestId = p.id;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  });
  // Need two shared words ("strong") or one clearly distinctive word ("weak"); ties are ambiguous.
  if (tie || bestScore < 1.5 || !bestId) return null;
  return { id: bestId, strong: bestScore >= 2 };
}

/** Back-compat helper: just the id. */
export function findProjectId(q: string, list: ProjectLite[] = ALL_PROJECTS): string | null {
  return findProject(q, list)?.id ?? null;
}

export function findCategory(q: string): { cat: ProjectCategory; label: string } | null {
  const found = CATEGORY_RULES.filter((c) => c.re.test(q));
  return found.length === 1 ? { cat: found[0].cat, label: found[0].label } : null;
}

function contactKind(q: string): 'design' | 'repair' | undefined {
  const repair = /\b(repair|fix|fixed|broken|cracked|screen|battery|phone|laptop|pc|computer|device|charging|hardware)\b/.test(q);
  const design = /\b(design|logo|brand|branding|poster|website|web|ui|ux|app|figma|graphic)\b/.test(q);
  if (repair && !design) return 'repair';
  if (design && !repair) return 'design';
  return undefined;
}

/** Clean text for the portfolio search box. */
function searchTerm(q: string): string | null {
  const m = q.match(/\b(?:with|using|uses?|containing|featuring|built with|made with|for|about)\s+(.+)$/);
  if (!m) return null;
  const term = m[1]
    .replace(/\b(?:the|any|some|all|your|my|projects?|work|portfolio|archive|gallery|examples?|samples?|case stud(?:y|ies)|that|which|use|uses|using)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return term.length >= 2 ? term.slice(0, 40) : null;
}

type R = { human: string; expert: string };

export function detectSiteCommand(input: string, ctx: DetectContext = {}): Detected | null {
  const q = normalize(input);
  if (!q) return null;
  const words = q.split(' ');
  if (words.length > 16) return null; // long messages are conversations, not commands

  const here = ctx.pathname || '';
  const hasNav = NAV_VERB.test(q);
  const projects: ProjectLite[] = ctx.projects && ctx.projects.length ? ctx.projects : ALL_PROJECTS;

  const done = (command: SiteCommand | undefined, r: R, suggestions?: string[]): Detected => ({
    command,
    human: r.human,
    expert: r.expert,
    suggestions,
  });

  // ---- 1. close the chat ---------------------------------------------------------------------
  if (/^(please )?(close|hide|minimi[sz]e|dismiss|shut)( this| the| my)?( chat| assistant| window| bot)?$/.test(q) && q !== 'close') {
    return done({ type: 'close-chat', label: 'CHAT CLOSED' }, {
      human: 'Closing the chat. Tap **CHAT** whenever you need me. 👋',
      expert: 'UI // Chat minimised.',
    });
  }

  // ---- 2. top / bottom / back ----------------------------------------------------------------
  if (/\b(scroll|go|jump|take me|bring me|back|head)( back)?( up)? (to )?(the )?(very )?top( of (the|this) page)?\b/.test(q) || /^(back to top|top|go up|scroll up)$/.test(q)) {
    return done({ type: 'top', label: 'TOP' }, { human: 'Back to the top. ⬆️', expert: 'NAV // Scroll: top.' });
  }
  if (/\b(scroll|go|jump|take me|bring me|head)( down)? (to )?(the )?(very )?(bottom|footer|end)\b/.test(q) || /^(bottom|scroll down|go down)$/.test(q)) {
    return done({ type: 'bottom', label: 'BOTTOM' }, { human: 'Down to the bottom. ⬇️', expert: 'NAV // Scroll: bottom.' });
  }
  if (/^(please )?(go |take me )?back$|^(go|take me|bring me) (back|to the previous|to the last)( page)?$|^previous page$|^go to (the )?previous page$/.test(q)) {
    return done({ type: 'back', label: 'BACK' }, { human: 'Going back. ↩️', expert: 'NAV // History: back.' });
  }

  // ---- 2b. tracking a request: a reference (SYS-AB12CD) anywhere in the message ---------------
  const ref = input.match(/\bsys-?([a-z0-9]{6})\b/i);
  if (ref) {
    const id = `SYS-${ref[1].toUpperCase()}`;
    return done({ type: 'navigate', path: `/track?id=${id}`, label: `TRACK · ${id}` }, {
      human: `Opening the tracker for **${id}**. 📦 Enter the phone number or email you used to see its status.`,
      expert: `NAV // Track ${id}. Verify with the phone/email used.`,
    });
  }
  if (
    /^(track|track (?:my )?(?:request|repair|order|ticket|device)|(?:repair|order|ticket|request) status|check (?:my )?(?:repair |request |order |ticket )?status|my ticket|status of my (?:repair|request|order))$/.test(q) ||
    (hasNav && /\b(track(?:ing)?|repair status|order status|ticket status|my ticket)\b/.test(q))
  ) {
    return done({ type: 'navigate', path: '/track', label: 'TRACK REQUEST' }, {
      human: 'Opening request tracking. 📦 You will need your reference (like SYS-AB12CD) and the phone number or email you used.',
      expert: 'NAV // Opening request tracker.',
    });
  }

  // ---- 2c. template builder / privacy notice ---------------------------------------------------
  if (
    /^(template builder|website builder|site builder|website templates?|web templates?|templates?|diy website)$/.test(q) ||
    (hasNav && /\b(template builder|website builder|site builder|website templates?|web templates?|templates?|diy website)\b/.test(q))
  ) {
    return done({ type: 'navigate', path: '/builder', label: 'TEMPLATE BUILDER' }, {
      human: 'Opening the template builder. 🎨 Pick a template, customise it with no code, then download your site.',
      expert: 'NAV // Opening template builder.',
    });
  }
  if (/^(privacy|privacy (?:policy|notice)|data protection)$/.test(q) || (hasNav && /\b(privacy(?: policy| notice)?|data protection)\b/.test(q))) {
    return done({ type: 'navigate', path: '/privacy', label: 'PRIVACY NOTICE' }, {
      human: 'Opening the privacy notice. 🔒',
      expert: 'NAV // Opening privacy notice.',
    });
  }

  // ---- 2d. "what pages are there?" -------------------------------------------------------------
  if (/\b(what|which) (pages|sections)\b|\bsite ?map\b|^menu$|\bnavigation (menu|options)\b|\bwhere (else )?can i go\b|\bwhat can i (see|visit|open)\b|\blist (of )?(the )?pages\b|\bwhat'?s on (this|the) (site|website)\b/.test(q)) {
    return done(undefined, {
      human: 'I can take you anywhere on the site — just say where. 🧭\n\n**Home · Portfolio · Services · Games · Template builder · Contact (repair or design) · Track a request · Privacy**\n\nYou can also say things like "show me branding projects", "open project 03", or "scroll to the bottom".',
      expert: 'NAV // Available: Home | Portfolio | Services | Games | Builder | Contact [repair|design] | Track | Privacy.',
    }, ['Open services', 'Open the template builder', 'Book a repair', 'Track my request']);
  }

  // ---- 3. where am I -------------------------------------------------------------------------
  if (/^(where am i|what page( is this| am i on| is this site)?|which page( is this| am i on)?|where are we)$/.test(q)) {
    const title = route(here)?.title || (here.startsWith('/portfolio/') ? 'a project deep-dive' : 'this site');
    return done(undefined, {
      human: `You're on **${title}**. I can take you anywhere — try "show me your projects", "open services" or "book a repair".`,
      expert: `NAV // Location: ${here || 'unknown'} (${title}).`,
    });
  }

  // ---- 4. help with navigation ---------------------------------------------------------------
  if (/\b(how (do|can) i navigate|navigation help|site commands|what commands|what can i (ask|say|tell) you to do|help me (find|navigate))\b/.test(q)) {
    return done(undefined, {
      human:
        'I can move you around the site. Try:\n- "show me your projects"\n- "show branding projects" (or hardware, web apps, UI/UX)\n- "open the diagnostics suite"\n- "open services" / "go home"\n- "book a repair" (opens the form ready for a repair)\n- "next project" (on a project page)\n- "switch to the amber theme"\n- "back to top"',
      expert: 'NAV // Commands: projects | <category> projects | open <project> | services | home | contact | next project | theme <cyan|amber|emerald> | top | back',
    }, ['Show me your projects', 'Open services', 'Book a repair']);
  }

  // ---- 5. next / previous project (only meaningful on a project page) ------------------------
  const onProject = here.match(/^\/portfolio\/([^/?#]+)/);
  if (onProject && /\b(next|another|previous|prev|last|earlier)\b.*\b(project|one|module|case study)\b|^(next|previous|prev)$/.test(q)) {
    const idx = projects.findIndex((p) => p.id === onProject[1]);
    if (idx >= 0) {
      const back = /\b(previous|prev|last|earlier)\b/.test(q);
      const target = projects[(idx + (back ? -1 : 1) + projects.length) % projects.length];
      return done({ type: 'project', id: target.id, view: 'page', label: `PROJECT ${target.id}` }, {
        human: `${back ? 'Previous' : 'Next'} up: **${target.title}**. 📂`,
        expert: `NAV // Module ${target.id}: ${target.title}.`,
      });
    }
  }

  // ---- 5a. games -----------------------------------------------------------------------------
  {
    // Only a request that is JUST "play <game>" (or the bare game name) navigates. Questions that merely
    // mention a game ("how do I get better at chess") fall through to the normal answer.
    const lead = /^(?:please |pls )?(?:(?:let me|i want to|i wanna|i would like to|i'd like to|id like to|lets|let's|can we|can i|could i|may i|i feel like|i fancy) )?(?:play|start|open|launch|try|run|load|show me|take me to|go to)(?: me)?(?: a| an| the| some| one)?(?: (?:quick |new )?(?:game|round|match))?(?: of)? ?/;
    const rest = (lead.test(q) ? q.replace(lead, '') : q).replace(/^(?:a |an |the |some )/, '').replace(/ (?:game|please|pls)$/, '').replace(/ (?:game|please|pls)$/, '').trim();
    const game = rest && words.length <= 8 ? GAMES.find((g) => [g.id, ...g.aliases].includes(rest)) : undefined;
    if (game && (lead.test(q) || q === game.id || game.aliases.includes(q) || q === `${rest} game` || q === `game of ${rest}`)) {
      return done({ type: 'navigate', path: `/games?g=${game.id}`, label: `GAMES · ${game.title.toUpperCase()}` }, {
        human: `Opening **${game.title}**. 🎮 ${game.tagline}`,
        expert: `NAV // Games: ${game.id}.`,
      }, ['Which game should I play?', 'Show me all games']);
    }
    const hub =
      /^(?:please )?(?:(?:i want to|i wanna|lets|let's|can we|can i|i'd like to|id like to|i would like to) )?(?:play|open|show|see|view|visit|go to|take me to|bring me to|launch|start|browse)(?: me)?(?: a| the| some| your| any| all| all the| all of the| all of your)? ?(?:brain |online |fun |mind |web )?(?:games?|arcade)(?: page| section| hub| area)?(?: please)?$/.test(q) ||
      /^(?:games?|arcade|brain games|games page|the games page|game page|show me games|any games|do you have (?:any )?games|what games (?:do you have|are there|can i play)|i'?m bored|im bored|i am bored|entertain me|give me something to do|something fun|play something|play a game|a game)$/.test(q);
    if (hub) {
      if (here === '/games') return done({ type: 'top', label: 'GAMES' }, { human: `You're on the games page already. 🎮 There are ${GAMES.length} to pick from, or say "play chess".`, expert: 'NAV // Already on games.' });
      return done({ type: 'navigate', path: '/games', label: 'GAMES' }, {
        human: `Opening the games page. 🎮 ${GAMES.length} brain games, several with a real AI opponent. Say "play chess" (or any game name) to jump straight in.`,
        expert: `NAV // Opening games (${GAMES.length}).`,
      }, ['Play chess', 'Play Sudoku', 'Which game should I play?']);
    }
    if (/^(?:which|what) game (?:should|do) (?:i|you)(?: play| recommend| suggest)?(?: please)?$|^(?:recommend|suggest) (?:me )?a game$|^which game should i play$/.test(q)) {
      const pick = GAMES[Math.floor(((input.length * 7 + 3) % GAMES.length))];
      return done({ type: 'navigate', path: `/games?g=${pick.id}`, label: `GAMES · ${pick.title.toUpperCase()}` }, {
        human: `Try **${pick.title}**: ${pick.tagline} It trains ${pick.skills.toLowerCase()}. Opening it now. 🎮`,
        expert: `NAV // Games: ${pick.id} (suggested).`,
      }, ['Show me all games', 'Play chess', 'Play 2048']);
    }
  }

  // ---- 5b. terminal --------------------------------------------------------------------------
  {
    const known = '(neofetch|matrix|hack|joke|fortune|specs|os|ping|status|stack|whoami|about|uptime|date|help|history|ls|ls projects|ls services|ls stack)';
    const open = q.match(/^(?:please )?(?:open|launch|start|use)(?: the| your| that)? (?:interactive )?(?:terminal|console|command line|cli|shell)$/);
    const runIt = q.match(new RegExp(`^(?:please )?(?:run|type|execute|try|launch|do)(?: the)?(?: command)? ${known}(?: command)?(?: in(?: the| your)? (?:terminal|console|shell))?$`)) ||
      q.match(new RegExp(`^(?:in|on) the (?:terminal|console),? (?:run|type|execute|try) ${known}$`));
    if (open || runIt) {
      const cmd = runIt ? runIt[1] : undefined;
      return done({ type: 'terminal', cmd, label: cmd ? `TERMINAL · ${cmd.toUpperCase()}` : 'TERMINAL' }, {
        human: cmd ? `Running **${cmd}** in the terminal on the home page. 💻` : 'Opening the terminal on the home page. 💻 Type "help" in it to see what it can do.',
        expert: cmd ? `TERM // run: ${cmd}` : 'TERM // open',
      }, ['Give me a tour', 'Show me your projects']);
    }
  }

  // ---- 6. theme ------------------------------------------------------------------------------
  {
    const color = q.match(/\b(cyan|blue|teal|aqua|amber|orange|yellow|gold|emerald|green)\b/)?.[1];
    // "colour(s)" alone is NOT enough ("what colours do you use for logos?"): the visitor must say
    // theme / accent / palette, or give a direct command about the site's colour.
    const themeWord = /\b(theme|accent|palette|colou?r scheme)\b/.test(q) || /^(?:please )?(?:change|switch|set|swap|cycle)(?: the)?(?: site| page| website)?(?: accent)? colou?rs?(?: to (?:the )?\w+)?$/.test(q);
    const themeVerb = /\b(change|switch|toggle|swap|cycle|set|use|make|turn|go|try|put|give)\b/.test(q);
    const bareColor = /^(?:(?:make it|switch to|use|go|try|set it to|turn it) )(?:the )?(cyan|blue|teal|amber|orange|yellow|gold|emerald|green)(?: theme| mode)?$/.test(q);
    if ((themeWord && (themeVerb || /^(theme|next theme|colou?rs?)$/.test(q))) || bareColor) {
      const theme = color ? THEME_COLORS[color] : undefined;
      return done({ type: 'theme', theme, label: theme ? `THEME · ${theme.toUpperCase()}` : 'THEME' }, {
        human: theme ? `Switching to the **${theme}** theme. 🎨` : 'Switching the theme for you. 🎨',
        expert: theme ? `UI // Theme: ${theme.toUpperCase()}.` : 'UI // Theme cycled.',
      });
    }
  }

  // ---- 7. contact / booking ------------------------------------------------------------------
  const contactIntent =
    (/\b(open|show|take me to|go to|scroll to|bring me to|navigate to|visit|send me to)\b.*\bcontact\b/.test(q)) ||
    /\b(i want to|i'?d like to|i would like to|how (?:do|can) i|let me|i need to|can i|where (?:can|do) i) (hire|contact|reach|message|email|book|get in touch|order|request)\b/.test(q) ||
    /^(contact|contact you|contact page|contact form|contact section|open contact( section| page| form)?|hire you|hire me|get in touch|book( a)?( repair| appointment)?|book a repair|start a project|make an inquiry|send a message)$/.test(q);
  if (contactIntent) {
    const kind = contactKind(q);
    const kindLabel = kind === 'repair' ? 'REPAIR' : kind === 'design' ? 'DESIGN' : '';
    if (here === '/contact' && !kind) {
      return done({ type: 'top', label: 'CONTACT' }, {
        human: "You're already on the contact page — the form is right here. 📬 Tell them what you need and include your device model or project details.",
        expert: 'NAV // Already on contact module.',
      });
    }
    return done({ type: 'contact', kind, label: kindLabel ? `CONTACT · ${kindLabel}` : 'CONTACT' }, {
      human:
        kind === 'repair'
          ? 'Opening the contact form on **Hardware Repair**. 🔧 Add your device model and what it\'s doing — you can also pick a date and time slot if you want to bring it in.'
          : kind === 'design'
          ? 'Opening the contact form on **UI/UX & Design**. 🎨 Describe what you want made.'
          : 'Taking you to the contact form now. 📬 Tell them what you need and include your device model or project details.',
      expert: `NAV // Opening contact module${kindLabel ? ` [${kindLabel}]` : ''}.`,
    });
  }

  // ---- 8/9. a specific project, or a category / search / the archive --------------------------
  const projectIntent = hasNav || /^project \d+$/.test(q) || /\b(deep ?dive|case study of|more (?:about|on)|details? (?:of|on|for))\b/.test(q);
  const pluralNoun = /\b(projects|designs|works|portfolio|examples|samples|studies|archive|gallery)\b|\b(your|some|any|the)\s+(logos|posters|websites|web ?apps|apps|repairs)\b|\b(your|my|previous|past|recent|latest) work\b|\b(ui\/ux|ui|ux|brand(?:ing)?|hardware|web|design|graphic|repair|logo|poster)\s+work\b/.test(q);

  const openProject = (id: string): Detected => {
    const p = projects.find((x) => x.id === id)!;
    const page = /\b(deep ?dive|full (details|case study|write ?up|page)|case study|read more|more details|in detail|details page|more (?:about|on))\b/.test(q);
    return done({ type: 'project', id, view: page ? 'page' : 'modal', label: `PROJECT ${id}` }, {
      human: page ? `Opening the full deep-dive for **${p.title}**. 📂` : `Opening **${p.title}** in the archive. 📂`,
      expert: `NAV // Module ${id}: ${p.title}.`,
    }, ['Next project', 'Show me your projects', 'Book a repair']);
  };

  const proj = projectIntent ? findProject(q, projects) : null;
  // "show me your branding projects" must filter the archive, not open the one project whose title
  // contains "brand"; a singular, specific mention ("the embroidery project") opens that project.
  if (proj && (proj.strong || !(pluralNoun && findCategory(q)))) return openProject(proj.id);

  // ---- 9. portfolio: category / search / general ---------------------------------------------
  const portfolioNoun = PORTFOLIO_NOUN.test(q) || pluralNoun;
  const bareArchive = /^(projects?|portfolio|your work|my work|archive|gallery|showcase|the archive|your portfolio|your projects)$/.test(q);

  if ((hasNav && portfolioNoun) || bareArchive) {
    const cat = findCategory(q);
    if (cat) {
      return done({ type: 'portfolio', category: cat.cat, label: `PORTFOLIO · ${cat.cat}` }, {
        human: `Filtering the archive to **${cat.label}** projects. 🗂️`,
        expert: `NAV // Archive filter: ${cat.cat}.`,
      }, ['Show all projects', 'Show web apps', 'Book a repair']);
    }
    const wantsFullArchive = /\b(archive|full|all|complete|portfolio page|gallery)\b/.test(q);
    if (here === '/' && !wantsFullArchive) {
      return done({ type: 'scroll', id: 'projects', label: 'HOME › PROJECTS' }, {
        human: 'Scrolling to the featured projects now. 👀 Say "open the full archive" to see all six.',
        expert: 'NAV // Scrolling to featured projects.',
      }, ['Open the full archive', 'Show hardware projects', 'Book a repair']);
    }
    if (here === '/portfolio' && wantsFullArchive) {
      return done({ type: 'portfolio', label: 'PORTFOLIO · ALL' }, {
        human: 'Showing the whole archive. 🗂️',
        expert: 'NAV // Archive filter cleared.',
      });
    }
    return done({ type: 'navigate', path: '/portfolio', label: 'PORTFOLIO' }, {
      human: 'Opening the project archive. 🗂️ You can filter by category or search inside it — or just tell me what you want to see.',
      expert: 'NAV // Opening project archive.',
    }, ['Show branding projects', 'Show hardware projects', 'Show web apps']);
  }

  // "show all projects" / "clear filters" while in the archive
  if (/^(show |reset |clear )?(all|every)( the)?( projects?| work)?( filters)?$|^(reset|clear) (the )?(filters?|search)$/.test(q) && here.startsWith('/portfolio')) {
    return done({ type: 'portfolio', label: 'PORTFOLIO · ALL' }, { human: 'Showing everything again. 🗂️', expert: 'NAV // Archive filter cleared.' });
  }

  if (/\b(search|find|look for|looking for|filter|look up)\b/.test(q) && portfolioNoun) {
    const term = searchTerm(q);
    if (term) {
      return done({ type: 'portfolio', query: term, label: `PORTFOLIO · "${term}"` }, {
        human: `Searching the archive for **${term}**. 🔎`,
        expert: `NAV // Archive search: "${term}".`,
      });
    }
  }

  // ---- 10. home-page sections ----------------------------------------------------------------
  if (hasNav || /^(skills|tech stack|stack|terminal)$/.test(q)) {
    if (/\b(tech(?:nical)? stack|stack|skills?|capabilit(?:y|ies)|proficienc(?:y|ies)|tooling)\b/.test(q)) {
      return done({ type: 'scroll', id: 'stack', label: 'HOME › STACK' }, {
        human: 'Here is the tech stack and tooling. ⚙️',
        expert: 'NAV // Scrolling to capabilities matrix.',
      });
    }
    if (/\b(terminal|command line|console|cli)\b/.test(q)) {
      return done({ type: 'scroll', id: 'terminal', label: 'HOME › TERMINAL' }, {
        human: 'Taking you to the interactive terminal. Type `help` in it to see the commands. 💻',
        expert: 'NAV // Scrolling to interactive terminal.',
      });
    }
    if (/\bfeatured\b/.test(q)) {
      return done({ type: 'scroll', id: 'projects', label: 'HOME › PROJECTS' }, {
        human: 'Scrolling to the featured projects now. 👀',
        expert: 'NAV // Scrolling to featured projects.',
      });
    }
  }

  // ---- 11. plain pages -----------------------------------------------------------------------
  const goHome =
    /^(home|homepage|home page|main page|landing page|start page|front page|go home|take me home|back home|home please)$/.test(q) ||
    (hasNav && /\b(home|homepage|home page|main page|landing page|start page|front page)\b/.test(q) && !/\b(at home|home (?:screen|network|wifi|router|pc|computer|button))\b/.test(q)) ||
    /\bback to (the )?(home|start|main|beginning)( page)?\b/.test(q);
  if (goHome) {
    if (here === '/') {
      return done({ type: 'top', label: 'HOME' }, { human: "You're already on the home page. ⬆️", expert: 'NAV // Already at root.' });
    }
    return done({ type: 'navigate', path: '/', label: 'HOME' }, { human: 'Heading home. 🏠', expert: 'NAV // Root.' });
  }

  const goServices =
    /^(services?|service page|services page|our services|your services|offerings|pricing page|rates page|what you offer)$/.test(q) ||
    (hasNav && /\b(services?|service page|offerings|pricing page|rates page|what you offer|timelines)\b/.test(q) && !/\b(service (?:center|centre|mode)|in service)\b/.test(q));
  if (goServices) {
    if (here === '/services') {
      return done({ type: 'top', label: 'SERVICES' }, { human: "You're already on the services page. ⬆️", expert: 'NAV // Already on services module.' });
    }
    return done({ type: 'navigate', path: '/services', label: 'SERVICES' }, {
      human: 'Opening services. 🧰 You\'ll find hardware repair, brand design, UI/UX and file conversion with estimated timelines.',
      expert: 'NAV // Opening services module.',
    }, ['Book a repair', 'Show me your projects', 'I need a logo']);
  }

  const goPortfolioPage = hasNav && /\b(portfolio page|archive page|project page|projects page)\b/.test(q);
  if (goPortfolioPage) {
    return done({ type: 'navigate', path: '/portfolio', label: 'PORTFOLIO' }, { human: 'Opening the project archive. 🗂️', expert: 'NAV // Opening project archive.' });
  }

  return null;
}

/**
 * "show branding projects and then book a repair" -> two commands, run in order.
 * Deliberately strict: every part must be a clear command of a DIFFERENT kind, so ordinary
 * sentences with "and" in them ("branding and hardware projects") are never split.
 */
export function detectMultiCommand(
  input: string,
  pathname?: string,
  projects?: ProjectLite[]
): { commands: SiteCommand[]; human: string; expert: string; suggestions?: string[] } | null {
  const text = input.trim();
  if (text.length < 8 || text.length > 160) return null;
  const parts = text
    .split(/\s*[,;]?\s*\b(?:and then|and after that|after that|and also|then|and)\b\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return null;

  let here = pathname;
  const found: Detected[] = [];
  for (const part of parts) {
    const d = detectSiteCommand(part, { pathname: here, projects });
    if (!d || !d.command || d.command.type === 'close-chat') return null;
    found.push(d);
    if (d.command.type === 'navigate') here = d.command.path;
  }
  const kinds = new Set(found.map((d) => d.command!.type));
  if (kinds.size !== found.length) return null;

  return {
    commands: found.map((d) => d.command!),
    human: found.map((d) => d.human).join('\n\n'),
    expert: found.map((d) => d.expert).join('\n'),
    suggestions: found[found.length - 1].suggestions,
  };
}
