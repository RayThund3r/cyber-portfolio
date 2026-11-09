import { NextResponse } from 'next/server';
import { bumpView, bumpEvent, bumpUnanswered } from '@/server/store';
import { reportServerError } from '@/server/mail';
import { clean, clientIp, rateLimit, readJsonLimited } from '@/server/util';
import { recordEvent } from '@/lib/admin/track';

export const runtime = 'nodejs';

/** Only real page addresses are counted: arbitrary text from a visitor must never become a stored key. */
const PAGES = new Set(['portfolio', 'services', 'contact', 'track', 'builder', 'privacy', 'games']);
function normPath(raw: string): string | null {
  const segs = raw.split(/[?#]/)[0].split('/').filter(Boolean);
  if (!segs.length) return '/';
  if (!PAGES.has(segs[0])) return null;
  if (segs[0] === 'portfolio' && segs[1] && /^[A-Za-z0-9-]{1,20}$/.test(segs[1])) return `/portfolio/${segs[1]}`;
  return `/${segs[0]}`;
}

const EVENTS = new Set(['whatsapp_click', 'contact_submit', 'booking_created', 'track_view', 'chat_open', 'chat_handoff', 'payment_submitted']);
const scrub = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\d[\d\s().+-]{5,}\d/g, '[number]').toLowerCase().slice(0, 120);

/** Privacy-friendly analytics: no cookies, no IPs stored, only aggregate counters. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (rateLimit(`ev:${ip}`, 90, 60_000)) return new NextResponse(null, { status: 204 });
  const parsed = await readJsonLimited(req, 4096);
  if (!parsed.ok) return new NextResponse(null, { status: 204 });
  const b: any = parsed.body;

  const t = String(b?.t || '');
  // Richer, referrer / device / hour / game aware numbers for the admin tools (best effort, never blocks a visitor).
  if (t === 'view' || t === 'chat' || t === 'game' || t === 'perf' || t === 'unanswered') {
    const map: Record<string, Record<string, unknown>> = {
      view: { k: 'pv', p: b.p, r: b.r, w: b.w }, chat: { k: 'chat', q: b.q, src: b.src }, game: { k: 'game', id: b.id, res: b.res },
      perf: { k: 'perf', p: b.p, ms: b.ms }, unanswered: { k: 'gap', q: b.q },
    };
    if (!String(b?.p || '').startsWith('/admin')) await recordEvent(req, map[t]);
  }
  if (t === 'view') {
    const p = normPath(clean(b.p, 120));
    if (p) await bumpView(p);
  } else if (t === 'event' && EVENTS.has(String(b.n))) {
    await bumpEvent(String(b.n));
  } else if (t === 'unanswered') {
    const q = scrub(String(b.q || ''));
    if (q.length >= 3) await bumpUnanswered(q);
  } else if (t === 'error') {
    if (!rateLimit(`err:${ip}`, 10, 60_000) && !rateLimit('err:all', 60, 3_600_000)) await reportServerError(`client:${clean(b.w, 60) || 'unknown'}`, clean(b.m, 300) || 'unknown error');
  }
  return new NextResponse(null, { status: 204 });
}
