// src/lib/terminal/commands.ts
//
// The terminal's brain: a PURE function from a typed line to output lines + side effects. No React,
// no DOM, so it is unit-testable. The component (components/terminal/Terminal.tsx) renders the lines
// and performs the effects (navigate, open chat, change theme...).
import { ALL_PROJECTS, TECH_STACK } from '@/data/portfolioData';
import { SERVICES } from '@/data/servicesData';
import { findGame, GAMES } from '@/data/gamesData';

export type LineKind = 'out' | 'ok' | 'err' | 'dim' | 'accent' | 'cmd' | 'head';
export interface TermLine {
  kind: LineKind;
  text: string;
}

export type TermEffect =
  | { type: 'navigate'; path: string }
  | { type: 'chat'; send?: string; prefill?: string }
  | { type: 'theme'; theme?: string }
  | { type: 'mode'; mode?: 'light' | 'dark' }
  | { type: 'clear' }
  | { type: 'hack' }
  | { type: 'matrix' }
  | { type: 'scroll'; id: string };

export interface TermResult {
  lines: TermLine[];
  effects?: TermEffect[];
}

export interface TermContext {
  specs: { os: string; resolution: string; cores: string; memory: string; platform: string };
  history: string[];
  /** ms since the terminal opened */
  uptimeMs: number;
  now?: Date;
  themes: string[];
  rand?: () => number;
}

const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  "There are 10 types of people in the world: those who understand binary, and those who don't.",
  'Hardware: The part of a computer that you can kick when the software fails.',
  "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
  "It works on my machine. Ship the machine.",
  'A byte walks into a bar looking pale. The bartender asks: "What\'s wrong?" "I\'m feeling a bit off."',
];

const FORTUNES = [
  'Back up before you open the case.',
  'A phone that will not charge is a dirty port 8 times out of 10. Check before you buy a charger.',
  'Thermal paste older than three years is just decoration.',
  'Never force a connector. If it does not go in, it is not the right way round.',
  'The fix you skipped testing is the one that comes back.',
];

const PAGES: Record<string, { path: string; label: string }> = {
  home: { path: '/', label: 'home' },
  root: { path: '/', label: 'home' },
  portfolio: { path: '/portfolio', label: 'portfolio' },
  projects: { path: '/portfolio', label: 'portfolio' },
  services: { path: '/services', label: 'services' },
  games: { path: '/games', label: 'games' },
  arcade: { path: '/games', label: 'games' },
  contact: { path: '/contact', label: 'contact' },
};

export interface CommandDef {
  name: string;
  usage: string;
  desc: string;
  group: 'site' | 'info' | 'fun' | 'system';
}

export const COMMANDS: CommandDef[] = [
  { name: 'help', usage: 'help [command]', desc: 'List commands, or explain one', group: 'system' },
  { name: 'ls', usage: 'ls [projects|services|stack]', desc: 'List what is on this system', group: 'site' },
  { name: 'cat', usage: 'cat <project-id|service-id|about>', desc: 'Read a file', group: 'site' },
  { name: 'open', usage: 'open <home|portfolio|services|contact|project id>', desc: 'Go to a page', group: 'site' },
  { name: 'cd', usage: 'cd <page>', desc: 'Same as open', group: 'site' },
  { name: 'portfolio', usage: 'portfolio', desc: 'Open the project archive', group: 'site' },
  { name: 'services', usage: 'services', desc: 'Open the services page', group: 'site' },
  { name: 'games', usage: 'games', desc: 'List the brain games, or open the games page', group: 'site' },
  { name: 'play', usage: 'play <game>', desc: 'Start a game: chess, sudoku, 2048, connect4...', group: 'fun' },
  { name: 'contact', usage: 'contact', desc: 'Open the contact page', group: 'site' },
  { name: 'home', usage: 'home', desc: 'Back to the top of the home page', group: 'site' },
  { name: 'ask', usage: 'ask [question]', desc: 'Open the AI chat (optionally with a question)', group: 'site' },
  { name: 'repair', usage: 'repair', desc: 'Start a guided repair diagnosis in the chat', group: 'site' },
  { name: 'quote', usage: 'quote', desc: 'Start a quote in the chat', group: 'site' },
  { name: 'whoami', usage: 'whoami', desc: 'Who is this?', group: 'info' },
  { name: 'about', usage: 'about', desc: 'About this system and its owner', group: 'info' },
  { name: 'stack', usage: 'stack', desc: 'Skills and tooling', group: 'info' },
  { name: 'status', usage: 'status', desc: 'System status', group: 'info' },
  { name: 'neofetch', usage: 'neofetch', desc: 'System summary', group: 'info' },
  { name: 'specs', usage: 'specs', desc: 'Your device telemetry', group: 'info' },
  { name: 'os', usage: 'os', desc: 'Your platform', group: 'info' },
  { name: 'ping', usage: 'ping', desc: 'Network check', group: 'info' },
  { name: 'date', usage: 'date', desc: 'Date and time (your clock)', group: 'info' },
  { name: 'uptime', usage: 'uptime', desc: 'How long this session has run', group: 'info' },
  { name: 'theme', usage: 'theme [cyan|amber|emerald]', desc: 'Change the accent colour', group: 'system' },
  { name: 'light', usage: 'light', desc: 'Switch to light mode', group: 'system' },
  { name: 'dark', usage: 'dark', desc: 'Switch to dark mode', group: 'system' },
  { name: 'mode', usage: 'mode', desc: 'Toggle light / dark', group: 'system' },
  { name: 'history', usage: 'history', desc: 'Commands you ran', group: 'system' },
  { name: 'echo', usage: 'echo <text>', desc: 'Print text', group: 'system' },
  { name: 'clear', usage: 'clear', desc: 'Clear the screen (Ctrl+L)', group: 'system' },
  { name: 'joke', usage: 'joke', desc: 'A programmer joke', group: 'fun' },
  { name: 'fortune', usage: 'fortune', desc: 'A bench-tech tip', group: 'fun' },
  { name: 'hack', usage: 'hack', desc: 'Do not try this at home', group: 'fun' },
  { name: 'matrix', usage: 'matrix', desc: 'Digital rain (Ctrl+C to stop)', group: 'fun' },
];

export const COMMAND_NAMES = COMMANDS.map((c) => c.name);

const L = (kind: LineKind, text: string): TermLine => ({ kind, text });
const out = (...t: string[]): TermLine[] => t.map((x) => L('out', x));

/** Edit distance for "did you mean". */
export function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function suggestCommand(word: string): string | null {
  let best: [string, number] | null = null;
  for (const c of COMMAND_NAMES) {
    const d = distance(word, c);
    if (!best || d < best[1]) best = [c, d];
  }
  return best && best[1] <= Math.max(1, Math.floor(word.length / 3)) ? best[0] : null;
}

/** Tab completion: returns the possible completions for the text typed so far. */
export function complete(input: string): string[] {
  const t = input.replace(/^\s+/, '').toLowerCase();
  const parts = t.split(/\s+/);
  if (parts.length <= 1) return COMMAND_NAMES.filter((c) => c.startsWith(parts[0] || '')).sort();
  const [cmd, arg = ''] = [parts[0], parts[parts.length - 1]];
  let pool: string[] = [];
  if (cmd === 'open' || cmd === 'cd') pool = ['home', 'portfolio', 'services', 'games', 'contact', ...ALL_PROJECTS.map((p) => p.id)];
  else if (cmd === 'cat') pool = ['about', ...ALL_PROJECTS.map((p) => p.id), ...SERVICES.map((s) => `s${s.id}`)];
  else if (cmd === 'ls') pool = ['projects', 'services', 'stack'];
  else if (cmd === 'play') pool = GAMES.map((g) => g.id);
  else if (cmd === 'theme') pool = ['cyan', 'amber', 'emerald'];
  else if (cmd === 'help') pool = COMMAND_NAMES;
  return pool.filter((p) => p.startsWith(arg)).map((p) => `${parts.slice(0, -1).join(' ')} ${p}`);
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const fmtDur = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

function projectFile(id: string): TermLine[] | null {
  const p = ALL_PROJECTS.find((x) => x.id === id);
  if (!p) return null;
  return [
    L('head', `PROJECT_${p.id} // ${p.title}`),
    L('dim', `category: ${p.category}${p.clientType ? `  |  client: ${p.clientType}` : ''}`),
    L('out', p.description),
    ...(p.metrics ? [L('ok', `result:  ${p.metrics}`)] : []),
    ...(p.tools?.length ? [L('out', `tools:   ${p.tools.join(', ')}`)] : []),
    L('dim', `open it:  open ${p.id}`),
  ];
}

function serviceFile(id: string): TermLine[] | null {
  const s = SERVICES.find((x) => x.id === id.replace(/^s/, ''));
  if (!s) return null;
  return [
    L('head', `SERVICE_${s.id} // ${s.title}`),
    L('dim', `tag: ${s.tag}  |  typical turnaround: ${s.timeline}`),
    L('out', s.description),
    L('out', `includes: ${s.deliverables.join(' · ')}`),
    L('dim', 'prices depend on the exact job, so ask: quote'),
  ];
}

export function execute(raw: string, ctx: TermContext): TermResult {
  const line = raw.trim().replace(/\s+/g, ' ');
  if (!line) return { lines: [] };
  const [cmdRaw, ...args] = line.split(' ');
  const cmd = cmdRaw.toLowerCase();
  const arg = args.join(' ').toLowerCase();
  const rand = ctx.rand ?? Math.random;

  switch (cmd) {
    case 'help':
    case '?':
    case 'man': {
      if (arg) {
        const c = COMMANDS.find((x) => x.name === arg);
        if (!c) return { lines: [L('err', `no help for "${arg}".`)] };
        return { lines: [L('head', c.usage), L('out', c.desc)] };
      }
      const groups: Array<[CommandDef['group'], string]> = [
        ['site', 'SITE'],
        ['info', 'INFO'],
        ['system', 'SYSTEM'],
        ['fun', 'FUN'],
      ];
      const lines: TermLine[] = [L('head', 'COMMANDS  (Tab completes, ↑/↓ history, Ctrl+L clears)')];
      for (const [g, label] of groups) {
        lines.push(L('dim', `-- ${label}`));
        for (const c of COMMANDS.filter((x) => x.group === g)) lines.push(L('out', `  ${pad(c.name, 11)}${c.desc}`));
      }
      lines.push(L('dim', 'Or just say it in plain words:  ask how long does a screen repair take'));
      return { lines };
    }

    case 'ls': {
      if (!arg) {
        return { lines: [L('accent', 'projects/   services/   stack   about'), L('dim', 'try: ls projects')] };
      }
      if (arg.startsWith('project'))
        return { lines: [...ALL_PROJECTS.map((p) => L('out', `${p.id}  ${pad(p.category, 9)} ${p.title}`)), L('dim', 'read one: cat 03   open one: open 03')] };
      if (arg.startsWith('service'))
        return { lines: [...SERVICES.map((s) => L('out', `s${s.id}  ${pad(s.timeline, 14)} ${s.title}`)), L('dim', 'read one: cat s01')] };
      if (arg === 'stack') return execute('stack', ctx);
      return { lines: [L('err', `ls: cannot access "${arg}": try projects, services or stack`)] };
    }

    case 'cat': {
      if (!arg) return { lines: [L('err', 'usage: cat <project-id | service-id | about>')] };
      if (arg === 'about' || arg === 'about.txt') return execute('about', ctx);
      const f = projectFile(arg) || serviceFile(arg);
      return { lines: f ?? [L('err', `cat: ${arg}: no such file. Try "ls projects".`)] };
    }

    case 'open':
    case 'cd':
    case 'goto':
    case 'go': {
      if (!arg) return { lines: [L('err', `usage: ${cmd} <home|portfolio|services|contact|project id>`)] };
      const clean = arg.replace(/^~?\/?/, '').replace(/\/$/, '');
      const page = PAGES[clean];
      if (page) return { lines: [L('ok', `opening ${page.label}...`)], effects: [{ type: 'navigate', path: page.path }] };
      const p = ALL_PROJECTS.find((x) => x.id === clean || x.id === clean.replace(/^0*/, '').padStart(2, '0'));
      if (p) return { lines: [L('ok', `opening PROJECT_${p.id} // ${p.title}...`)], effects: [{ type: 'navigate', path: `/portfolio/${p.id}` }] };
      return { lines: [L('err', `${cmd}: "${arg}" not found. Pages: home, portfolio, services, contact. Projects: ${ALL_PROJECTS.map((x) => x.id).join(', ')}.`)] };
    }

    case 'portfolio':
    case 'projects':
      return { lines: [L('ok', 'opening portfolio...')], effects: [{ type: 'navigate', path: '/portfolio' }] };
    case 'games':
      if (args.length === 0 || arg === 'list' || arg === 'ls')
        return { lines: [L('head', `GAMES (${GAMES.length})`), ...GAMES.map((g) => L('out', `${pad(g.id, 12)}${g.title}`)), L('dim', 'play one: play chess    all of them: open games')] };
      return execute(`play ${arg}`, ctx);
    case 'play': {
      const g = arg ? findGame(arg) : null;
      if (!arg) return { lines: [L('err', 'usage: play <game>   (try "games" for the list)')] };
      if (!g) return { lines: [L('err', `play: no game called "${arg}". Try "games" for the list.`)] };
      return { lines: [L('ok', `starting ${g.title}...`)], effects: [{ type: 'navigate', path: `/games?g=${g.id}` }] };
    }
    case 'services':
      return { lines: [L('ok', 'opening services...')], effects: [{ type: 'navigate', path: '/services' }] };
    case 'contact':
      return { lines: [L('ok', 'opening contact...')], effects: [{ type: 'navigate', path: '/contact' }] };
    case 'home':
      return { lines: [L('ok', 'You are already home.')], effects: [{ type: 'scroll', id: 'top' }] };

    case 'ask':
    case 'chat': {
      const q = args.join(' ').slice(0, 200);
      return {
        lines: [L('ok', q ? `sending to the assistant: "${q}"` : 'OPENING_CHAT_CHANNEL...')],
        effects: [{ type: 'chat', send: q || undefined }],
      };
    }
    case 'repair':
      return { lines: [L('ok', 'starting a guided diagnosis in the chat...')], effects: [{ type: 'chat', send: 'My device has a problem' }] };
    case 'quote':
      return { lines: [L('ok', 'starting a quote in the chat...')], effects: [{ type: 'chat', send: 'Get a quote' }] };

    case 'whoami':
      return { lines: [L('accent', `guest@${ctx.specs.os.toLowerCase()}`), L('dim', 'visitor // read access // thanks for stopping by')] };

    case 'about':
      return {
        lines: [
          L('head', 'ABOUT'),
          L('out', 'Hardware technician and multi-disciplinary designer, based in Ndejje, Makindye Ssabagabo, Uganda.'),
          L('out', 'Phone and PC repair, brand and UI/UX design, embroidery file prep, and web builds.'),
          L('dim', 'meet the projects: ls projects    see what is offered: ls services    talk: ask'),
        ],
      };

    case 'stack':
      return {
        lines: [L('head', 'STACK'), ...TECH_STACK.map((t) => L('out', `${pad(t.label, 36)}[${t.level}]`))],
      };

    case 'status':
      return {
        lines: [
          L('ok', 'SYSTEM_STATUS: ONLINE'),
          L('out', `projects archived : ${ALL_PROJECTS.length}`),
          L('out', `services offered  : ${SERVICES.length}`),
          L('out', 'assistant        : ready (works without any AI model; on-device AI optional)'),
        ],
      };

    case 'neofetch': {
      const rows = [
        `guest@portfolio`,
        `-----------------`,
        `OS      : ${ctx.specs.os}`,
        `Screen  : ${ctx.specs.resolution}`,
        `CPU     : ${ctx.specs.cores}`,
        `Memory  : ${ctx.specs.memory}`,
        `Node    : NDEJJE, UG`,
        `Shell   : cyber-term v3`,
        `Uptime  : ${fmtDur(ctx.uptimeMs)}`,
      ];
      return { lines: rows.map((r, i) => L(i === 0 ? 'accent' : 'out', r)) };
    }

    case 'specs':
      return { lines: [L('out', `CLIENT_SPECS: OS: [${ctx.specs.os}] | RES: [${ctx.specs.resolution}] | THREADS: [${ctx.specs.cores}]`)] };
    case 'os':
      return { lines: [L('out', `PLATFORM: ${ctx.specs.platform} | ESTIMATED RAM: ${ctx.specs.memory}`)] };
    case 'ping':
      return { lines: [L('out', 'NETWORK_LATENCY: 14ms // NODE: NDEJJE SECURE RELAY // STATUS: OPTIMAL')] };

    case 'date': {
      const d = ctx.now ?? new Date();
      return { lines: [L('out', d.toString()), L('dim', 'from your own device clock')] };
    }
    case 'uptime':
      return { lines: [L('out', `session uptime: ${fmtDur(ctx.uptimeMs)}`)] };

    case 'light':
    case 'dark':
      return { lines: [L('ok', `DISPLAY_MODE: ${cmd.toUpperCase()}.`)], effects: [{ type: 'mode', mode: cmd as 'light' | 'dark' }] };
    case 'mode':
      return { lines: [L('ok', 'DISPLAY_MODE: Toggled light/dark.')], effects: [{ type: 'mode' }] };
    case 'theme': {
      if (!arg) return { lines: [L('ok', 'THEME_SHIFT: Accent cycled.')], effects: [{ type: 'theme' }] };
      if (ctx.themes.includes(arg)) return { lines: [L('ok', `THEME_SHIFT: System accent updated to ${arg.toUpperCase()}.`)], effects: [{ type: 'theme', theme: arg }] };
      return { lines: [L('err', 'USAGE: theme [cyan | amber | emerald]')] };
    }

    case 'history': {
      const h = [...ctx.history].reverse();
      return { lines: h.length ? h.map((c, i) => L('out', `${pad(String(i + 1), 4)}${c}`)) : [L('dim', 'nothing yet')] };
    }

    case 'echo':
      return { lines: [L('out', args.join(' ').slice(0, 200))] };

    case 'clear':
    case 'cls':
      return { lines: [], effects: [{ type: 'clear' }] };

    case 'joke':
      return { lines: [L('out', `JOKE: ${JOKES[Math.floor(rand() * JOKES.length)]}`)] };
    case 'fortune':
      return { lines: [L('out', FORTUNES[Math.floor(rand() * FORTUNES.length)])] };

    case 'hack':
      return {
        lines: [L('err', 'INITIATING TRACE... BYPASSING MAINFRAME FIREWALL...')],
        effects: [{ type: 'hack' }],
      };
    case 'matrix':
      return { lines: [L('ok', 'follow the white rabbit... (Ctrl+C to stop)')], effects: [{ type: 'matrix' }] };

    case 'sudo':
      return { lines: [L('err', 'guest is not in the sudoers file. This incident will be reported (to nobody).')] };
    case 'rm':
      return { lines: [L('err', 'rm: permission denied. Nice try though.')] };
    case 'exit':
    case 'quit':
      return { lines: [L('dim', 'There is nowhere to go. You are already on the website.')] };
    case 'pwd':
      return { lines: [L('out', '/home/guest')] };

    default: {
      const near = suggestCommand(cmd);
      return {
        lines: [
          L('err', `ERR: "${line.slice(0, 40)}" NOT RECOGNIZED. TYPE "help" FOR COMMAND LIST.`),
          ...(near ? [L('dim', `did you mean: ${near}?`)] : []),
          L('dim', 'or ask in plain words:  ask <your question>'),
        ],
      };
    }
  }
}
