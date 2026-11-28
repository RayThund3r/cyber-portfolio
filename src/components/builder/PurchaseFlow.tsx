// src/components/builder/PurchaseFlow.tsx — buy + download a design straight from the preview (or from a saved-project card).
//
// Reuses the existing server flow, nothing new is trusted on the client:
//   1 choose  → POST /api/builder {create} (once) → {order}            (the design is locked as the order snapshot)
//   2 pay     → mobile-money transaction-ID deposit via POST /api/pay (ticket + contact), confirmed MANUALLY by the owner
//   3 download→ shown ONLY when the server's own order state says paid; POST /api/builder/download re-checks it again.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { PublicTicket } from '@/lib/shared';
import { formatMoney, type Rates } from '@/lib/builder/pricing';
import { rememberProject } from '@/utils/useProjectRef';
import { IconCheck, IconClock, IconClose, IconDownload, IconLock, IconPencil, IconRefresh, IconShield, IconWallet, IconWarn, IconWifiOff, IconZip } from './icons';
import { btnGhost, btnGreen, btnPrimary, field, kbFocus, Skeleton } from './ui';
import { downloadProject, fetchStatus, lsDel, lsGet, lsSet, post, type OrderStatus } from './lib';

type Step = 'choose' | 'pay' | 'download';
const STEPS: { k: Step; label: string }[] = [{ k: 'choose', label: 'Choose' }, { k: 'pay', label: 'Pay' }, { k: 'download', label: 'Download' }];
const POLL_MS = 12000;

export interface PurchaseProps {
  /** Set when buying a gallery design (a project is created on confirm). */
  templateId?: string;
  templateName: string;
  priceUGX: number | null;
  /** Set when continuing an existing project (saved-project cards). */
  project?: { id: string; key: string } | null;
  cur: string;
  rates: Rates;
  onClose: () => void;
  /** Called whenever the order moves forward, so the gallery can refresh its cards. */
  onChanged?: () => void;
  onEdit?: (id: string, key: string) => void;
}

export default function PurchasePanel({ templateId, templateName, priceUGX: priceProp, project, cur, rates, onClose, onChanged, onEdit }: PurchaseProps) {
  const memKey = templateId && !project ? `sys_buy_${templateId}` : '';
  const [proj, setProj] = useState<{ id: string; key: string } | null>(project ?? null);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [ticketErr, setTicketErr] = useState('');
  const [booting, setBooting] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [ok, setOk] = useState(false);
  const [network, setNetwork] = useState<'MTN' | 'AIRTEL' | 'OTHER'>('MTN');
  const [txId, setTxId] = useState('');
  const [busy, setBusy] = useState<'' | 'order' | 'pay' | 'check' | 'dl' | 'edit'>('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [online, setOnline] = useState(true);
  const [justPaid, setJustPaid] = useState(false);
  const ticketTried = useRef('');
  const panel = useRef<HTMLDivElement>(null);
  const prevPaid = useRef<boolean | null>(null);

  const price = status?.priceUGX !== undefined && status ? status.priceUGX : priceProp;
  const order = status?.order ?? null;
  const step: Step = order ? (order.paid ? 'download' : 'pay') : 'choose';
  const stepIdx = STEPS.findIndex((s) => s.k === step);
  const contact = status?.contact || form.email || form.phone;

  /* restore a project started earlier from this design (so closing the sheet never loses the order) */
  useEffect(() => {
    let dead = false;
    (async () => {
      let p = project ?? null;
      if (!p && memKey) { try { const raw = lsGet(memKey); const j = raw ? JSON.parse(raw) : null; if (j?.id && j?.key) p = { id: String(j.id), key: String(j.key) }; } catch { /* ignore */ } }
      if (!p) { setBooting(false); return; }
      try { const s = await fetchStatus(p.id, p.key); if (!dead) { setProj(p); setStatus(s); } }
      catch (e: any) {
        if (!dead) { if (e.status === 404 && memKey) lsDel(memKey); else if (project) { setProj(p); setErr(e.message); } }
      }
      finally { if (!dead) setBooting(false); }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async (silent = true) => {
    if (!proj) return;
    if (!silent) { setBusy('check'); setErr(''); }
    try { const s = await fetchStatus(proj.id, proj.key); setStatus(s); if (!silent) setMsg(s.order?.paid ? 'Payment confirmed.' : 'Still waiting for the payment to be confirmed. This is checked by hand, so it can take a little while.'); }
    catch (e: any) { if (!silent) setErr(e.message); }
    finally { if (!silent) setBusy(''); }
  }, [proj]);

  /* online / offline + poll for the owner's confirmation while the order is waiting */
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); refresh(true); }, off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [refresh]);
  useEffect(() => {
    if (step !== 'pay') return;
    const tick = () => { if (document.visibilityState === 'visible' && navigator.onLine) refresh(true); };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [step, refresh]);

  /* payment instructions (numbers, reference, payments so far) from the tracking endpoint */
  const loadTicket = useCallback(async (id: string, c: string) => {
    setTicketErr('');
    try { const d = await post('/api/track', { ticket: id, contact: c }); setTicket(d.ticket); }
    catch (e: any) { setTicketErr(e.message); }
  }, []);
  useEffect(() => {
    if (step !== 'pay' || !order || !contact) return;
    if (ticketTried.current === order.ticket) return;
    ticketTried.current = order.ticket;
    loadTicket(order.ticket, contact);
  }, [step, order, contact, loadTicket]);

  /* celebrate the moment the server confirms payment, and tell the gallery */
  useEffect(() => {
    const paid = !!order?.paid;
    if (prevPaid.current === false && paid) { setJustPaid(true); onChanged?.(); }
    prevPaid.current = order ? paid : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.paid, !!order]);

  useEffect(() => { panel.current?.focus(); }, []);
  const closeOnEsc = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };

  /* ── actions ── */
  const startProject = async (): Promise<{ id: string; key: string }> => {
    if (proj) return proj;
    const d = await post('/api/builder', { action: 'create', templateId });
    const p = { id: d.id as string, key: d.key as string };
    setProj(p);
    if (memKey) lsSet(memKey, JSON.stringify(p));
    rememberProject({ id: p.id, key: p.key, name: `My ${templateName} site`, template: templateName });
    onChanged?.();
    return p;
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('order'); setErr(''); setMsg('');
    try {
      const p = await startProject();
      await post('/api/builder', { action: 'order', id: p.id, key: p.key, ...form });
      const s = await fetchStatus(p.id, p.key);
      setStatus(s);
      onChanged?.();
    } catch (x: any) { setErr(x.message); } finally { setBusy(''); }
  };

  const editFirst = async () => {
    if (!onEdit || !templateId) return;
    setBusy('edit'); setErr('');
    try { const p = await startProject(); onEdit(p.id, p.key); } catch (x: any) { setErr(x.message); setBusy(''); }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setBusy('pay'); setErr(''); setMsg('');
    try {
      const d = await post('/api/pay', { ticket: order.ticket, contact, network, txId });
      if (d.ticket) setTicket(d.ticket);
      setTxId('');
      setMsg('Thanks! We received your transaction ID. We confirm it by hand — this page updates by itself the moment it is confirmed.');
      onChanged?.();
    } catch (x: any) { setErr(x.message); } finally { setBusy(''); }
  };

  const download = async () => {
    if (!proj) return;
    setBusy('dl'); setErr(''); setMsg('');
    try { await downloadProject(proj.id, proj.key); setMsg('Download started. Check your Downloads folder.'); }
    catch (x: any) { setErr(x.message); } finally { setBusy(''); }
  };

  const startOver = () => { if (memKey) lsDel(memKey); setProj(null); setStatus(null); setTicket(null); ticketTried.current = ''; setErr(''); setMsg(''); setJustPaid(false); prevPaid.current = null; };

  /* ── pieces ── */
  const shown = formatMoney(price ?? null, cur, rates);
  const inUGX = formatMoney(price ?? null, 'UGX', rates);
  const myPayments = ticket?.payments ?? [];
  const submitted = myPayments.some((p) => p.status === 'SUBMITTED');
  const canOrder = price !== null && ok && !busy && !!form.name.trim() && !!(form.email.trim() || form.phone.trim());

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center bld-fade" role="dialog" aria-modal="true" aria-label={`Buy ${templateName}`} onKeyDown={closeOnEsc}>
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div ref={panel} tabIndex={-1} className="bld-sheet relative w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-zinc-950 border border-zinc-700/80 rounded-t-2xl sm:rounded-2xl shadow-2xl outline-none overflow-hidden">
        {/* header */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-zinc-800 bg-[linear-gradient(180deg,rgba(34,211,238,.06),transparent)]">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] text-cyan-400 tracking-wide">// BUY_THIS_DESIGN</div>
            <h2 className="text-lg font-bold leading-tight truncate">{templateName}</h2>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-base text-cyan-300">{shown}</span>
              {price !== null && price > 0 && cur !== 'UGX' && <span className="text-[11px] font-mono text-zinc-400">you pay {inUGX} by mobile money</span>}
              {price !== null && price > 0 && cur === 'UGX' && <span className="text-[11px] font-mono text-zinc-400">one-time, no monthly fees</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 -mt-1 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"><IconClose /></button>
        </div>

        {/* 3-step tracker */}
        <ol className="grid grid-cols-3 gap-1 px-4 py-3 border-b border-zinc-800" aria-label="Steps">
          {STEPS.map((s, i) => {
            const done = i < stepIdx || (s.k === 'download' && order?.paid);
            const cur2 = i === stepIdx && !done;
            return (
              <li key={s.k} className="flex items-center gap-2 min-w-0" aria-current={cur2 ? 'step' : undefined}>
                <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold border transition-colors ${done ? 'bg-emerald-500 border-emerald-500 text-black' : cur2 ? 'border-cyan-400 text-cyan-300 bld-ring' : 'border-zinc-700 text-zinc-500'}`}>{done ? <IconCheck size={14} /> : i + 1}</span>
                <span className={`text-xs font-mono truncate ${done ? 'text-emerald-300' : cur2 ? 'text-zinc-100' : 'text-zinc-500'}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>

        <div className="flex-1 min-h-0 overflow-y-auto sb-slim px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4">
          {!online && <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200"><IconWifiOff size={16} className="mt-0.5" /><span>You are offline. Nothing is lost — reconnect to continue. {step === 'pay' && 'Your payment status will refresh automatically.'}</span></div>}

          {booting ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading your order"><Skeleton className="h-16 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>
          ) : step === 'choose' ? (
            price === null ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-300 space-y-3">
                <p>The owner hasn&apos;t set a price for this design yet, so it can&apos;t be bought online.</p>
                <Link href="/contact?type=design" className={btnGhost}>Contact us about it</Link>
              </div>
            ) : (
              <form onSubmit={placeOrder} className="space-y-3">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300 leading-relaxed flex gap-2"><IconShield size={18} className="text-cyan-400 mt-0.5" /><span>You get the full website as a .zip. Pay once by mobile money, then your download unlocks here. {price === 0 ? 'This design is free.' : ''}</span></div>
                <label className="block"><span className="block text-[11px] font-mono text-zinc-400 mb-1">YOUR NAME</span>
                  <input className={field} value={form.name} onFocus={kbFocus} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required aria-label="Your name" /></label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block"><span className="block text-[11px] font-mono text-zinc-400 mb-1">EMAIL</span>
                    <input className={field} type="email" inputMode="email" autoComplete="email" value={form.email} onFocus={kbFocus} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Email" /></label>
                  <label className="block"><span className="block text-[11px] font-mono text-zinc-400 mb-1">PHONE / WHATSAPP</span>
                    <input className={field} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onFocus={kbFocus} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-label="Phone" /></label>
                </div>
                <p className="text-[11px] text-zinc-500 -mt-1">Email <em>or</em> phone — you need it to track this order.</p>
                <label className="flex items-start gap-3 text-xs text-zinc-300 cursor-pointer min-h-11 py-1"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 w-5 h-5 accent-cyan-500 shrink-0" /><span>I want this design exactly as previewed. I understand it is locked once I confirm (I can unlock it until I pay) and I can download the .zip after my payment is confirmed.</span></label>
                {err && <p role="alert" className="text-xs text-red-400 flex gap-1.5"><IconWarn size={14} className="mt-0.5" />{err}</p>}
                <button disabled={!canOrder} className={`${btnPrimary} w-full`}>{busy === 'order' ? 'Placing your order…' : price === 0 ? 'Confirm & get my download' : <>Confirm & continue to payment <IconWallet size={16} /></>}</button>
                {onEdit && templateId && <button type="button" onClick={editFirst} disabled={!!busy} className={`${btnGhost} w-full`}><IconPencil size={16} /> {busy === 'edit' ? 'Starting…' : 'Customise it first, then buy'}</button>}
              </form>
            )
          ) : step === 'pay' ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 font-mono text-xs text-amber-300"><IconWallet size={16} /> PAY_BY_MOBILE_MONEY</div>
                <p className="text-sm text-zinc-200">Send <strong>{formatMoney(order!.price, 'UGX', rates)}</strong> using the reference <strong className="font-mono text-amber-200 select-all">{ticket?.pay?.reference || order!.ticket}</strong>, then enter the transaction ID from the confirmation SMS.</p>
                {ticket ? (
                  <ul className="text-sm space-y-1.5 font-mono">
                    {ticket.pay?.mtn && <li className="flex justify-between gap-3"><span className="text-zinc-400">MTN MoMo{ticket.pay.mtnName ? <span className="block text-xs text-zinc-500">{ticket.pay.mtnName}</span> : null}</span><strong className="select-all">{ticket.pay.mtn}</strong></li>}
                    {ticket.pay?.airtel && <li className="flex justify-between gap-3"><span className="text-zinc-400">Airtel Money{ticket.pay.airtelName ? <span className="block text-xs text-zinc-500">{ticket.pay.airtelName}</span> : null}</span><strong className="select-all">{ticket.pay.airtel}</strong></li>}
                    {ticket.pay?.note && <li className="text-xs text-zinc-400">{ticket.pay.note}</li>}
                    {ticket.pay && !ticket.pay.mtn && !ticket.pay.airtel && <li className="text-zinc-400">Payment numbers aren&apos;t set up yet — please contact us.</li>}
                    {!ticket.pay && ticket.depositPaid && <li className="text-emerald-300">Your payment has been received.</li>}
                  </ul>
                ) : ticketErr ? (
                  <div className="text-xs text-red-300 space-y-2"><p role="alert">{ticketErr}</p><div className="flex flex-wrap gap-2"><button className={btnGhost} onClick={() => { ticketTried.current = ''; loadTicket(order!.ticket, contact); }}><IconRefresh size={16} /> Try again</button><Link className={btnGhost} href={`/track?id=${order!.ticket}`}>Open the tracking page</Link></div></div>
                ) : <div className="space-y-2" aria-busy="true"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>}
              </div>

              {ticket?.pay && (
                <form onSubmit={submitPayment} className="space-y-3">
                  <div className="grid grid-cols-[7.5rem_1fr] gap-2">
                    <select value={network} onChange={(e) => setNetwork(e.target.value as 'MTN' | 'AIRTEL' | 'OTHER')} className={field} aria-label="Network"><option value="MTN">MTN</option><option value="AIRTEL">Airtel</option><option value="OTHER">Other</option></select>
                    <input className={`${field} font-mono uppercase`} placeholder="Transaction ID" value={txId} onFocus={kbFocus} onChange={(e) => setTxId(e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} aria-label="Transaction ID" />
                  </div>
                  <button disabled={busy === 'pay' || txId.trim().length < 6} className={`${btnPrimary} w-full`}>{busy === 'pay' ? 'Sending…' : <>I have paid <IconCheck size={16} /></>}</button>
                </form>
              )}

              {myPayments.length > 0 && (
                <ul className="text-xs font-mono space-y-1.5">
                  {myPayments.map((p, i) => <li key={i} className="flex items-center justify-between gap-2 rounded border border-zinc-800 px-3 py-2"><span className="text-zinc-300">{p.network} · {p.txId}</span><span className={p.status === 'CONFIRMED' ? 'text-emerald-400' : p.status === 'REJECTED' ? 'text-red-400' : 'text-amber-300'}>{p.status === 'SUBMITTED' ? 'WAITING' : p.status}</span></li>)}
                </ul>
              )}

              <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 border border-zinc-800 p-3 text-xs text-zinc-300" role="status" aria-live="polite">
                <IconClock size={16} className="text-cyan-400 shrink-0" />
                <span className="flex-1">{submitted ? 'Waiting for the owner to confirm your payment. Your download appears here automatically.' : 'Your download unlocks as soon as the payment is confirmed.'}</span>
                <button onClick={() => refresh(false)} disabled={busy === 'check' || !online} className="shrink-0 min-h-11 px-3 rounded-lg border border-zinc-700 hover:border-zinc-400 font-mono text-[11px] cursor-pointer disabled:opacity-40"><IconRefresh size={14} className={`inline mr-1 ${busy === 'check' ? 'animate-spin motion-reduce:animate-none' : ''}`} />Check</button>
              </div>
              {err && <p role="alert" className="text-xs text-red-400 flex gap-1.5"><IconWarn size={14} className="mt-0.5 shrink-0" />{err}</p>}
              {msg && <p role="status" className="text-xs text-zinc-300">{msg}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-zinc-500">
                <span>Order {order!.ticket}</span>
                <Link href={`/track?id=${order!.ticket}`} className="underline hover:text-zinc-300">Track this order</Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className={`mx-auto w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-center ${justPaid ? 'bld-pop' : ''}`}><IconZip size={30} /></div>
              <div><h3 className="text-lg font-bold">Payment confirmed — your website is ready</h3><p className="text-sm text-zinc-400 mt-1">Download the .zip, unzip it and upload the files to your hosting. A README inside explains how.</p></div>
              <button onClick={download} disabled={busy === 'dl'} className={`${btnGreen} w-full min-h-12 text-base`}><IconDownload size={20} /> {busy === 'dl' ? 'Preparing your .zip…' : 'Download website (.zip)'}</button>
              {err && <p role="alert" className="text-xs text-red-400 text-left flex gap-1.5"><IconWarn size={14} className="mt-0.5 shrink-0" />{err} <button className="underline cursor-pointer" onClick={download}>Try again</button></p>}
              {msg && <p role="status" className="text-xs text-emerald-300">{msg}</p>}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-mono text-zinc-500">
                <span>Order {order!.ticket}</span>
                {proj && <Link className="underline hover:text-zinc-300" href={`/builder/view?id=${proj.id}`}>View my site</Link>}
                {memKey && <button className="underline hover:text-zinc-300 cursor-pointer" onClick={startOver}>Buy another copy</button>}
              </div>
            </div>
          )}

          {step === 'pay' && order && !order.paid && proj && (
            <p className="text-[11px] text-zinc-500 flex items-center gap-1.5"><IconLock size={12} /> Locked for payment. Want to change something? <Link className="underline" href={`/builder/edit?id=${proj.id}`}>Open the editor</Link> to unlock it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
