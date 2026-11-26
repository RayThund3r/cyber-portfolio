// src/app/api/llm/route.ts — GET: is the cloud model reachable?  POST: stream an answer from it.
import { NextResponse } from 'next/server';
import { llmConfig, sanitizeMessages } from '@/server/llm';
import { anyAvailable, streamWithFallback } from '@/server/llmProviders';
import { clientIp, rateLimit, readJsonLimited, sameOrigin } from '@/server/util';
import { requireAdmin } from '@/lib/admin/auth';
import { OWNER_QUOTA, deviceOf, quotaFor, refund, spend } from '@/server/aiAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const H = { 'Cache-Control': 'no-store' };

const withCookie = (h: Record<string, string>, cookie: string) => (cookie ? { ...h, 'Set-Cookie': cookie } : h);

export async function GET(req: Request) {
  const av = await anyAvailable();
  if (!av.available) return NextResponse.json({ available: false }, { headers: H });
  const dev = deviceOf(req);
  const owner = 'session' in (await requireAdmin(req).catch(() => ({ error: true }) as never));
  const quota = owner ? OWNER_QUOTA : await quotaFor(req, dev, clientIp(req)).catch(() => null);
  return NextResponse.json({ available: true, label: av.label || llmConfig().label, quota }, { headers: withCookie(H, dev.cookie) });
}

export async function POST(req: Request) {
  if (!(await anyAvailable()).available) return NextResponse.json({ error: 'off' }, { status: 503, headers: H });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403, headers: H });
  const c = llmConfig();
  if (rateLimit(`llm:${clientIp(req)}`, c.ratePerMin, 60_000)) return NextResponse.json({ error: 'slow-down' }, { status: 429, headers: H });

  const parsed = await readJsonLimited(req, 80_000);
  if (!parsed.ok) return NextResponse.json({ error: 'bad-request' }, { status: parsed.status || 400, headers: H });
  const messages = sanitizeMessages(parsed.body?.messages);
  if (!messages) return NextResponse.json({ error: 'bad-messages' }, { status: 400, headers: H });

  // Daily allowance: free answers first, then any access pass. When it is used up the chat falls back to the rules engine.
  const dev = deviceOf(req), ip = clientIp(req);
  const owner = 'session' in (await requireAdmin(req).catch(() => ({ error: true }) as never));
  const spent = owner ? null : await spend(dev, ip).catch(() => null); // signed-in owner: no limits
  if (spent && !spent.ok) return NextResponse.json({ error: 'limit', quota: spent.quota }, { status: 429, headers: withCookie(H, dev.cookie) });
  const via = spent && spent.ok ? spent.via : 'open';

  // Stop paying for (and waiting on) the upstream when the visitor navigates away or presses stop.
  const ctl = new AbortController();
  req.signal.addEventListener('abort', () => ctl.abort());
  const timer = setTimeout(() => ctl.abort(), 55_000);
  try {
    const { res } = await streamWithFallback(messages, ctl.signal);
    const headers = new Headers(res.headers);
    if (dev.cookie) headers.set('Set-Cookie', dev.cookie);
    if (spent && spent.ok) headers.set('X-AI-Left', String(spent.quota.left));
    return new Response(res.body, { status: res.status, headers });
  } catch {
    await refund(dev, ip, via); // never charge for an upstream failure
    return NextResponse.json({ error: 'upstream' }, { status: 502, headers: H });
  } finally {
    clearTimeout(timer);
  }
}
