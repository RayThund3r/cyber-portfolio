// src/lib/events/config.ts — owner settings for the world-events feature (pure: validated on the server, safe to import in the browser).
// Custom events are how the site responds to things no calendar knows about (a national mourning, a big match night, a launch).
import type { FxName, Tone, WorldEvent } from './calendar';
import { activeEvents } from './calendar';

export interface CustomEvent {
  id: string;
  name: string;
  /** Ribbon text shown at the top of the site. */
  ribbon: string;
  /** What the assistant says about it. */
  say: string;
  tone: Tone;
  fx: FxName;
  /** First and last day, inclusive: YYYY-MM-DD. */
  from: string;
  to: string;
  /** Repeat every year (day and month only). */
  yearly?: boolean;
  href?: string;
}
export interface EventsConfig { enabled: boolean; fx: boolean; off: string[]; custom: CustomEvent[] }
export const DEFAULT_EVENTS_CFG: EventsConfig = { enabled: true, fx: true, off: [], custom: [] };
export const MAX_CUSTOM = 40;

const FX: FxName[] = ['confetti', 'snow', 'hearts', 'lanterns', 'stars', 'leaves', 'rain', 'none'];
const TONES: Tone[] = ['celebrate', 'solemn', 'awareness'];
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g, '').trim().slice(0, max) : '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) => DATE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const safeHref = (s: unknown): string => { const v = clean(s, 200); return /^\/[a-z0-9/_\-?=&#.]*$/i.test(v) && !v.startsWith('//') ? v : ''; };

export function sanitizeEventsCfg(raw: unknown): EventsConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const off = Array.isArray(o.off) ? o.off.map((x) => clean(x, 40)).filter(Boolean).slice(0, 80) : [];
  const custom: CustomEvent[] = [];
  const seen = new Set<string>();
  for (const c of Array.isArray(o.custom) ? o.custom : []) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    const name = clean(r.name, 60); const from = clean(r.from, 10); let to = clean(r.to, 10) || from;
    if (name.length < 2 || !validDate(from) || !validDate(to)) continue;
    if (to < from) to = from;
    let id = clean(r.id, 30).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'c' + (custom.length + 1) + Date.now().toString(36);
    if (seen.has(id)) id += custom.length; seen.add(id);
    custom.push({
      id, name, ribbon: clean(r.ribbon, 160) || name, say: clean(r.say, 300) || clean(r.ribbon, 160) || name,
      tone: TONES.includes(r.tone as Tone) ? (r.tone as Tone) : 'celebrate',
      fx: FX.includes(r.fx as FxName) ? (r.fx as FxName) : 'none',
      from, to, yearly: r.yearly === true || undefined, href: safeHref(r.href) || undefined,
    });
    if (custom.length >= MAX_CUSTOM) break;
  }
  return { enabled: o.enabled !== false, fx: o.fx !== false, off, custom };
}

const dayNum = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
/** Custom events covering `now`. A solemn event never gets celebration effects. */
export function activeCustom(cfg: EventsConfig, now: Date = new Date()): WorldEvent[] {
  const t = dayNum(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const out: WorldEvent[] = [];
  for (const c of cfg.custom) {
    if (cfg.off.includes(c.id)) continue;
    const years = c.yearly ? [now.getFullYear() - 1, now.getFullYear()] : [0];
    for (const y of years) {
      const [fy, fm, fd] = c.from.split('-').map(Number), [ty, tm, td] = c.to.split('-').map(Number);
      const s = dayNum(y ? y : fy, fm, fd), e = dayNum(y ? y + (ty - fy) : ty, tm, td);
      if (t >= s && t <= e) {
        out.push({ id: c.id, name: c.name, scope: 'custom', tone: c.tone, icon: c.tone === 'solemn' ? 'bell' : 'spark', fx: c.tone === 'solemn' ? 'none' : c.fx, ribbon: c.ribbon, say: c.say, weight: 100, href: c.href });
        break;
      }
    }
  }
  return out;
}

/** Everything the site should react to right now, most important first (owner custom events win). */
export function eventsNow(cfg: EventsConfig = DEFAULT_EVENTS_CFG, now: Date = new Date()): WorldEvent[] {
  if (!cfg.enabled) return [];
  return [...activeCustom(cfg, now), ...activeEvents(now, cfg.off)];
}
