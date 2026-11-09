// src/server/mail.ts — all outgoing email goes through here.
import 'server-only';
import { Resend } from 'resend';
import { esc } from './util';
import { STATUS_LABEL, type TicketStatus } from '@/lib/shared';

export const TO = process.env.CONTACT_TO || process.env.CONTACT_TO_EMAIL || 'raytbolt@gmail.com';
export const FROM = process.env.CONTACT_FROM || 'System Portfolio Hub <onboarding@resend.dev>';
export const BACKUP_TO = process.env.CONTACT_BACKUP_TO || '';
/** The Resend sandbox sender can only email you; customer emails need a verified domain. */
export const CAN_EMAIL_CUSTOMERS = !!process.env.CONTACT_FROM;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

let client: Resend | null = null;
export function resend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return (client ||= new Resend(process.env.RESEND_API_KEY));
}

export const trackLink = (id: string) => `${SITE_URL}/track?id=${encodeURIComponent(id)}`;

export async function notifyOwner(subject: string, html: string) {
  const r = resend();
  if (!r) return;
  try {
    const { error } = await r.emails.send({ from: FROM, to: [TO], subject, html });
    if (error) console.warn('[mail] owner notification failed', error);
  } catch (e) {
    console.warn('[mail] owner notification threw', e);
  }
}

export async function notifyCustomer(to: string, ticketId: string, status: TicketStatus, note?: string) {
  const r = resend();
  if (!r || !CAN_EMAIL_CUSTOMERS || !to) return;
  try {
    await r.emails.send({
      from: FROM,
      to: [to],
      subject: `Update on ${ticketId}: ${STATUS_LABEL[status]}`,
      html: `<p>Your request <strong>${esc(ticketId)}</strong> is now: <strong>${esc(STATUS_LABEL[status])}</strong>.</p>${note ? `<p>${esc(note)}</p>` : ''}<p><a href="${esc(trackLink(ticketId))}">Track your request</a></p>`,
    });
  } catch (e) {
    console.warn('[mail] customer notification failed', e);
  }
}

/** Server-side error → stats store + (first time only, max 10/day) an email to the owner. */
let alertsToday = { day: '', n: 0 };
export async function reportServerError(where: string, err: unknown) {
  const msg = String((err as Error)?.message || err).slice(0, 300);
  console.error(`[error] ${where}:`, err);
  try {
    const { recordError } = await import('./store');
    const isNew = await recordError(msg, where);
    const day = new Date().toISOString().slice(0, 10);
    if (alertsToday.day !== day) alertsToday = { day, n: 0 };
    if (isNew && alertsToday.n < 10) {
      alertsToday.n++;
      await notifyOwner(`[site error] ${where}`, `<p><strong>${esc(where)}</strong></p><pre>${esc(msg)}</pre>`);
    }
  } catch { /* never let monitoring break a request */ }
}
