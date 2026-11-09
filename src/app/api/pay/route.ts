import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { findTicket, mutateTicket } from '@/server/store';
import { clean, clientIp, isLimited, rateLimit, readJsonLimited, sameOrigin, esc } from '@/server/util';
import { ownsTicket, toPublic } from '@/server/ticketView';
import { notifyOwner } from '@/server/mail';

export const runtime = 'nodejs';

/**
 * Mobile-money deposit — MANUAL verification flow.
 * Customer sends money to your MTN/Airtel number using their ticket id as the reference,
 * then submits the transaction ID here. You confirm it in /admin after checking your wallet.
 * (Automatic confirmation needs a provider API account — MTN MoMo Collections, Airtel, Flutterwave, Pesapal.)
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  if (rateLimit(`pay:${clientIp(req)}`, 8, 10 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const parsed = await readJsonLimited(req, 4096);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body: any = parsed.body;

  // one reference can only be guessed at so often, however many IP addresses the guesses come from
  const refId = clean(body?.ticket, 20).toUpperCase();
  if (isLimited(`guess:${refId}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Too many attempts for this reference. Please try again in an hour.' }, { status: 429 });
  const t = await findTicket(refId);
  if (!t || !ownsTicket(t, clean(body?.contact, 254))) { rateLimit(`guess:${refId}`, 10, 60 * 60_000); return NextResponse.json({ error: 'Request not found.' }, { status: 404 }); }
  if (!t.depositUGX) return NextResponse.json({ error: 'No deposit is due on this request.' }, { status: 400 });
  if (t.payments.some((p) => p.status === 'CONFIRMED')) return NextResponse.json({ error: 'Deposit already confirmed.' }, { status: 400 });

  const network = ['MTN', 'AIRTEL', 'OTHER'].includes(body?.network) ? body.network : 'OTHER';
  const txId = clean(body?.txId, 30).toUpperCase();
  if (!/^[A-Z0-9._-]{6,30}$/.test(txId)) return NextResponse.json({ error: 'Enter the transaction ID from your payment confirmation SMS (6–30 letters/numbers).' }, { status: 400 });
  if (t.payments.some((p) => p.txId === txId)) return NextResponse.json({ error: 'That transaction ID was already submitted.' }, { status: 409 });

  const updated = await mutateTicket(t.id, (x) => {
    x.payments.push({ id: crypto.randomBytes(4).toString('hex'), network, txId, status: 'SUBMITTED', at: new Date().toISOString() });
    x.history.push({ at: new Date().toISOString(), status: x.status, note: 'Payment submitted — we will confirm it shortly.' });
  });
  await notifyOwner(`[${t.id}] Deposit submitted (${network})`, `<p>${esc(t.name)} submitted <strong>${esc(txId)}</strong> on ${esc(network)} for ${esc(t.id)} (deposit UGX ${t.depositUGX}). Verify in your wallet, then confirm in /admin.</p>`);
  return NextResponse.json({ ticket: updated ? toPublic(updated) : undefined });
}
