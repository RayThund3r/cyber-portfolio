// src/app/api/contact/route.ts
import { NextResponse } from 'next/server';
import { esc, oneLine, clean, EMAIL_RE, PHONE_RE, clientIp, rateLimit, sameOrigin } from '@/server/util';
import { resend, FROM, TO, BACKUP_TO, CAN_EMAIL_CUSTOMERS, trackLink, reportServerError } from '@/server/mail';
import { createTicket, newTicketId } from '@/server/store';
import { validateSlot } from '@/server/booking';
import { ATTACH, extOf, kindOfName, matchesSignature, sanitizeFilename } from '@/lib/attachmentRules';

export const runtime = 'nodejs';

const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP || '').replace(/[^\d]/g, '');
const LIMITS = { name: 100, email: 254, phone: 30, details: 5000, transcript: 8000 };
/** Whole request body. Files arrive base64-encoded (+33%) and hosts such as Vercel refuse bodies over ~4.5 MB. */
const MAX_BODY_CHARS = 4_000_000;

interface ParsedFile { filename: string; content: Buffer }

/** Validate files shared from the chat's "send to owner" card with the SAME rules the chat applied in the browser. */
function parseAttachments(raw: unknown): { files: ParsedFile[] } | { error: string } {
  if (raw === undefined || raw === null) return { files: [] };
  if (!Array.isArray(raw)) return { error: 'Invalid attachments.' };
  if (raw.length > ATTACH.maxFiles) return { error: `You can send at most ${ATTACH.maxFiles} files.` };
  const files: ParsedFile[] = [];
  let total = 0;
  for (const item of raw) {
    const name = typeof item?.name === 'string' ? item.name : '';
    const data = typeof item?.data === 'string' ? item.data : '';
    const ext = extOf(name);
    if (!name || !data || !kindOfName(name)) return { error: `"${sanitizeFilename(name)}" is not an allowed file type.` };
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return { error: 'A file was not encoded correctly.' };
    const content = Buffer.from(data, 'base64');
    if (content.length === 0 || content.length > ATTACH.maxFileBytes) return { error: `"${sanitizeFilename(name)}" is empty or too large.` };
    total += content.length;
    if (total > ATTACH.maxTotalBytes) return { error: 'The files are too large to send together.' };
    if (!matchesSignature(ext, new Uint8Array(content.subarray(0, 2048)))) return { error: `"${sanitizeFilename(name)}" does not look like a real .${ext} file.` };
    files.push({ filename: sanitizeFilename(name), content });
  }
  return { files };
}
const TELEMETRY_KEYS = ['timestamp', 'platform', 'cores', 'approxMemoryGB', 'screenResolution', 'viewport', 'gpu', 'connectionType'] as const;

const failure = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, whatsapp: WHATSAPP || undefined, ...extra }, { status });

function cleanTelemetry(t: unknown): Record<string, string> | null {
  if (!t || typeof t !== 'object') return null;
  const out: Record<string, string> = {};
  for (const k of TELEMETRY_KEYS) {
    const v = (t as Record<string, unknown>)[k];
    if (typeof v === 'string' || typeof v === 'number') out[k] = oneLine(v, 120);
  }
  return Object.keys(out).length ? out : null;
}

/** Optional Cloudflare Turnstile. Active only when TURNSTILE_SECRET_KEY is set. Fails open if Cloudflare is unreachable. */
async function turnstileOk(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(4000),
    });
    return !!(await r.json()).success;
  } catch (e) {
    console.warn('[contact] turnstile unreachable, allowing', e);
    return true;
  }
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!sameOrigin(request)) return failure(403, 'Request blocked.');

  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_CHARS) return failure(413, 'Request too large.');
  let body: any;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return failure(413, 'Request too large.');
    body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  } catch { return failure(400, 'Invalid request format.'); }

  // Honeypot — pretend success so bots move on.
  if (typeof body?.website === 'string' && body.website.trim()) return NextResponse.json({ success: true, ticket: newTicketId() });
  if (rateLimit(`contact:${ip}`, 5, 10 * 60_000)) return failure(429, 'Too many requests. Please wait a few minutes, or message us on WhatsApp.');

  const name = clean(body?.name, LIMITS.name);
  const email = clean(body?.email, LIMITS.email);
  const phone = clean(body?.phone, LIMITS.phone);
  const details = clean(body?.details, LIMITS.details);
  const formType = String(body?.formType || '').toLowerCase();
  // 'chat' = the chat widget's "send to owner" card: emailed (with the transcript and any files), not ticketed.
  const isChat = formType === 'chat';
  const kind: 'repair' | 'design' = formType === 'repair' ? 'repair' : 'design';
  const serviceType = isChat ? 'Chat hand-off' : kind === 'repair' ? 'Hardware Repair Booking' : 'UI/UX & Design Inquiry';
  const transcript = clean(body?.transcript, LIMITS.transcript);
  const telemetry = cleanTelemetry(body?.telemetry);
  const chatContext = clean(body?.chatContext, 1500);

  if (!name || !details) return failure(400, 'Please provide your name and the details of your request.');
  if (!email && !phone) return failure(400, 'Please provide an email address or a phone / WhatsApp number so we can reply.');
  if (email && !EMAIL_RE.test(email)) return failure(400, 'That email address does not look valid.');
  if (phone && !PHONE_RE.test(phone)) return failure(400, 'That phone number does not look valid.');
  if (!(await turnstileOk(clean(body?.turnstile, 3000), ip))) return failure(400, 'Verification failed. Please refresh and try again.');
  const parsedFiles = parseAttachments(body?.attachments);
  if ('error' in parsedFiles) return failure(400, parsedFiles.error);
  const attachments = isChat ? parsedFiles.files : [];

  // Optional appointment (repairs only)
  let slot: { date: string; time: string } | undefined;
  if (kind === 'repair' && body?.slot?.date && body?.slot?.time) {
    slot = { date: clean(body.slot.date, 10), time: clean(body.slot.time, 5) };
    const problem = await validateSlot(slot.date, slot.time);
    if (problem) return failure(409, problem, { slotTaken: true });
  }

  // Persist as a trackable ticket. If storage is unavailable, still email so no lead is lost.
  const ticketId = newTicketId();
  // Chat hand-offs are saved too (as a ticket marked "[Chat hand-off]") so a missing email key or a failed send can never
  // lose a lead. The chat is not given the ticket id, so its replies are unchanged.
  let stored = true;
  try {
    await createTicket({ id: ticketId, kind, name, email, phone, details: isChat ? `[Chat hand-off] ${details}` : details, slot });
  } catch (e) {
    stored = false;
    await reportServerError('contact:createTicket', e);
  }
  console.info('[contact] new lead', JSON.stringify({ ticketId, kind: isChat ? 'chat' : kind, name, email, phone, slot, stored, files: attachments.length, at: new Date().toISOString() }));

  const r = resend();
  if (!r) {
    console.error('[contact] RESEND_API_KEY missing — owner not emailed. Ticket stored:', stored);
    if (stored) return NextResponse.json({ success: true, ...(isChat ? {} : { ticket: ticketId }), emailed: false });
    return failure(503, 'Messaging is temporarily unavailable. Please use WhatsApp or try again shortly.', isChat ? {} : { ticket: ticketId });
  }

  const html = `
    <div style="font-family:monospace;background:#09090b;color:#f4f4f5;padding:20px;border-radius:8px;">
      <h2 style="color:#22d3ee;border-bottom:1px solid #27272a;padding-bottom:10px;">// NEW INQUIRY ${isChat ? '(CHAT HAND-OFF)' : esc(ticketId)}</h2>
      <p><strong>Type:</strong> ${esc(isChat ? 'chat' : kind)} — ${esc(serviceType)}</p>
      ${slot ? `<p><strong>Visit requested:</strong> ${esc(slot.date)} at ${esc(slot.time)}</p>` : ''}
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${email ? esc(email) : '(not provided)'}</p>
      ${phone ? `<p><strong>Phone / WhatsApp:</strong> ${esc(phone)}</p>` : ''}
      <div style="background:#18181b;padding:15px;border-radius:6px;margin-top:15px;border:1px solid #27272a;"><p style="white-space:pre-wrap;color:#d4d4d8;">${esc(details)}</p></div>
      ${chatContext ? `<div style="background:#18181b;padding:15px;border-radius:6px;margin-top:15px;"><strong>Chat context</strong><p style="white-space:pre-wrap;color:#d4d4d8;">${esc(chatContext)}</p></div>` : ''}
      ${transcript ? `<div style="background:#18181b;padding:15px;border-radius:6px;margin-top:15px;border:1px solid #27272a;"><strong style="color:#a1a1aa;">Chat transcript (shared by the visitor)</strong><pre style="white-space:pre-wrap;color:#a1a1aa;font-size:11px;">${esc(transcript)}</pre></div>` : ''}
      ${attachments.length ? `<p style="color:#a1a1aa;"><strong>Attached files (${attachments.length}):</strong> ${esc(attachments.map((a) => a.filename).join(', '))}</p>` : ''}
      ${telemetry ? `<pre style="color:#fbbf24;font-size:11px;">${esc(JSON.stringify(telemetry, null, 2))}</pre>` : ''}
      <p style="color:#71717a;font-size:11px;">${isChat ? 'Sent from the chat widget. Reply to this email to answer the visitor.' : `Manage it in /admin${stored ? '' : ' — NOTE: ticket could not be stored, handle from this email'}.`}</p>
    </div>`;

  try {
    const { error } = await r.emails.send({
      from: FROM, to: [TO], ...(BACKUP_TO ? { bcc: [BACKUP_TO] } : {}), ...(email ? { replyTo: email } : {}),
      ...(attachments.length ? { attachments } : {}),
      subject: isChat
        ? `[CHAT] ${oneLine(name, 60)}`
        : `[${ticketId}] ${kind.toUpperCase()} - ${oneLine(name, 60)}${slot ? ` - ${slot.date} ${slot.time}` : ''}`,
      html,
    });
    if (error) {
      console.error('[contact] Resend rejected the email:', JSON.stringify(error), ticketId);
      // The lead is safely stored, so tell the customer it worked if we have it.
      if (stored) return NextResponse.json({ success: true, ...(isChat ? {} : { ticket: ticketId }), emailed: false });
      return failure(502, 'We could not deliver your message. Please message us on WhatsApp or try again.', { ticket: ticketId });
    }

    if (email && CAN_EMAIL_CUSTOMERS && !isChat) {
      await r.emails.send({
        from: FROM, to: [email], subject: `We received your request (${ticketId})`,
        html: `<p>Hi ${esc(name)},</p><p>Thanks for getting in touch — we received your request${slot ? ` and noted your visit for <strong>${esc(slot.date)} at ${esc(slot.time)}</strong>` : ''}.</p><p>Reference: <strong>${esc(ticketId)}</strong><br/><a href="${esc(trackLink(ticketId))}">Track your request</a> (you'll need the phone/email you used).</p>`,
      }).catch((e) => console.warn('[contact] confirmation email failed', e));
    }
    return NextResponse.json({ success: true, ...(isChat ? {} : { ticket: ticketId }), slot });
  } catch (err) {
    await reportServerError('contact:send', err);
    if (stored) return NextResponse.json({ success: true, ...(isChat ? {} : { ticket: ticketId }), emailed: false });
    return failure(502, 'We could not deliver your message. Please message us on WhatsApp or try again.', { ticket: ticketId });
  }
}
