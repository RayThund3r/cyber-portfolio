// src/lib/admin/track.ts — privacy-friendly first-party analytics: no cookies, no raw IPs stored, honours Do-Not-Track
// (the browser side refuses to send), counts are aggregated per UTC day.  Uniques are a HyperLogLog of a hash that
// rotates every day, so a visitor can't be followed from one day to the next.
import { clientInfo } from './auth';
import { sha256Hex } from './crypto';
import { getStore } from './store';

export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|preview|facebookexternalhit|whatsapp|telegram|discord/i;

export function parseUA(ua: string): { browser: string; os: string } {
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /firefox|fxios/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Other';
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /mac os|macintosh/i.test(ua) ? 'macOS' : /linux|cros/i.test(ua) ? 'Linux' : 'Other';
  return { browser, os };
}
const cleanPath = (p: unknown) => {
  if (typeof p !== 'string') return '';
  const path = p.split(/[?#]/)[0].slice(0, 80);
  return /^\/[A-Za-z0-9/_\-.]*$/.test(path) ? (path.length > 1 ? path.replace(/\/+$/, '') : path) : '';
};
const cleanText = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n) : '');
const refHost = (r: unknown, selfHost: string) => {
  if (typeof r !== 'string' || !r) return 'direct';
  try { const h = new URL(r).host.replace(/^www\./, ''); return h === selfHost.replace(/^www\./, '') ? 'direct' : h.slice(0, 60); } catch { return 'direct'; }
};
const GAME_ID = /^[a-z0-9]{2,20}$/;
const SRC = new Set(['rules', 'knowledge', 'web', 'local-ai', 'remote-ai', 'system']);

export interface TrackBody { k?: unknown; p?: unknown; r?: unknown; w?: unknown; q?: unknown; src?: unknown; g?: unknown; id?: unknown; res?: unknown; ms?: unknown }
export interface LiveEvent { t: number; k: string; p?: string; c?: string; d?: string; x?: string }

const expireMemo = new Set<string>();

/** Returns false when the event was ignored (bot, bad shape, rate limit). Never throws. */
export async function recordEvent(req: Request, body: TrackBody): Promise<boolean> {
  try {
    const who = await clientInfo(req);
    if (BOT.test(who.ua) || !who.ua) return false;
    const k = typeof body.k === 'string' ? body.k : '';
    if (!['pv', 'chat', 'gap', 'game', 'perf'].includes(k)) return false;
    const store = getStore();
    const day = dayKey(), minute = Math.floor(Date.now() / 60000);
    const rlKey = `rl:trk:${who.ipHash}:${minute}`;
    const n = await store.cmd<number>('INCR', rlKey);
    if (n === 1) await store.cmd('EXPIRE', rlKey, 90);
    if (n > 90) return false;

    const { browser, os } = parseUA(who.ua);
    const w = Number(body.w) || 0;
    const device = w ? (w < 768 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop') : /mobile|android|iphone/i.test(who.ua) ? 'mobile' : 'desktop';
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
    const h = `s:d:${day}`;
    const cmds: Array<Array<string | number>> = [];
    const live: LiveEvent = { t: Date.now(), k, c: who.country || undefined, d: device };

    if (k === 'pv') {
      const p = cleanPath(body.p);
      if (!p || p.startsWith('/admin')) return false;
      const uid = (await sha256Hex(`${who.ip}|${who.ua}|${day}|${who.ipHash}`)).slice(0, 20);
      cmds.push(['HINCRBY', h, 'pv', 1], ['HINCRBY', h, 'p:' + p, 1], ['HINCRBY', h, 'r:' + refHost(body.r, host), 1], ['HINCRBY', h, 'd:' + device, 1],
        ['HINCRBY', h, 'b:' + browser, 1], ['HINCRBY', h, 'o:' + os, 1], ['HINCRBY', h, 'h:' + new Date().getUTCHours(), 1], ['PFADD', 's:u:' + day, uid]);
      if (who.country) cmds.push(['HINCRBY', h, 'c:' + who.country, 1]);
      live.p = p;
    } else if (k === 'chat' || k === 'gap') {
      const q = cleanText(body.q, 240);
      if (q.length < 2) return false;
      const src = typeof body.src === 'string' && SRC.has(body.src) ? body.src : 'rules';
      const gap = k === 'gap' || body.g === true || body.g === 1;
      cmds.push(['HINCRBY', h, k === 'gap' ? 'gap' : 'chat', 1]);
      if (k === 'chat') cmds.push(['HINCRBY', h, 'cs:' + src, 1]);
      if (gap && k === 'gap') cmds.push(['LPUSH', 's:q', JSON.stringify({ t: Date.now(), q, src, gap: true })], ['LTRIM', 's:q', 0, 499]);
      else if (k === 'chat') cmds.push(['LPUSH', 's:q', JSON.stringify({ t: Date.now(), q, src, gap: false })], ['LTRIM', 's:q', 0, 499]);
      live.x = q.slice(0, 80);
    } else if (k === 'game') {
      const id = typeof body.id === 'string' && GAME_ID.test(body.id) ? body.id : '';
      const res = typeof body.res === 'string' && ['w', 'l', 'd', 'p'].includes(body.res) ? body.res : '';
      if (!id || !res) return false;
      cmds.push(['HINCRBY', h, `g:${id}:${res}`, 1], ['HINCRBY', h, 'game', 1]);
      live.x = `${id}:${res}`;
    } else if (k === 'perf') {
      const ms = Math.round(Number(body.ms));
      const p = cleanPath(body.p);
      if (!p || !(ms > 0 && ms < 60000)) return false;
      cmds.push(['HINCRBY', h, 'lt:' + p, ms], ['HINCRBY', h, 'ln:' + p, 1]);
    }
    if (k !== 'perf') cmds.push(['LPUSH', 's:ev', JSON.stringify(live)], ['LTRIM', 's:ev', 0, 119]);
    const ttlKey = h + (k === 'pv' ? '' : '');
    if (!expireMemo.has(ttlKey)) { cmds.push(['EXPIRE', h, 130 * 86400], ['EXPIRE', 's:u:' + day, 130 * 86400]); expireMemo.add(ttlKey); if (expireMemo.size > 50) expireMemo.clear(); }
    await store.pipe(cmds);
    return true;
  } catch { return false; }
}
