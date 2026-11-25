// src/app/track/page.tsx — customers check status, see their quote/deposit and submit a mobile-money payment reference.
'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { STATUS_FLOW, STATUS_LABEL, formatUGX, type PublicTicket } from '@/lib/shared';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';
import { trackEvent } from '@/utils/analytics';
import { buildIcs, downloadIcs } from '@/lib/calendar';
import Icon from '@/components/ui/Icon';
import { withGsap } from '@/lib/motion';

const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala' });
const SHORT: Record<string, string> = { RECEIVED: 'Received', QUOTED: 'Quoted', AWAITING_DEPOSIT: 'Deposit', IN_PROGRESS: 'Working', READY: 'Ready', COMPLETED: 'Done' };
const KIND: Record<string, string> = { repair: 'Repair', template: 'Website template', design: 'Design / Web' };
/** Plain-language "what happens now" for each stage, so customers are never left guessing. */
const NEXT: Record<string, { title: string; text: string }> = {
  RECEIVED: { title: 'We have your request', text: 'We are reviewing it and will send you a quote or a time to visit soon.' },
  QUOTED: { title: 'Your quote is ready', text: 'Check the price below. If it suits you, tell us on WhatsApp and we will go ahead.' },
  AWAITING_DEPOSIT: { title: 'Waiting for your deposit', text: 'Pay the deposit below by mobile money so we can start. Then enter the transaction ID.' },
  IN_PROGRESS: { title: 'We are working on it', text: 'Your job is in progress. We will update this page when something changes.' },
  READY: { title: 'Ready for you', text: 'Your job is ready. Message us on WhatsApp to arrange pickup or delivery.' },
  COMPLETED: { title: 'All done', text: 'Thank you for choosing us. We would love to help again.' },
  CANCELLED: { title: 'This request was cancelled', text: 'If that is a surprise, message us and we will sort it out.' },
};

// Only references are remembered on this device by default (never a phone or email unless the customer ticks the box).
const RECENT_KEY = 'sys_track_recent', CONTACT_KEY = 'sys_track_contact';
const readRecent = (): string[] => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5) : []; } catch { return []; } };
const writeRecent = (id: string) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 5))); } catch { /* storage blocked */ } };

const field = 'min-h-11 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/70 px-3.5 text-sm text-zinc-100 placeholder:text-zinc-500 transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';
const card = 'adm-rise rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 shadow-sm shadow-black/20 sm:p-5';

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${label}`} onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => undefined); }}
      className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-zinc-700 px-2 text-[11px] text-zinc-300 transition hover:border-accent hover:text-accent active:scale-95">
      <Icon name={done ? 'check' : 'copy'} size={12} />{done ? 'Copied' : 'Copy'}
    </button>
  );
}

function TrackInner() {
  const params = useSearchParams();
  const urlId = params.get('id');
  const [id, setId] = useState('');
  const [contact, setContact] = useState('');
  const [remember, setRemember] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [network, setNetwork] = useState<'MTN' | 'AIRTEL' | 'OTHER'>('MTN');
  const [txId, setTxId] = useState('');
  const [payMsg, setPayMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const polls = useRef(0);
  const stepsRef = useRef<HTMLDivElement>(null);
  const auto = useRef(false);

  const lookup = useCallback(async (e?: React.FormEvent, override?: { id: string; contact: string }, silent = false) => {
    e?.preventDefault();
    const useId = (override?.id ?? id).trim(), useContact = (override?.contact ?? contact).trim();
    if (!silent) setError(null);
    if (!useId || !useContact) { if (!silent) setError('Enter your reference and the phone number or email you used.'); return; }
    if (!silent) setLoading(true);
    try {
      const r = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: useId, contact: useContact }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lookup failed.');
      setTicket(d.ticket); setCheckedAt(Date.now());
      if (!silent) {
        trackEvent('track_view'); writeRecent(d.ticket.id); setRecent(readRecent());
        try { if (remember) localStorage.setItem(CONTACT_KEY, useContact); else localStorage.removeItem(CONTACT_KEY); } catch { /* ignore */ }
      }
    } catch (err: any) {
      if (!silent) { setTicket(null); setError(err.message); }
    } finally { if (!silent) setLoading(false); }
  }, [id, contact, remember]);

  // On arrival: remembered references/phone, a hand-over from the website builder, or a ?id= link.
  useEffect(() => {
    setRecent(readRecent());
    let savedContact = '';
    try { savedContact = localStorage.getItem(CONTACT_KEY) || ''; } catch { /* ignore */ }
    if (savedContact) { setContact(savedContact); setRemember(true); }
    try {
      const raw = sessionStorage.getItem('sys_track_prefill');
      if (raw) {
        sessionStorage.removeItem('sys_track_prefill');
        const p = JSON.parse(raw);
        if (p?.id && p?.contact) { setId(String(p.id).toUpperCase()); setContact(String(p.contact)); auto.current = true; void lookup(undefined, { id: String(p.id), contact: String(p.contact) }); return; }
      }
    } catch { /* ignore */ }
    const q = new URLSearchParams(window.location.search).get('id');
    if (q) { setId(q.toUpperCase()); if (savedContact) { auto.current = true; void lookup(undefined, { id: q.toUpperCase(), contact: savedContact }); } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow ?id= (also when the chat assistant links to another request while this page is open).
  useEffect(() => { if (urlId && !auto.current) setId(urlId.toUpperCase()); auto.current = false; }, [urlId]);

  // Quietly refresh every 3 minutes while the page is open and visible (the server limits lookups, so this stays gentle).
  useEffect(() => {
    if (!ticket) return;
    polls.current = 0;
    const t = setInterval(() => { if (document.visibilityState === 'visible' && polls.current < 8) { polls.current++; void lookup(undefined, undefined, true); } }, 180_000);
    return () => clearInterval(t);
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The progress line fills step by step and the dots pop in when a request opens or its stage changes (skipped for reduced motion).
  useEffect(() => {
    if (!ticket || ticket.status === 'CANCELLED') return;
    return withGsap(stepsRef.current, ({ gsap }) => {
      const fill = stepsRef.current?.querySelector<HTMLElement>('[data-fill]'); const dots = Array.from(stepsRef.current?.querySelectorAll<HTMLElement>('[data-dot]') || []);
      const idx = STATUS_FLOW.indexOf(ticket.status); const target = idx <= 0 ? 0 : (idx / (STATUS_FLOW.length - 1)) * 100;
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (fill) tl.fromTo(fill, { width: '0%' }, { width: `${target}%`, duration: 1.1, ease: 'power2.inOut' }, 0);
      tl.fromTo(dots, { scale: 0.4, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.45, stagger: 0.09, clearProps: 'transform,opacity' }, 0.05);
      const cur = dots[idx]; if (cur) tl.fromTo(cur, { boxShadow: '0 0 0 0 rgba(var(--accent-rgb), 0.55)' }, { boxShadow: '0 0 0 10px rgba(var(--accent-rgb), 0)', duration: 1.1, repeat: 1, ease: 'power1.out', clearProps: 'boxShadow' }, 0.9);
    });
  }, [ticket?.id, ticket?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const downloadSite = async () => {
    if (!ticket) return;
    setDlBusy(true);
    try {
      const r = await fetch('/api/builder/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: ticket.id, contact }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Download failed.');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await r.blob());
      a.download = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'website.zip';
      a.click();
    } catch (err: any) { setPayMsg({ ok: false, text: err.message }); } finally { setDlBusy(false); }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setPayMsg(null); setPaying(true);
    try {
      const r = await fetch('/api/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: ticket.id, contact, network, txId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not submit.');
      if (d.ticket) setTicket(d.ticket);
      setTxId('');
      setPayMsg({ ok: true, text: 'Thank you! We received your transaction ID and will confirm it shortly.' });
      trackEvent('payment_submitted');
    } catch (err: any) { setPayMsg({ ok: false, text: err.message }); } finally { setPaying(false); }
  };

  const forget = () => { try { localStorage.removeItem(RECENT_KEY); localStorage.removeItem(CONTACT_KEY); } catch { /* ignore */ } setRecent([]); setRemember(false); setContact(''); };

  const stepIndex = ticket ? STATUS_FLOW.indexOf(ticket.status) : -1;
  const cancelled = ticket?.status === 'CANCELLED';
  const pct = stepIndex <= 0 ? 0 : (stepIndex / (STATUS_FLOW.length - 1)) * 100;
  const next = ticket ? NEXT[ticket.status] : null;
  const ago = checkedAt ? Math.max(0, Math.round((Date.now() - checkedAt) / 60000)) : 0;

  return (
    <div className="flex-1 bg-zinc-950 font-sans text-zinc-100">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="hit inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-accent"><Icon name="arrow" size={12} className="rotate-180" /> Home</Link>

        <header className="adm-rise">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent"><Icon name="compass" size={22} /></div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Track your request</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">Enter the reference we gave you and the phone number or email you used. No account needed.</p>
        </header>

        <form onSubmit={(e) => lookup(e)} className={`${card} space-y-3`} style={{ ['--i' as string]: 1 }}>
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-zinc-500">Recent:</span>
              {recent.map((r) => <button key={r} type="button" onClick={() => setId(r)} className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono transition active:scale-95 ${id === r ? 'border-accent text-accent' : 'border-zinc-700 text-zinc-300 hover:border-accent'}`}>{r}</button>)}
            </div>
          )}
          <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-400">Reference</span>
            <input className={`${field} font-mono tracking-wide`} placeholder="e.g. SYS-AB12CD" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-400">Phone or email you used</span>
            <input className={field} placeholder="07… or you@example.com" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="tel" /></label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> Remember my phone/email on this device</label>
          {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"><Icon name="close" size={13} className="mt-0.5 flex-none" />{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={loading} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-accent-strong px-5 text-sm font-semibold text-zinc-950 transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950" />Checking…</> : <>Check status <Icon name="arrow" size={14} /></>}
            </button>
            {(recent.length > 0 || remember) && <button type="button" onClick={forget} className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">Forget this device</button>}
          </div>
        </form>

        {loading && !ticket && <div className="space-y-4" aria-busy="true"><div className="adm-skel h-40 rounded-2xl" /><div className="adm-skel h-28 rounded-2xl" /></div>}

        {ticket && (
          <section className="space-y-4" aria-live="polite">
            <div className={card}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-zinc-100">{ticket.id}</span><CopyBtn text={ticket.id} label="reference" />
                </div>
                <div className="flex items-center gap-2 text-xs"><span className="text-zinc-500">{KIND[ticket.kind] || 'Request'}</span>
                  <span className={`rounded-full border px-2.5 py-1 font-medium ${cancelled ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-accent/40 bg-accent/10 text-accent'}`}>{STATUS_LABEL[ticket.status]}</span></div>
              </div>

              {next && (
                <div className={`mb-5 flex items-start gap-3 rounded-xl border p-3.5 ${cancelled ? 'border-rose-500/25 bg-rose-500/[0.05]' : 'border-accent/25 bg-accent/[0.06]'}`}>
                  <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg ${cancelled ? 'bg-rose-500/15 text-rose-300' : 'bg-accent/15 text-accent'}`}><Icon name={ticket.status === 'COMPLETED' ? 'check' : cancelled ? 'close' : ticket.status === 'AWAITING_DEPOSIT' ? 'money' : 'clock'} size={16} /></span>
                  <div className="min-w-0"><div className="text-sm font-semibold text-zinc-100">{next.title}</div><p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{next.text}</p></div>
                </div>
              )}

              {!cancelled && (
                <div ref={stepsRef} className="mb-1" role="img" aria-label={`Progress: step ${stepIndex + 1} of ${STATUS_FLOW.length}, ${STATUS_LABEL[ticket.status]}`}>
                  <div className="relative mx-2 h-1.5 rounded-full bg-zinc-800">
                    <div data-fill className="absolute inset-y-0 left-0 rounded-full bg-accent-strong" style={{ width: `${pct}%` }} />
                    <ol className="absolute inset-0 flex items-center justify-between">
                      {STATUS_FLOW.map((s, i) => <li key={s} data-dot className={`-mx-2 h-4 w-4 rounded-full border-2 transition-colors duration-500 ${i < stepIndex ? 'border-accent-strong bg-accent-strong' : i === stepIndex ? 'border-accent-strong bg-zinc-950 ring-4 ring-accent/20' : 'border-zinc-700 bg-zinc-950'}`} />)}
                    </ol>
                  </div>
                  <div className="mt-3 hidden justify-between text-[10px] text-zinc-500 sm:flex">{STATUS_FLOW.map((s, i) => <span key={s} className={`w-16 text-center first:text-left last:text-right ${i === stepIndex ? 'font-semibold text-accent' : ''}`}>{SHORT[s] || STATUS_LABEL[s]}</span>)}</div>
                  <p className="mt-3 text-center text-xs text-zinc-500 sm:hidden">Step {stepIndex + 1} of {STATUS_FLOW.length}</p>
                </div>
              )}

              {ticket.slot && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-sm">
                  <span className="flex items-center gap-2 text-zinc-300"><Icon name="calendar" size={15} className="text-accent" />Visit: <strong>{ticket.slot.date} at {ticket.slot.time}</strong></span>
                  <button type="button" className="min-h-9 cursor-pointer rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 transition hover:border-accent hover:text-accent active:scale-95"
                    onClick={() => { const ics = buildIcs({ title: 'Repair visit', date: ticket.slot!.date, time: ticket.slot!.time, description: `Reference ${ticket.id}`, uid: `${ticket.id}@system-portfolio` }); if (ics) downloadIcs('repair-visit.ics', ics); }}>Add to calendar</button>
                </div>
              )}

              {(ticket.quoteUGX || ticket.depositUGX) && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3.5"><div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Quote</div><div className="mt-1 text-lg font-bold tabular-nums">{formatUGX(ticket.quoteUGX)}</div></div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3.5"><div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Deposit</div><div className="mt-1 flex flex-wrap items-baseline gap-2 text-lg font-bold tabular-nums">{formatUGX(ticket.depositUGX)} {ticket.depositPaid && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300"><Icon name="check" size={12} />paid</span>}</div></div>
                </div>
              )}
            </div>

            {ticket.downloadReady && (
              <div className="adm-rise space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Icon name="download" size={16} />Your website is ready</h2>
                <p className="text-sm leading-relaxed text-zinc-300">Payment confirmed, thank you! Download your website as a zip, unzip it, and upload the files to your hosting. A README inside explains how.</p>
                <button onClick={downloadSite} disabled={dlBusy} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"><Icon name="download" size={15} />{dlBusy ? 'Preparing…' : 'Download website (.zip)'}</button>
              </div>
            )}

            {ticket.pay && (
              <div className="adm-rise space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-300"><Icon name="money" size={16} />{ticket.kind === 'template' ? 'Pay to unlock your download' : 'Pay your deposit by mobile money'}</h2>
                <ol className="space-y-2.5 text-sm text-zinc-300">
                  <li className="flex gap-3"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">1</span><span>Send <strong>{formatUGX(ticket.depositUGX)}</strong> to one of these numbers:</span></li>
                </ol>
                <ul className="space-y-2 text-sm">
                  {ticket.pay.mtn && <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5"><span><span className="text-xs text-zinc-500">MTN MoMo</span><br /><strong className="font-mono text-base">{ticket.pay.mtn}</strong></span><CopyBtn text={ticket.pay.mtn} label="MTN number" /></li>}
                  {ticket.pay.airtel && <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5"><span><span className="text-xs text-zinc-500">Airtel Money</span><br /><strong className="font-mono text-base">{ticket.pay.airtel}</strong></span><CopyBtn text={ticket.pay.airtel} label="Airtel number" /></li>}
                  {ticket.pay.accountName && <li className="px-1 text-xs text-zinc-400">Account name: {ticket.pay.accountName}</li>}
                  {!ticket.pay.mtn && !ticket.pay.airtel && <li className="text-zinc-400">Payment numbers aren&apos;t set up yet. Please contact us.</li>}
                </ul>
                <div className="flex gap-3 text-sm text-zinc-300"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">2</span>
                  <span>Use <strong className="font-mono">{ticket.pay.reference}</strong> as the reference/reason <CopyBtn text={ticket.pay.reference} label="payment reference" /></span></div>
                <div className="flex gap-3 text-sm text-zinc-300"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">3</span><span>Enter the transaction ID from the confirmation SMS:</span></div>
                <form onSubmit={submitPayment} className="flex flex-col gap-2 sm:flex-row">
                  <select value={network} onChange={(e) => setNetwork(e.target.value as any)} className={`${field} sm:w-36`} aria-label="Network"><option value="MTN">MTN</option><option value="AIRTEL">Airtel</option><option value="OTHER">Other</option></select>
                  <input className={field} placeholder="Transaction ID" value={txId} onChange={(e) => setTxId(e.target.value)} aria-label="Transaction ID" autoComplete="off" />
                  <button disabled={paying || !txId.trim()} className="min-h-11 cursor-pointer whitespace-nowrap rounded-xl bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">{paying ? 'Sending…' : 'I have paid'}</button>
                </form>
                {payMsg && <p role="status" className={`rounded-xl border px-3 py-2 text-xs ${payMsg.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>{payMsg.text}</p>}
              </div>
            )}

            {ticket.payments.length > 0 && (
              <div className={`${card} space-y-2`}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Payments</h2>
                {ticket.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs">
                    <span className="font-mono text-zinc-300">{p.network} · {p.txId}</span>
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${p.status === 'CONFIRMED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : p.status === 'REJECTED' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>{p.status === 'CONFIRMED' ? 'Confirmed' : p.status === 'REJECTED' ? 'Not accepted' : 'Checking'}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={card}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Updates</h2>
              <ol className="relative space-y-4 border-l border-zinc-800 pl-5">
                {[...ticket.history].reverse().map((h, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 ${i === 0 ? 'border-accent-strong bg-accent-strong' : 'border-zinc-600 bg-zinc-950'}`} />
                    <div className="text-sm font-medium text-zinc-100">{STATUS_LABEL[h.status]}</div>
                    <div className="text-[11px] text-zinc-500">{fmtDate(h.at)}</div>
                    {h.note && <p className="mt-1 text-sm leading-relaxed text-zinc-300">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {hasWhatsApp() && <a href={whatsappLink(`Hello, about my request ${ticket.id}: `)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/50 px-4 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 active:scale-[0.98]"><Icon name="chat" size={15} />Ask on WhatsApp</a>}
              <button onClick={() => lookup()} disabled={loading} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-zinc-700 px-4 text-sm text-zinc-300 transition hover:border-accent hover:text-accent active:scale-[0.98] disabled:opacity-50"><Icon name="refresh" size={15} className={loading ? 'animate-spin' : ''} />Refresh</button>
              <span className="text-[11px] text-zinc-600">{ago < 1 ? 'Updated just now' : `Updated ${ago} min ago`}</span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function TrackPage() {
  // useSearchParams needs a Suspense boundary so the page can still be prerendered.
  return (
    <Suspense fallback={null}>
      <TrackInner />
    </Suspense>
  );
}
