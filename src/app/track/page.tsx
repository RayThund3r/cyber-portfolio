// src/app/track/page.tsx — customers check status, see their quote/deposit and submit a mobile-money payment reference.
'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import gsap from 'gsap';
import { useTheme } from '@/context/ThemeContext';
import { STATUS_FLOW, STATUS_LABEL, formatUGX, type PublicTicket } from '@/lib/shared';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';
import { trackEvent } from '@/utils/analytics';
import { buildIcs, downloadIcs } from '@/lib/calendar';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala' });

function TrackInner() {
  const params = useSearchParams();
  const urlId = params.get('id');
  const { themeClasses } = useTheme();
  const [id, setId] = useState('');
  const [contact, setContact] = useState('');
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [network, setNetwork] = useState<'MTN' | 'AIRTEL' | 'OTHER'>('MTN');
  const [txId, setTxId] = useState('');
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Coming straight from the website builder after ordering: open the order automatically.
    try {
      const raw = sessionStorage.getItem('sys_track_prefill');
      if (raw) {
        sessionStorage.removeItem('sys_track_prefill');
        const p = JSON.parse(raw);
        if (p?.id && p?.contact) { setId(String(p.id).toUpperCase()); setContact(String(p.contact)); lookup(undefined, { id: p.id, contact: p.contact }); }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow ?id= (also when the chat assistant links to another request while this page is open).
  useEffect(() => {
    if (urlId) setId(urlId.toUpperCase());
  }, [urlId]);

  const [dlBusy, setDlBusy] = useState(false);
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
    } catch (err: any) { setPayMsg(err.message); } finally { setDlBusy(false); }
  };

  const lookup = async (e?: React.FormEvent, override?: { id: string; contact: string }) => {
    e?.preventDefault();
    setError(null);
    const useId = override?.id ?? id, useContact = override?.contact ?? contact;
    if (!useId.trim() || !useContact.trim()) { setError('Enter your reference and the phone number or email you used.'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: useId, contact: useContact }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lookup failed.');
      setTicket(d.ticket);
      trackEvent('track_view');
    } catch (err: any) {
      setTicket(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setPayMsg(null);
    setPaying(true);
    try {
      const r = await fetch('/api/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: ticket.id, contact, network, txId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not submit.');
      if (d.ticket) setTicket(d.ticket);
      setTxId('');
      setPayMsg('Thanks! We received your transaction ID and will confirm it shortly.');
      trackEvent('payment_submitted');
    } catch (err: any) {
      setPayMsg(err.message);
    } finally {
      setPaying(false);
    }
  };

  // Progress bar fill (GSAP)
  const stepIndex = ticket ? STATUS_FLOW.indexOf(ticket.status) : -1;
  useEffect(() => {
    if (!barRef.current || !ticket || stepIndex < 0) return;
    const pct = stepIndex / (STATUS_FLOW.length - 1);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { gsap.set(barRef.current, { scaleX: pct }); return; }
    const t = gsap.fromTo(barRef.current, { scaleX: 0 }, { scaleX: pct, duration: 1.1, ease: 'power3.out', delay: 0.15 });
    return () => { t.kill(); };
  }, [ticket?.id, ticket?.status, stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const input = 'w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500';

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <Link href="/" className={`font-mono text-xs ${themeClasses.accent} hover:opacity-80`}>← Home</Link>
        <header data-reveal>
          <h1 className="text-3xl font-extrabold">Track your request</h1>
          <p className="text-sm text-zinc-400 mt-2">Enter the reference we gave you and the phone number or email you used.</p>
        </header>

        <form onSubmit={lookup} data-reveal className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
          <input className={input} placeholder="Reference e.g. SYS-AB12CD" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} autoCapitalize="characters" aria-label="Reference" />
          <input className={input} placeholder="Phone or email you used" value={contact} onChange={(e) => setContact(e.target.value)} aria-label="Phone or email" />
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <button disabled={loading} className="px-5 py-2.5 rounded bg-cyan-500 text-black font-mono text-xs font-semibold hover:bg-cyan-400 disabled:opacity-50 cursor-pointer">
            {loading ? 'CHECKING…' : 'CHECK_STATUS →'}
          </button>
        </form>

        {ticket && (
          <section className="space-y-5" aria-live="polite">
            <div data-reveal className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <span className="font-mono text-xs text-zinc-400">{ticket.id} · {ticket.kind === 'repair' ? 'Repair' : ticket.kind === 'template' ? 'Website template' : 'Design / Web'}</span>
                <span className={`px-2.5 py-1 rounded border text-xs font-mono ${ticket.status === 'CANCELLED' ? 'border-red-500/40 text-red-400' : themeClasses.badge}`}>{STATUS_LABEL[ticket.status]}</span>
              </div>

              {ticket.status !== 'CANCELLED' && (
                <div className="relative mb-6" aria-label={`Progress: ${STATUS_LABEL[ticket.status]}`}>
                  <div className="absolute left-0 right-0 top-[7px] h-0.5 bg-zinc-800" />
                  <div ref={barRef} className="absolute left-0 right-0 top-[7px] h-0.5 bg-cyan-400 origin-left" style={{ transform: 'scaleX(0)' }} />
                  <ol className="relative flex justify-between">
                    {STATUS_FLOW.map((s, i) => (
                      <li key={s} className="flex flex-col items-center w-0 overflow-visible">
                        <span className={`w-4 h-4 rounded-full border-2 ${i <= stepIndex ? 'bg-cyan-400 border-cyan-400' : 'bg-zinc-950 border-zinc-700'}`} />
                        <span className="hidden sm:block mt-2 text-[10px] font-mono text-zinc-400 whitespace-nowrap -translate-x-0">{i === 0 || i === STATUS_FLOW.length - 1 || i === stepIndex ? STATUS_LABEL[s].split(' ')[0] : ''}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {ticket.slot && (
                <p className="text-sm text-zinc-300 mb-2">
                  📅 Visit: <strong>{ticket.slot.date} at {ticket.slot.time}</strong>
                  <button
                    type="button"
                    className="ml-3 min-h-9 rounded border border-zinc-700 px-2.5 text-xs text-zinc-300 hover:border-zinc-500"
                    onClick={() => {
                      const ics = buildIcs({ title: 'Repair visit', date: ticket.slot!.date, time: ticket.slot!.time, description: `Reference ${ticket.id}`, uid: `${ticket.id}@system-portfolio` });
                      if (ics) downloadIcs('repair-visit.ics', ics);
                    }}
                  >
                    Add to calendar
                  </button>
                </p>
              )}
              {(ticket.quoteUGX || ticket.depositUGX) && (
                <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                  <div className="bg-zinc-950 border border-zinc-800 rounded p-3"><div className="text-[11px] font-mono text-zinc-400">QUOTE</div><div className="font-semibold">{formatUGX(ticket.quoteUGX)}</div></div>
                  <div className="bg-zinc-950 border border-zinc-800 rounded p-3"><div className="text-[11px] font-mono text-zinc-400">DEPOSIT</div><div className="font-semibold">{formatUGX(ticket.depositUGX)} {ticket.depositPaid && <span className="text-emerald-400 text-xs">✓ paid</span>}</div></div>
                </div>
              )}
            </div>

            {ticket.downloadReady && (
              <div data-reveal className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-5 space-y-3">
                <h2 className="font-mono text-xs text-emerald-400">YOUR_WEBSITE_IS_READY</h2>
                <p className="text-sm text-zinc-300">Payment confirmed — thank you! Download your website as a zip, unzip it, and upload the files to your hosting. A README inside explains how.</p>
                <button onClick={downloadSite} disabled={dlBusy} className="px-4 py-2.5 rounded bg-emerald-500 text-black font-mono text-xs font-semibold hover:bg-emerald-400 disabled:opacity-50 cursor-pointer">{dlBusy ? 'Preparing…' : '⬇ Download website (.zip)'}</button>
              </div>
            )}

            {ticket.pay && (
              <div data-reveal className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-5 space-y-3">
                <h2 className="font-mono text-xs text-amber-400">{ticket.kind === 'template' ? 'PAY_TO_UNLOCK_YOUR_DOWNLOAD' : 'PAY_DEPOSIT_VIA_MOBILE_MONEY'}</h2>
                <p className="text-sm text-zinc-300">Send <strong>{formatUGX(ticket.depositUGX)}</strong> using mobile money, and use <strong>{ticket.pay.reference}</strong> as the reference/reason. Then enter the transaction ID from the confirmation SMS below.</p>
                <ul className="text-sm space-y-1 font-mono">
                  {ticket.pay.mtn && <li>MTN MoMo: <strong>{ticket.pay.mtn}</strong></li>}
                  {ticket.pay.airtel && <li>Airtel Money: <strong>{ticket.pay.airtel}</strong></li>}
                  {ticket.pay.accountName && <li className="text-zinc-400">Name: {ticket.pay.accountName}</li>}
                  {!ticket.pay.mtn && !ticket.pay.airtel && <li className="text-zinc-400">Payment numbers aren&apos;t set up yet — please contact us.</li>}
                </ul>
                <form onSubmit={submitPayment} className="flex flex-col sm:flex-row gap-2">
                  <select value={network} onChange={(e) => setNetwork(e.target.value as any)} className={`${input} sm:w-40`} aria-label="Network">
                    <option value="MTN">MTN</option><option value="AIRTEL">Airtel</option><option value="OTHER">Other</option>
                  </select>
                  <input className={input} placeholder="Transaction ID" value={txId} onChange={(e) => setTxId(e.target.value)} aria-label="Transaction ID" />
                  <button disabled={paying} className="px-4 py-2.5 rounded bg-amber-500 text-black font-mono text-xs font-semibold hover:bg-amber-400 disabled:opacity-50 cursor-pointer whitespace-nowrap">{paying ? '…' : 'I_PAID'}</button>
                </form>
                {payMsg && <p role="status" className="text-xs text-zinc-300">{payMsg}</p>}
              </div>
            )}

            {ticket.payments.length > 0 && (
              <div data-reveal className="text-xs font-mono text-zinc-400 space-y-1">
                {ticket.payments.map((p, i) => <div key={i}>{p.network} · {p.txId} · <span className={p.status === 'CONFIRMED' ? 'text-emerald-400' : p.status === 'REJECTED' ? 'text-red-400' : 'text-amber-400'}>{p.status}</span></div>)}
              </div>
            )}

            <div data-reveal className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
              <h2 className="font-mono text-xs text-zinc-400 mb-3">UPDATES</h2>
              <ol className="space-y-3">
                {[...ticket.history].reverse().map((h, i) => (
                  <li key={i} className="border-l-2 border-zinc-800 pl-3">
                    <div className="text-xs font-mono text-zinc-400">{fmtDate(h.at)} · {STATUS_LABEL[h.status]}</div>
                    {h.note && <div className="text-sm text-zinc-200 mt-0.5">{h.note}</div>}
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap gap-3 font-mono text-xs">
              <button onClick={() => lookup()} className="px-4 py-2 rounded border border-zinc-700 hover:border-zinc-500 cursor-pointer">↻ Refresh</button>
              {hasWhatsApp() && <a href={whatsappLink(`Hello, about my request ${ticket.id}: `)} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">💬 Ask on WhatsApp</a>}
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
