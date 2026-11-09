// src/lib/admin/shell.ts — the admin "Shell": a command line for the panel. Pure logic (all effects come in through `deps`),
// so it is unit-tested without a browser.
import type { Stats } from './stats';
import type { DeskSummary } from './desk';
import type { SiteConfig } from './siteconfig';
import { digest, groupQuestions } from './derive';

export interface ShellDeps {
  get<T>(path: string): Promise<T>;
  send<T>(path: string, method: string, body: unknown): Promise<T>;
  go(href: string): void;
  toggleGhost(): void;
  cycleTheme(): void;
  signOut(): Promise<void>;
  download(name: string, text: string): void;
  now(): number;
}
export type Line = { t: 'out' | 'dim' | 'ok' | 'err' | 'head'; s: string };
export interface ShellResult { lines: Line[]; clear?: boolean; matrix?: boolean }

const L = (t: Line['t'], s: string): Line => ({ t, s });
export const COMMANDS: Array<{ name: string; usage: string; desc: string }> = [
  { name: 'help', usage: 'help', desc: 'List commands' },
  { name: 'stats', usage: 'stats [days]', desc: 'Visitors, views and chat numbers (default 7 days)' },
  { name: 'top', usage: 'top [pages|refs|countries|devices]', desc: 'Leaderboards' },
  { name: 'live', usage: 'live', desc: 'The most recent events' },
  { name: 'tickets', usage: 'tickets [n]', desc: 'Latest requests and bookings (default 5)' },
  { name: 'gaps', usage: 'gaps', desc: 'Questions the assistant could not answer' },
  { name: 'digest', usage: 'digest', desc: 'A plain-language summary of the week' },
  { name: 'health', usage: 'health', desc: 'Setup checklist and storage status' },
  { name: 'announce', usage: 'announce <text> | announce off', desc: 'Show or hide the site-wide banner' },
  { name: 'status', usage: 'status <available|busy|away>', desc: 'Set your availability' },
  { name: 'signout-all', usage: 'signout-all', desc: 'Log out every device (you included)' },
  { name: 'backup', usage: 'backup', desc: 'Download everything as a JSON file' },
  { name: 'goto', usage: 'goto <page>', desc: 'Open an admin page (desk, chat, site, health...)' },
  { name: 'ghost', usage: 'ghost', desc: 'Toggle privacy blur' },
  { name: 'theme', usage: 'theme', desc: 'Cycle the colour theme' },
  { name: 'whoami', usage: 'whoami', desc: 'Your session' },
  { name: 'matrix', usage: 'matrix', desc: 'You know what this does' },
  { name: 'clear', usage: 'clear', desc: 'Clear the screen' },
  { name: 'logout', usage: 'logout', desc: 'Sign out' },
];
const PAGES: Record<string, string> = { desk: '/admin', home: '/admin', overview: '/admin/overview', analytics: '/admin/analytics', tickets: '/admin', chat: '/admin/chat', site: '/admin/site', health: '/admin/health', security: '/admin/security', board: '/admin/board', shell: '/admin/shell', lab: '/admin/lab' };

const pad = (s: string | number, n: number) => String(s).padEnd(n).slice(0, n);
const bar = (n: number, max: number, w = 18) => '█'.repeat(Math.max(n > 0 ? 1 : 0, Math.round((n / Math.max(1, max)) * w)));
const ago = (t: number, now: number) => { const s = Math.max(0, Math.round((now - t) / 1000)); return s < 60 ? 'now' : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`; };

export function suggest(prefix: string): string[] {
  const p = prefix.trim().toLowerCase();
  return p ? COMMANDS.filter((c) => c.name.startsWith(p)).map((c) => c.name) : [];
}

export async function runShell(line: string, d: ShellDeps): Promise<ShellResult> {
  const raw = line.trim();
  if (!raw) return { lines: [] };
  const [cmd0, ...rest] = raw.split(/\s+/);
  const cmd = cmd0.toLowerCase();
  const arg = rest.join(' ');
  try {
    switch (cmd) {
      case 'help': case '?':
        return { lines: [L('head', 'COMMANDS'), ...COMMANDS.map((c) => L('out', `${pad(c.usage, 36)}${c.desc}`))] };
      case 'clear': case 'cls': return { lines: [], clear: true };
      case 'matrix': return { lines: [L('ok', 'Wake up, operator…')], matrix: true };
      case 'ghost': d.toggleGhost(); return { lines: [L('ok', 'Ghost mode toggled.')] };
      case 'theme': d.cycleTheme(); return { lines: [L('ok', 'Theme changed.')] };
      case 'logout': case 'exit': await d.signOut(); return { lines: [L('ok', 'Signed out.')] };
      case 'goto': case 'cd': case 'open': {
        const href = PAGES[arg.toLowerCase().replace(/^\//, '')];
        if (!href) return { lines: [L('err', `unknown page "${arg}". Try: ${Object.keys(PAGES).filter((k) => k !== 'home').join(', ')}`)] };
        d.go(href); return { lines: [L('ok', `-> ${href}`)] };
      }
      case 'whoami': { const m = await d.get<{ sid: string; exp: number; store: string; totp: boolean }>('/api/admin/me'); return { lines: [L('out', `session   ${m.sid}…`), L('out', `expires   in ${Math.max(0, Math.round((m.exp - d.now()) / 60000))} min`), L('out', `storage   ${m.store === 'upstash' ? 'permanent (Upstash)' : 'temporary (memory)'}`), L('out', `2FA       ${m.totp ? 'on' : 'off'}`)] }; }
      case 'stats': {
        const days = Math.max(1, Math.min(90, parseInt(arg, 10) || 7));
        const s = await d.get<Stats>(`/api/admin/stats?days=${days}`);
        const max = Math.max(1, ...s.days.map((x) => x.pv));
        return { lines: [L('head', `LAST ${days} DAYS`), L('out', `views ${s.totals.pv}   visitors ${s.totals.uv}   chat ${s.totals.chat} (${s.totals.gap} unanswered)   games ${s.totals.games}   messages ${s.totals.msgs}`), ...s.days.slice(-Math.min(days, 14)).map((x) => L('dim', `${x.date.slice(5)} ${pad(x.pv, 5)}${bar(x.pv, max)}`))] };
      }
      case 'top': {
        const s = await d.get<Stats>('/api/admin/stats?days=14');
        const what = (arg || 'pages').toLowerCase();
        const list = what.startsWith('ref') ? s.refs : what.startsWith('c') ? s.countries : what.startsWith('d') ? s.devices : s.paths;
        if (!list.length) return { lines: [L('dim', 'no data yet')] };
        return { lines: [L('head', `TOP ${what.toUpperCase()} (14 days)`), ...list.slice(0, 10).map((x) => L('out', `${pad(x.n, 6)}${x.name}`))] };
      }
      case 'live': {
        const r = await d.get<{ events: Array<{ t: number; k: string; p?: string; x?: string; c?: string }>; activeNow: number }>('/api/admin/live');
        if (!r.events.length) return { lines: [L('dim', 'quiet. nothing in the last while.')] };
        return { lines: [L('head', `${r.activeNow} page views in the last 5 minutes`), ...r.events.slice(0, 12).map((e) => L('out', `${pad(ago(e.t, d.now()), 5)}${pad(e.k, 6)}${e.p || e.x || ''} ${e.c || ''}`))] };
      }
      case 'tickets': case 'inbox': {
        const n = Math.max(1, Math.min(20, parseInt(arg, 10) || 5));
        const r = await d.get<DeskSummary>('/api/admin/desk?limit=' + n);
        if (!r.total) return { lines: [L('dim', 'no requests yet')] };
        return { lines: [L('head', `${r.fresh} new, ${r.open} open, ${r.awaitingDeposit} awaiting deposit (${r.total} total)`), ...r.latest.slice(0, n).map((m) => L(m.status === 'RECEIVED' ? 'ok' : 'out', `${pad(ago(Date.parse(m.createdAt), d.now()), 5)}${pad(m.id, 12)}${pad(m.status.toLowerCase(), 16)}${pad(m.name, 14)}${m.snippet.slice(0, 40)}`))] };
      }
      case 'gaps': {
        const r = await d.get<{ questions: Array<{ t: number; q: string; gap: boolean }> }>('/api/admin/chat');
        const g = groupQuestions(r.questions).gaps;
        return g.length ? { lines: [L('head', `${g.length} UNANSWERED`), ...g.slice(0, 12).map((x) => L('out', `${pad(x.n + 'x', 5)}${x.text}`)), L('dim', 'tip: Chat Lab -> Gaps drafts a knowledge entry for each')] } : { lines: [L('ok', 'no gaps recorded')] };
      }
      case 'digest': {
        const [s, i, c] = await Promise.all([d.get<Stats>('/api/admin/stats?days=7'), d.get<DeskSummary>('/api/admin/desk'), d.get<{ questions: Array<{ t: number; q: string; gap: boolean }> }>('/api/admin/chat')]);
        return { lines: digest(s, { unread: i.fresh, gaps: groupQuestions(c.questions).gaps.length }).map((x) => L('out', '- ' + x)) };
      }
      case 'health': {
        const h = await d.get<{ env: Array<{ name: string; set: boolean; required: boolean }>; store: { mode: string; ok: boolean; ms: number } }>('/api/admin/health');
        return { lines: [L(h.store.ok ? 'ok' : 'err', `storage: ${h.store.mode} ${h.store.ok ? 'ok' : 'FAILED'} (${h.store.ms} ms)`), ...h.env.map((e) => L(e.set ? 'ok' : e.required ? 'err' : 'dim', `${e.set ? '[x]' : '[ ]'} ${e.name}`))] };
      }
      case 'signout-all': {
        await d.send('/api/admin', 'POST', { action: 'logoutAll' });
        await d.signOut();
        return { lines: [L('ok', 'all sessions ended')] };
      }
      case 'announce': {
        const cur = (await d.get<{ config: SiteConfig }>('/api/admin/config')).config;
        if (!arg) return { lines: [L('out', cur.announce.enabled ? `ON: "${cur.announce.text}"` : 'off'), L('dim', 'usage: announce <text> | announce off')] };
        const next = arg.toLowerCase() === 'off' ? { ...cur, announce: { ...cur.announce, enabled: false } } : { ...cur, announce: { ...cur.announce, enabled: true, text: arg.slice(0, 240), expires: 0 } };
        const r = await d.send<{ config: SiteConfig }>('/api/admin/config', 'PUT', { config: next });
        return { lines: [L('ok', r.config.announce.enabled ? `banner is live: "${r.config.announce.text}"` : 'banner hidden')] };
      }
      case 'status': {
        const v = arg.toLowerCase();
        if (!['available', 'busy', 'away'].includes(v)) return { lines: [L('err', 'usage: status <available|busy|away>')] };
        const cur = (await d.get<{ config: SiteConfig }>('/api/admin/config')).config;
        await d.send('/api/admin/config', 'PUT', { config: { ...cur, availability: v } });
        return { lines: [L('ok', `availability: ${v}`)] };
      }
      case 'backup': {
        const data = await d.get<unknown>('/api/admin/backup');
        d.download(`sys-admin-backup-${new Date(d.now()).toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
        return { lines: [L('ok', 'backup downloaded')] };
      }
      case 'sudo': return { lines: [L('err', 'nice try. you are already the administrator.')] };
      case 'rm': return { lines: [L('err', 'rm: refusing. delete requests one at a time from the Desk.')] };
      case 'ls': return { lines: [L('out', Object.keys(PAGES).filter((k) => k !== 'home').join('  '))] };
      case 'date': return { lines: [L('out', new Date(d.now()).toString())] };
      case 'echo': return { lines: [L('out', arg)] };
      default: {
        const near = suggest(cmd.slice(0, 2));
        return { lines: [L('err', `command not found: ${cmd}`), L('dim', near.length ? `did you mean: ${near.join(', ')}?` : 'type "help"')] };
      }
    }
  } catch (e) {
    return { lines: [L('err', e instanceof Error ? e.message : 'command failed')] };
  }
}
