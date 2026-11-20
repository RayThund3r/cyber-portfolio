// src/app/api/ai-pass/route.ts — visitor side of AI access: see plans, redeem a code, or request a pass after paying by mobile money.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { OWNER_QUOTA, createRequest, deviceOf, getConfig, quotaFor, redeem } from '@/server/aiAccess';
import { clean, clientIp, oneLine, rateLimit, readJsonLimited, sameOrigin } from '@/server/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const H = { 'Cache-Control': 'no-store' };
const reply = (body: unknown, status: number, cookie = '') => NextResponse.json(body, { status, headers: cookie ? { ...H, 'Set-Cookie': cookie } : H });

export async function GET(req: Request) {
  const dev = deviceOf(req);
  const owner = 'session' in (await requireAdmin(req).catch(() => ({ error: true }) as never));
  const [cfg, quota] = await Promise.all([getConfig(), owner ? OWNER_QUOTA : quotaFor(req, dev, clientIp(req))]);
  return reply({ quota, plans: cfg.enabled ? cfg.plans : [], payInfo: cfg.payInfo }, 200, dev.cookie);
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ error: 'origin' }, 403);
  const ip = clientIp(req);
  const parsed = await readJsonLimited(req, 4_000);
  if (!parsed.ok) return reply({ error: 'Bad request.' }, parsed.status || 400);
  const b = parsed.body || {};
  const dev = deviceOf(req);

  if (b.action === 'redeem') {
    if (rateLimit(`aipass:${ip}`, 8, 10 * 60_000)) return reply({ error: 'Too many tries. Please wait a few minutes.' }, 429, dev.cookie);
    const r = await redeem(b.code, dev);
    if (!r.ok) return reply({ error: r.error }, 400, dev.cookie);
    return reply({ ok: true, quota: await quotaFor(req, dev, ip) }, 200, dev.cookie);
  }

  if (b.action === 'request') {
    if (rateLimit(`aireq:${ip}`, 4, 60 * 60_000)) return reply({ error: 'Too many requests. Please try again later.' }, 429, dev.cookie);
    const name = oneLine(b.name, 60), contact = oneLine(b.contact, 80), txId = oneLine(b.txId, 40).replace(/\s+/g, '');
    if (name.length < 2) return reply({ error: 'Please enter your name.' }, 400, dev.cookie);
    if (contact.length < 5) return reply({ error: 'Please enter a phone number or email so we can reach you.' }, 400, dev.cookie);
    if (!/^[A-Za-z0-9._-]{6,40}$/.test(txId)) return reply({ error: 'Enter the transaction id from your payment message.' }, 400, dev.cookie);
    const r = await createRequest(dev, { plan: clean(b.plan, 24), name, contact, txId });
    if (!r.ok) return reply({ error: r.error }, 400, dev.cookie);
    return reply({ ok: true, id: r.id, message: 'Thanks! We will confirm your payment and unlock your pass on this device. This usually takes a short while.' }, 200, dev.cookie);
  }
  return reply({ error: 'Unknown action.' }, 400, dev.cookie);
}
