// src/app/api/llm/route.ts — GET: is the cloud model reachable?  POST: stream an answer from it.
import { NextResponse } from 'next/server';
import { llmConfig, llmConfigured, llmHealth, sanitizeMessages, streamCompletion } from '@/server/llm';
import { clientIp, rateLimit, readJsonLimited, sameOrigin } from '@/server/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const H = { 'Cache-Control': 'no-store' };

export async function GET() {
  if (!llmConfigured()) return NextResponse.json({ available: false }, { headers: H });
  const h = await llmHealth();
  return NextResponse.json({ available: h.ok, label: llmConfig().label }, { headers: H });
}

export async function POST(req: Request) {
  if (!llmConfigured()) return NextResponse.json({ error: 'off' }, { status: 503, headers: H });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403, headers: H });
  const c = llmConfig();
  if (rateLimit(`llm:${clientIp(req)}`, c.ratePerMin, 60_000)) return NextResponse.json({ error: 'slow-down' }, { status: 429, headers: H });

  const parsed = await readJsonLimited(req, 24_000);
  if (!parsed.ok) return NextResponse.json({ error: 'bad-request' }, { status: parsed.status || 400, headers: H });
  const messages = sanitizeMessages(parsed.body?.messages);
  if (!messages) return NextResponse.json({ error: 'bad-messages' }, { status: 400, headers: H });

  // Stop paying for (and waiting on) the upstream when the visitor navigates away or presses stop.
  const ctl = new AbortController();
  req.signal.addEventListener('abort', () => ctl.abort());
  const timer = setTimeout(() => ctl.abort(), 55_000);
  try {
    const res = await streamCompletion(messages, ctl.signal);
    return res;
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502, headers: H });
  } finally {
    clearTimeout(timer);
  }
}
