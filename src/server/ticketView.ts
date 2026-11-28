// src/server/ticketView.ts — what a customer is allowed to see of a ticket.
import 'server-only';
import type { PublicTicket } from '@/lib/shared';
import type { Ticket } from './store';
import type { PayDetails } from './payDetails';
import { EMAIL_RE, samePhone } from './util';

const mask = (s: string) => (s.length <= 4 ? '••••' : `${'•'.repeat(Math.max(2, s.length - 4))}${s.slice(-4)}`);

export function toPublic(t: Ticket, payDetails?: PayDetails): PublicTicket {
  const pd = payDetails;
  const depositPaid = t.payments.some((p) => p.status === 'CONFIRMED');
  const due = !!t.depositUGX && t.depositUGX > 0 && !depositPaid;
  return {
    id: t.id, kind: t.kind, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt, slot: t.slot,
    history: t.history, quoteUGX: t.quoteUGX, depositUGX: t.depositUGX, depositPaid,
    downloadReady: t.kind === 'template' && depositPaid,
    payments: t.payments.map((p) => ({ network: p.network, txId: mask(p.txId), status: p.status, at: p.at })),
    pay: due
      ? {
          accountName: pd?.mtnName || pd?.airtelName || '',
          mtn: pd?.mtnNumber || '', mtnName: pd?.mtnName || '',
          airtel: pd?.airtelNumber || '', airtelName: pd?.airtelName || '',
          note: pd?.note || '',
          reference: t.id,
        }
      : undefined,
  };
}

/** Customer must know BOTH the ticket id and the phone/email they used — stops ID guessing. */
export function ownsTicket(t: Ticket, contact: string): boolean {
  const c = contact.trim();
  if (!c) return false;
  if (EMAIL_RE.test(c)) return !!t.email && t.email.toLowerCase() === c.toLowerCase();
  return !!t.phone && samePhone(t.phone, c);
}
