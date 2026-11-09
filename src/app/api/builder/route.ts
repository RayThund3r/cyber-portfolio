// src/app/api/builder/route.ts — public template-builder API (customers). Auth = project id + secret edit key.
import { NextResponse } from 'next/server';
import { addAsset, assetDataUrls, authProject, cancelOrder, createProject, deleteAsset, deleteOwnProject, duplicateProject, orderState, placeOrder, priceNow, saveProject } from '@/server/projects';
import { clean, clientIp, EMAIL_RE, isLimited, PHONE_RE, rateLimit, readJsonLimited, sameOrigin } from '@/server/util';

export const runtime = 'nodejs';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const ok = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });

/**
 * Edit keys are secret, so WRONG guesses are limited per visitor address AND per project (many addresses cannot add up
 * to a guess). Only wrong keys count: reloading your own editor, autosaving or a dev-server refresh can never lock you out.
 */
const tooManyGuesses = (ip: string, id: string) => isLimited(`b-loadfail:${ip}`, 20, 10 * 60_000) || isLimited(`b-guess:${id}`, 10, 60 * 60_000);
const noteWrongKey = (ip: string, id: string) => { rateLimit(`b-loadfail:${ip}`, 20, 10 * 60_000); rateLimit(`b-guess:${id}`, 10, 60 * 60_000); };
const GUESS_MSG = 'Too many wrong attempts. Please wait a few minutes and try again.';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad('Request blocked.', 403);
  const ip = clientIp(req);
  const parsed = await readJsonLimited(req, 1_200_000); // public endpoint: a picture is at most ~800 KB once encoded
  if (!parsed.ok) return bad(parsed.error, parsed.status);
  const b: any = parsed.body;
  const action = String(b?.action || '');
  const id = clean(b?.id, 12).toUpperCase();
  const key = clean(b?.key, 64);

  // every action that opens a site with its key goes through the same wrong-key guard
  const keyed = ['load', 'save', 'upload', 'duplicate', 'deleteAsset', 'delete', 'order', 'unorder'].includes(action);
  if (keyed && tooManyGuesses(ip, id)) return bad(GUESS_MSG, 429);
  const wrong = (error: string) => { if (error === 'Project not found.') noteWrongKey(ip, id); }; // only a wrong KEY counts

  switch (action) {
    case 'create': {
      if (rateLimit(`b-create:${ip}`, 30, 60 * 60_000)) return bad('You have started a lot of sites in the last hour. Please open one of them from "Your projects", or try again a bit later.', 429);
      const r = await createProject(clean(b?.templateId, 30));
      return 'error' in r ? bad(r.error) : ok(r);
    }

    case 'load': {
      if (rateLimit(`b-loadall:${ip}`, 900, 10 * 60_000)) return bad('Too many requests. Try again shortly.', 429);
      const p = await authProject(id, key);
      if (!p) { noteWrongKey(ip, id); return bad('We could not open that project. Check the link or code.', 404); }
      const st = await orderState(p);
      return ok({
        id: p.id, name: p.name, templateId: p.templateId, templateName: p.templateName,
        priceUGX: await priceNow(p.templateId), config: p.config, assets: await assetDataUrls(p), rev: p.rev, updatedAt: p.updatedAt,
        order: st && !st.cancelled ? st : null,
      });
    }

    case 'save': {
      if (rateLimit(`b-save:${ip}`, 400, 10 * 60_000)) return bad('Saving too fast — slow down a little.', 429);
      const r = await saveProject(id, key, { config: b?.config, name: b?.name, baseRev: typeof b?.baseRev === 'number' ? b.baseRev : undefined, force: b?.force === true });
      if ('error' in r) { wrong(r.error); return NextResponse.json({ error: r.error, rev: r.rev, conflict: r.status === 409 && r.rev !== undefined }, { status: r.status, headers: { 'Cache-Control': 'no-store' } }); }
      return ok({ ok: true, ...r });
    }

    case 'upload': {
      if (rateLimit(`b-up:${ip}`, 60, 10 * 60_000)) return bad('Too many uploads. Try again shortly.', 429);
      const r = await addAsset(id, key, clean(b?.mime, 30), typeof b?.data === 'string' ? b.data : '');
      if ('error' in r) { wrong(r.error); return bad(r.error, r.status); }
      return ok(r);
    }

    case 'duplicate': {
      if (rateLimit(`b-dup:${ip}`, 10, 60 * 60_000)) return bad('Too many copies. Try again later.', 429);
      const r = await duplicateProject(id, key);
      if ('error' in r) { wrong(r.error); return bad(r.error, r.status); }
      return ok(r);
    }

    case 'deleteAsset': {
      const r = await deleteAsset(id, key, clean(b?.assetId, 8));
      if ('error' in r) { wrong(r.error); return bad(r.error, r.status); }
      return ok(r);
    }

    case 'delete': {
      // the customer removes their own site and pictures (not once an order exists)
      const r = await deleteOwnProject(id, key);
      if ('error' in r) { wrong(r.error); return bad(r.error, r.status); }
      return ok({ ok: true });
    }

    case 'order': {
      if (rateLimit(`b-order:${ip}`, 6, 60 * 60_000)) return bad('Too many order attempts. Try again later.', 429);
      const name = clean(b?.name, 100), email = clean(b?.email, 254), phone = clean(b?.phone, 30);
      if (!name) return bad('Please enter your name.');
      if (!email && !phone) return bad('Please give an email address or phone / WhatsApp number — you need it to track your order.');
      if (email && !EMAIL_RE.test(email)) return bad('That email address does not look valid.');
      if (phone && !PHONE_RE.test(phone)) return bad('That phone number does not look valid.');
      const r = await placeOrder(id, key, { name, email, phone });
      if ('error' in r) { wrong(r.error); return bad(r.error, r.status); }
      return ok(r);
    }

    case 'unorder': {
      const r = await cancelOrder(id, key);
      if ('error' in r) { wrong(r.error); return bad(r.error, r.status); }
      return ok(r);
    }

    default:
      return bad('Unknown action.');
  }
}
