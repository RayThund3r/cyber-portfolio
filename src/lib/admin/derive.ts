// src/lib/admin/derive.ts — pure helpers that turn raw numbers into plain-language insight (digest, anomalies, gaps, lint).
import type { DayRow, Stats } from './stats';

export interface Anomaly { date: string; metric: string; value: number; typical: number; z: number; text: string }

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

/** Days whose numbers sit far outside the normal range for the other days in the window. */
export function findAnomalies(days: DayRow[]): Anomaly[] {
  if (days.length < 7) return [];
  const out: Anomaly[] = [];
  for (const [key, name] of [['pv', 'page views'], ['uv', 'visitors'], ['chat', 'chat questions'], ['gap', 'questions the assistant could not answer']] as const) {
    for (let i = 0; i < days.length; i++) {
      const rest = days.filter((_, k) => k !== i).map((d) => d[key]);
      const m = mean(rest), s = Math.max(sd(rest), 1);
      const v = days[i][key], z = (v - m) / s;
      if (z >= 2.5 && v >= Math.max(5, m * 1.8)) out.push({ date: days[i].date, metric: name, value: v, typical: Math.round(m), z: Math.round(z * 10) / 10, text: `${v} ${name} on ${days[i].date}, about ${(v / Math.max(m, 1)).toFixed(1)}× the usual ${Math.round(m)}.` });
    }
  }
  return out.sort((a, b) => b.z - a.z).slice(0, 5);
}

const pctTxt = (cur: number, prev: number) => (prev > 0 ? `${cur >= prev ? 'up' : 'down'} ${Math.abs(Math.round(((cur - prev) / prev) * 100))}%` : cur > 0 ? 'new this period' : 'flat at zero');

export function digest(s: Stats, opts: { unread: number; gaps: number }): string[] {
  const n = s.days.length;
  const lines: string[] = [];
  if (!s.totals.pv) {
    lines.push(`No page views were recorded in the last ${n} days.${s.mode === 'memory' ? ' The panel is on temporary storage, so counts reset whenever the server restarts: connect a free Upstash database under Health to keep them.' : ' Check that the analytics beacon is running on the public site.'}`);
  } else {
    lines.push(`Over the last ${n} days the site had ${s.totals.pv.toLocaleString()} page views from about ${s.totals.uv.toLocaleString()} visitors (views ${pctTxt(s.totals.pv, s.prev.pv)}, visitors ${pctTxt(s.totals.uv, s.prev.uv)} versus the previous ${n} days).`);
    const best = [...s.days].sort((a, b) => b.pv - a.pv)[0];
    if (best && best.pv > 0) lines.push(`Busiest day: ${best.date} with ${best.pv} views.`);
    if (s.paths[0]) lines.push(`Most visited page: ${s.paths[0].name} (${s.paths[0].n} views).${s.paths[1] ? ` Then ${s.paths[1].name}.` : ''}`);
    if (s.refs[0] && s.refs[0].name !== 'direct') lines.push(`Top referrer: ${s.refs[0].name}.`);
    const mobile = s.devices.find((d) => d.name === 'mobile');
    if (mobile) lines.push(`${Math.round((mobile.n / Math.max(1, s.devices.reduce((a, d) => a + d.n, 0))) * 100)}% of visits are on phones.`);
  }
  if (s.totals.chat) lines.push(`The assistant handled ${s.totals.chat} questions${s.totals.gap ? `, and could not answer ${s.totals.gap} of them (see Chat Lab → Gaps)` : ' and answered everything it was asked'}.`);
  if (s.games.length) lines.push(`Games: ${s.games.slice(0, 3).map((g) => `${g.id} (${g.plays} plays)`).join(', ')}.`);
  lines.push(opts.unread ? `${opts.unread} new request${opts.unread === 1 ? ' is' : 's are'} waiting for a first reply.` : 'No new requests are waiting.');
  return lines;
}

export interface GapGroup { key: string; text: string; n: number; last: number; answered: number }
const norm = (q: string) => q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\b(the|a|an|do|you|your|i|can|could|please|pls|is|are|my)\b/g, ' ').replace(/\s+/g, ' ').trim();
/** Groups near-identical questions so "Do you fix drones?" and "fix drones" count as one gap. */
export function groupQuestions(qs: Array<{ t: number; q: string; gap: boolean }>): { gaps: GapGroup[]; top: GapGroup[] } {
  const g = new Map<string, GapGroup>(), a = new Map<string, GapGroup>();
  for (const x of qs) {
    const key = norm(x.q) || x.q.toLowerCase();
    const m = x.gap ? g : a;
    const cur = m.get(key) || { key, text: x.q, n: 0, last: 0, answered: 0 };
    cur.n++; if (x.t > cur.last) { cur.last = x.t; cur.text = x.q; }
    m.set(key, cur);
  }
  const sort = (m: Map<string, GapGroup>) => [...m.values()].sort((p, q) => q.n - p.n || q.last - p.last);
  return { gaps: sort(g), top: sort(a).slice(0, 15) };
}

/** A ready-to-paste knowledge-base entry for a question the assistant could not answer. */
export function kbSnippet(question: string): string {
  const id = question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'new-entry';
  const words = [...new Set(norm(question).split(' ').filter((w) => w.length > 2))].slice(0, 8);
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `  {
    id: '${id}',
    domain: 'PORTFOLIO',
    title: '${esc(question.slice(0, 60))}',
    keywords: [${words.map((w) => `'${esc(w)}'`).join(', ')}],
    content: 'TODO: the plain facts about this.',
    reply: 'TODO: the friendly answer for visitors.',
    expert: 'TODO // the short technical answer.',
    suggestions: ['Get a quote', 'Contact'],
  },`;
}

export interface LintItem { where: string; level: 'warn' | 'info'; text: string }
export function lintContent(projects: Array<{ id: string; title: string; description: string; image: string; tools?: string[]; metrics?: string; gallery?: string[]; clientType?: string }>, services: Array<{ title?: string; id?: string; description?: string; timeline?: string }>): LintItem[] {
  const out: LintItem[] = [];
  for (const p of projects) {
    const w = `Project ${p.id} “${p.title}”`;
    if (!p.description || p.description.length < 60) out.push({ where: w, level: 'warn', text: `Description is short (${p.description?.length || 0} characters). Two sentences sell better.` });
    if (!p.tools || p.tools.length === 0) out.push({ where: w, level: 'info', text: 'No tools listed.' });
    if (!p.metrics) out.push({ where: w, level: 'info', text: 'No result/metric line (numbers build trust).' });
    if (!p.image) out.push({ where: w, level: 'warn', text: 'No cover image.' });
    else if (!/\.(webp|avif|jpe?g|png|svg)(\?|$)/i.test(p.image) && !/^https?:\/\//.test(p.image)) out.push({ where: w, level: 'info', text: `Image path “${p.image}” has an unusual extension.` });
    if (!p.gallery || p.gallery.length === 0) out.push({ where: w, level: 'info', text: 'No gallery images.' });
  }
  const seen = new Map<string, number>();
  for (const p of projects) seen.set(p.title.toLowerCase(), (seen.get(p.title.toLowerCase()) || 0) + 1);
  for (const [t, n] of seen) if (n > 1) out.push({ where: `Title “${t}”`, level: 'warn', text: `Used by ${n} projects.` });
  for (const s of services) { const w = `Service “${s.title || s.id}”`; if (!s.description || s.description.length < 40) out.push({ where: w, level: 'warn', text: 'Description is missing or very short.' }); if (!s.timeline) out.push({ where: w, level: 'info', text: 'No timeline stated.' }); }
  return out;
}

/** A strong random password (browser crypto), easy to type: groups of letters/digits, no look-alikes. */
export function genPassword(words = 4): string {
  const A = 'abcdefghjkmnpqrstuvwxyz', D = '23456789';
  const r = (n: number) => { const b = new Uint32Array(1); globalThis.crypto.getRandomValues(b); return b[0] % n; };
  const seg = () => Array.from({ length: 5 }, () => A[r(A.length)]).join('');
  return Array.from({ length: words }, seg).join('-') + '-' + D[r(8)] + D[r(8)];
}
export function passwordStrength(p: string): { bits: number; label: string; tone: 'bad' | 'warn' | 'ok' } {
  let pool = 0; if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10; if (/[^A-Za-z0-9]/.test(p)) pool += 32;
  const uniq = new Set(p).size;
  const bits = Math.round(Math.log2(Math.max(2, pool)) * Math.min(p.length, uniq * 2));
  return bits < 40 ? { bits, label: 'weak', tone: 'bad' } : bits < 64 ? { bits, label: 'fair', tone: 'warn' } : { bits, label: 'strong', tone: 'ok' };
}

/** "Site vitality": one friendly 0-100 number plus what moved it. */
export function vitality(s: Stats, unread: number, gapGroups: number): { score: number; parts: Array<{ label: string; pts: number; max: number; note: string }> } {
  const half = Math.floor(s.days.length / 2);
  const a = s.days.slice(0, half).reduce((x, d) => x + d.pv, 0), b = s.days.slice(half).reduce((x, d) => x + d.pv, 0);
  const trend = a === 0 ? (b > 0 ? 1 : 0.5) : Math.max(0, Math.min(1.5, b / a)) / 1.5;
  const engaged = s.totals.pv ? Math.min(1, (s.totals.chat + s.totals.games + s.totals.msgs * 3) / Math.max(1, s.totals.uv)) : 0;
  const answered = s.totals.chat ? 1 - Math.min(1, s.totals.gap / s.totals.chat) : 0.8;
  const inbox = unread === 0 ? 1 : Math.max(0, 1 - unread / 6);
  const parts = [
    { label: 'Traffic trend', pts: Math.round(trend * 30), max: 30, note: a === 0 && b === 0 ? 'no traffic yet' : b >= a ? 'holding or growing' : 'slipping' },
    { label: 'Engagement', pts: Math.round(engaged * 25), max: 25, note: 'chats, games and requests per visitor' },
    { label: 'Assistant coverage', pts: Math.round(answered * 25), max: 25, note: gapGroups ? `${gapGroups} open gap${gapGroups === 1 ? '' : 's'}` : 'no open gaps' },
    { label: 'Requests answered', pts: Math.round(inbox * 20), max: 20, note: unread ? `${unread} new` : 'none waiting' },
  ];
  return { score: parts.reduce((x, p) => x + p.pts, 0), parts };
}

/** Best hours (UTC) to be reachable, as readable windows. */
export function busyWindows(hours: number[]): string[] {
  const total = hours.reduce((x, y) => x + y, 0);
  if (total < 10) return [];
  return hours.map((v, h) => ({ v, h })).sort((p, q) => q.v - p.v).slice(0, 3).filter((x) => x.v > 0).map((x) => `${String(x.h).padStart(2, '0')}:00–${String((x.h + 1) % 24).padStart(2, '0')}:00 UTC (${Math.round((x.v / total) * 100)}% of views)`);
}

export function weeklyReportMarkdown(s: Stats, lines: string[], gaps: GapGroup[], siteName = 'System Portfolio'): string {
  const row = (d: DayRow) => `| ${d.date} | ${d.pv} | ${d.uv} | ${d.chat} | ${d.msgs} |`;
  return [
    `# ${siteName}: report for ${s.days[0]?.date} to ${s.days[s.days.length - 1]?.date}`, '',
    '## In short', ...lines.map((l) => `- ${l}`), '',
    '## Numbers', `- Page views: **${s.totals.pv}**`, `- Visitors: **${s.totals.uv}**`, `- Chat questions: **${s.totals.chat}** (${s.totals.gap} unanswered)`, `- Messages received: **${s.totals.msgs}**`, '',
    '| Date | Views | Visitors | Chat | Messages |', '|---|---|---|---|---|', ...s.days.map(row), '',
    '## Top pages', ...(s.paths.length ? s.paths.slice(0, 8).map((p) => `- ${p.name}: ${p.n}`) : ['- none yet']), '',
    '## Where visitors came from', ...(s.refs.length ? s.refs.slice(0, 6).map((p) => `- ${p.name}: ${p.n}`) : ['- none yet']), '',
    '## Questions the assistant could not answer', ...(gaps.length ? gaps.slice(0, 10).map((g) => `- ${g.text} (${g.n}×)`) : ['- none']), '',
  ].join('\n');
}
