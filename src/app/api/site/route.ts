// src/app/api/site/route.ts — public API used by Pro sites hosted ANYWHERE (hence CORS *). No cookies are used or accepted, so a
// wildcard origin is safe: owner endpoints need the owner token in the body, visitor endpoints are write-only / non-personal.
import { NextResponse } from 'next/server';
import { cloudEnabled, getSite, ownerDelete, ownerList, ownerRotate, ownerBlocked, ownerUpdate, slotsTaken, submit, trackOrder, verifyOwner } from '@/server/cloud';
import { clientIp, rateLimit } from '@/server/util';
import { reportServerError } from '@/server/mail';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Cache-Control': 'no-store' };
const out = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });
const MAX_BODY = 40_000;

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: Request) {
  if (!cloudEnabled()) return out({ error: 'disabled' }, 503);
  const url = new URL(req.url), ip = clientIp(req);
  if (rateLimit(`cl-slots:${ip}`, 120, 10 * 60_000)) return out({ error: 'slow_down' }, 429);
  const site = await getSite(url.searchParams.get('id'));
  if (!site) return out({ error: 'not_found' }, 404);
  if (site.disabled) return out({ error: 'disabled' }, 403);
  const r = await slotsTaken(site, url.searchParams.get('date'));
  return out(r.body, r.status);
}

export async function POST(req: Request) {
  if (!cloudEnabled()) return out({ error: 'disabled' }, 503);
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return out({ error: 'too_large' }, 413);
    let b: any; try { b = JSON.parse(text); } catch { return out({ error: 'bad_json' }, 400); }
    if (!b || typeof b !== 'object') return out({ error: 'bad_json' }, 400);
    const ip = clientIp(req), site = await getSite(b.id);
    if (!site) return out({ error: 'not_found' }, 404);
    if (site.disabled) return out({ error: 'disabled' }, 403);   // the operator switched this shop off (abuse, non-payment…)
    const action = String(b.action || '');

    // ── visitor actions ──
    if (action === 'submit') {
      if (rateLimit(`cl-ip:${ip}:${site.id}`, 30, 10 * 60_000)) return out({ error: 'slow_down' }, 429);   // one address
      if (rateLimit(`cl-site:${site.id}`, Math.max(10, Number(process.env.CLOUD_SITE_HOURLY_LIMIT) || 400), 60 * 60_000)) return out({ error: 'busy' }, 429); // the whole site (flood / spam guard)
      const r = await submit(site, b.kind, b.data); return out(r.body, r.status);
    }
    if (action === 'track') {
      if (rateLimit(`cl-track:${ip}:${site.id}`, 30, 10 * 60_000)) return out({ error: 'slow_down' }, 429);
      const r = await trackOrder(site, b.ref, b.phone); return out(r.body, r.status);
    }

    // ── owner actions (token required) ──
    if (action.startsWith('owner.')) {
      if (ownerBlocked(site, ip)) return out({ error: 'locked', retryMinutes: 10 }, 429);
      if (!verifyOwner(site, b.token, ip)) return out({ error: 'unauthorized' }, 401);
      if (action === 'owner.list') { const r = await ownerList(site.id); return out(r.body, r.status); }
      if (action === 'owner.update') { const r = await ownerUpdate(site.id, b.kind, b.ref, b.status); return out(r.body, r.status); }
      if (action === 'owner.delete') { const r = await ownerDelete(site.id, b.kind, b.ref); return out(r.body, r.status); }
      if (action === 'owner.rotate') { const r = await ownerRotate(site, b.verifier); return out(r.body, r.status); }
    }
    return out({ error: 'unknown_action' }, 400);
  } catch (e) {
    await reportServerError('api/site', e);
    return out({ error: 'server_error' }, 500);
  }
}
