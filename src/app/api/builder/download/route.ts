// src/app/api/builder/download/route.ts — returns the customer's website .zip, ONLY for a paid order.
import { NextResponse } from 'next/server';
import { authProject, downloadFor, loadProject } from '@/server/projects';
import { findTicket } from '@/server/store';
import { ownsTicket } from '@/server/ticketView';
import { clean, clientIp, isLimited, rateLimit, readJsonLimited, sameOrigin } from '@/server/util';

export const runtime = 'nodejs';

const err = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Accepts EITHER { project, key } (from the builder) OR { ticket, contact } (from the tracking page). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return err('Request blocked.', 403);
  if (rateLimit(`b-dl:${clientIp(req)}`, 20, 60 * 60_000)) return err('Too many downloads. Try again later.', 429);
  const parsed = await readJsonLimited(req, 4096);
  if (!parsed.ok) return err(parsed.error, parsed.status);
  const b: any = parsed.body;
  const ip = clientIp(req);

  // guesses of a project key / a request's contact detail are limited per address AND per reference
  const ref = clean(b?.project ? b.project : b?.ticket, 20).toUpperCase();
  if (isLimited(`b-dlfail:${ip}`, 20, 10 * 60_000) || isLimited(`b-guess:${ref}`, 10, 60 * 60_000)) return err('Too many wrong attempts. Please wait a few minutes and try again.', 429);

  let project = null;
  if (b?.project) {
    project = await authProject(clean(b.project, 12).toUpperCase(), clean(b.key, 64));
  } else if (b?.ticket) {
    const t = await findTicket(clean(b.ticket, 20));
    if (t && t.kind === 'template' && t.projectId && ownsTicket(t, clean(b.contact, 254))) project = await loadProject(t.projectId);
  }
  if (!project) { rateLimit(`b-dlfail:${ip}`, 20, 10 * 60_000); rateLimit(`b-guess:${ref}`, 10, 60 * 60_000); return err('We could not verify that order.', 404); }

  const out = await downloadFor(project);
  if ('error' in out) return err(out.error, out.status);
  const fname = (project.order?.snapshot.brand.name || 'website').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'website';
  return new NextResponse(new Uint8Array(out), {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${fname}-website.zip"`, 'Cache-Control': 'no-store' },
  });
}
