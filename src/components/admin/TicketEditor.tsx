// src/components/admin/TicketEditor.tsx — the panel that opens under a request: contact, details, status, quote, replies, payments.
'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { STATUS_FLOW, STATUS_LABEL, formatUGX, type TicketStatus } from '@/lib/shared';
import { api, box, btn, primary, printJobCard, type AdminTicket } from './adminKit';
import { AButton, Badge, CopyBtn, Field, Priv, STATUS_STYLE } from './ui';

const QUICK: Array<[string, TicketStatus]> = [['Quote ready', 'QUOTED'], ['Deposit needed', 'AWAITING_DEPOSIT'], ['Work started', 'IN_PROGRESS'], ['Ready for pickup', 'READY'], ['Completed', 'COMPLETED']];

export default function TicketEditor({ t, onSaved }: { t: AdminTicket; onSaved: (t: AdminTicket) => void }) {
  const [status, setStatus] = useState<TicketStatus>(t.status);
  const [quote, setQuote] = useState(String(t.quoteUGX ?? '')); const [deposit, setDeposit] = useState(String(t.depositUGX ?? ''));
  const [note, setNote] = useState(''); const [priv, setPriv] = useState(t.adminNotes || ''); const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true); setMsg(null);
    try {
      const d = await api<{ ticket: AdminTicket }>('ticket.update', { id: t.id, status, quoteUGX: quote, depositUGX: deposit, adminNotes: priv, note, notify, ...extra });
      onSaved(d.ticket); setNote(''); setMsg({ ok: true, text: 'Saved' });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  const reply = (label: string, st: TicketStatus) => {
    const texts: Record<string, string> = {
      'Quote ready': quote ? `Your quote is ready: UGX ${Number(quote).toLocaleString('en-UG')}. Reply to confirm and we will proceed.` : 'Your quote is ready. Reply to confirm and we will proceed.',
      'Deposit needed': 'Please pay the deposit to start the work. The payment details are on your tracking page.',
      'Work started': 'We have started working on it.',
      'Ready for pickup': 'Your item is ready for pickup. See you soon!',
      Completed: 'All done. Thank you for choosing us!',
    };
    setStatus(st); setNote(texts[label]);
  };
  const waText = encodeURIComponent(`Hello ${t.name}, update on ${t.id}: ${STATUS_LABEL[status]}${note ? ` — ${note}` : ''}`);
  const changed = status !== t.status || quote !== String(t.quoteUGX ?? '') || deposit !== String(t.depositUGX ?? '') || !!note || priv !== (t.adminNotes || '');

  return (
    <div className="space-y-5 border-t border-zinc-800/80 bg-zinc-950/40 p-4 text-sm sm:p-5">
      {/* who + what */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Customer</div>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex items-center gap-2 text-zinc-200"><Icon name="phone" size={14} className="text-zinc-500" /><Priv>{t.phone || '—'}</Priv>{t.wa && <a className="rounded-md bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20" href={`https://wa.me/${t.wa}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}</div>
            <div className="flex items-center gap-2 text-zinc-200"><Icon name="mail" size={14} className="text-zinc-500" /><Priv className="truncate">{t.email || '—'}</Priv></div>
            <div className="flex items-center gap-2 text-zinc-500"><Icon name="clock" size={14} />Created {new Date(t.createdAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' })}</div>
            {t.slot && <div className="flex items-center gap-2 text-zinc-300"><Icon name="calendar" size={14} className="text-zinc-500" />Visit {t.slot.date} at {t.slot.time}</div>}
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">What they asked for</div>
          <p className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-[13px] leading-relaxed text-zinc-200"><Priv>{t.details}</Priv></p>
        </div>
      </div>
      {t.kind === 'template' && (
        <div className="flex items-start gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-3 text-xs text-sky-100">
          <Icon name="globe" size={15} className="mt-0.5 flex-none text-sky-300" />
          <span>Website order{t.projectId ? ` · project ${t.projectId} (preview or download it under Customer sites)` : ''}. Confirming the payment below unlocks the customer&apos;s download automatically.</span>
        </div>
      )}

      {/* status + money */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Status">
          <div className="relative"><span className={`pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${(STATUS_STYLE[status] ?? STATUS_STYLE.CANCELLED).dot}`} />
            <select className={`${box} pl-8`} value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>{[...STATUS_FLOW, 'CANCELLED' as TicketStatus].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
        </Field>
        <Field label="Quote (UGX)"><input className={box} inputMode="numeric" value={quote} placeholder="0" onChange={(e) => setQuote(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="Deposit (UGX)"><input className={box} inputMode="numeric" value={deposit} placeholder="0" onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ''))} /></Field>
      </div>

      {/* reply */}
      <div className="space-y-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Quick reply</span>
          {QUICK.map(([label, st]) => <button key={label} type="button" className="cursor-pointer rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-accent/60 hover:text-accent" onClick={() => reply(label, st)}>{label}</button>)}
        </div>
        <Field label="Message to the customer (shown on their tracking page)"><input className={box} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Screen arrived, the repair takes about 2 hours" maxLength={500} /></Field>
        <Field label="Private notes (only you can see these)"><textarea className={box} rows={2} value={priv} onChange={(e) => setPriv(e.target.value)} /></Field>
      </div>

      {t.payments.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Payments · check your wallet before confirming</div>
          {t.payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-amber-500/12 text-amber-300"><Icon name="money" size={15} /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold text-zinc-100">{p.network} · <span className="font-mono">{p.txId}</span></span><span className="text-zinc-500">{p.amountUGX ? formatUGX(p.amountUGX) : 'Amount not stated'}</span></span>
              <Badge tone={p.status === 'CONFIRMED' ? 'ok' : p.status === 'REJECTED' ? 'bad' : 'warn'}>{p.status}</Badge>
              {p.status === 'SUBMITTED' && <><AButton small variant="solid" icon="check" disabled={busy} onClick={() => save({ paymentId: p.id, paymentStatus: 'CONFIRMED' })}>Confirm</AButton><AButton small danger icon="close" disabled={busy} onClick={() => save({ paymentId: p.id, paymentStatus: 'REJECTED' })}>Reject</AButton></>}
            </div>
          ))}
        </div>
      )}

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-4">
        <button className={`${primary} !min-h-10 !px-5`} disabled={busy || !changed} onClick={() => save()}>{busy ? 'Saving…' : 'Save changes'}</button>
        <label className="flex cursor-pointer items-center gap-1.5 px-1 text-xs text-zinc-400"><input type="checkbox" className="accent-[var(--accent)]" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email the customer <span className="hidden text-zinc-600 sm:inline">(needs a verified sender)</span></label>
        <span className="mx-1 hidden h-5 w-px bg-zinc-800 sm:block" />
        <button type="button" className={btn} onClick={() => { if (!printJobCard(t)) setMsg({ ok: false, text: 'Allow pop-ups to print the job card.' }); }}><Icon name="print" size={13} />Job card</button>
        {t.wa && <a className={btn} href={`https://wa.me/${t.wa}?text=${waText}`} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={13} />Reply on WhatsApp</a>}
        <CopyBtn text={t.id} label="Copy ID" />
        {msg && <span role="status" className={`text-xs font-medium ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</span>}
        <span className="ml-auto font-mono text-[11px] text-zinc-500">Quote {formatUGX(t.quoteUGX)} · Deposit {formatUGX(t.depositUGX)}</span>
      </div>
    </div>
  );
}
