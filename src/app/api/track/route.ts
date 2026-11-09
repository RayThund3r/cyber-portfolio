import { NextResponse } from 'next/server';
import { findTicket } from '@/server/store';
import { clean, clientIp, isLimited, rateLimit, readJsonLimited, sameOrigin } from '@/server/util';
import { ownsTicket, toPublic } from '@/server/ticketView';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  if (rateLimit(`track:${clientIp(req)}`, 12, 10 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  const parsed = await readJsonLimited(req, 4096);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body: any = parsed.body;

  // one reference can only be guessed at so often, however many IP addresses the guesses come from
  const refId = clean(body?.ticket, 20).toUpperCase();
  if (isLimited(`guess:${refId}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Too many attempts for this reference. Please try again in an hour.' }, { status: 429 });
  const t = await findTicket(refId);
  if (!t || !ownsTicket(t, clean(body?.contact, 254))) {
    rateLimit(`guess:${refId}`, 10, 60 * 60_000);
    return NextResponse.json({ error: "We couldn't find a request matching those details. Check the reference and the phone/email you used." }, { status: 404 });
  }
  return NextResponse.json({ ticket: toPublic(t) }, { headers: { 'Cache-Control': 'no-store' } });
}
