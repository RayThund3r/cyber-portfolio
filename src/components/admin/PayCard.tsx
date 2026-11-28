// src/components/admin/PayCard.tsx: mobile-money details, one registered name per network. Saved here, no Vercel variables needed.
'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/ui/IconAny';
import { api, box, primary } from './adminKit';

interface Pay { mtnNumber: string; mtnName: string; airtelNumber: string; airtelName: string; note: string }
const EMPTY: Pay = { mtnNumber: '', mtnName: '', airtelNumber: '', airtelName: '', note: '' };

export default function PayCard() {
  const [p, setP] = useState<Pay | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api<{ pay: Pay }>('pay.get').then((d) => { setP(d.pay); setSaved(JSON.stringify(d.pay)); }).catch((e) => { setP(EMPTY); setSaved(JSON.stringify(EMPTY)); setMsg({ ok: false, text: e.message }); }); }, []);
  if (!p) return <div className="h-40 adm-skel rounded-2xl" aria-busy="true" />;
  const dirty = JSON.stringify(p) !== saved;
  const set = (k: keyof Pay, v: string) => setP({ ...p, [k]: v });
  const save = async () => {
    setBusy(true); setMsg(null);
    try { const d = await api<{ pay: Pay }>('pay.save', { pay: p }); setP(d.pay); setSaved(JSON.stringify(d.pay)); setMsg({ ok: true, text: 'Saved. Customers see this on their next order.' }); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  const net = (title: string, tone: string, nk: keyof Pay, nameK: keyof Pay) => (
    <div className="space-y-2.5 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <p className={`text-xs font-semibold ${tone}`}>{title}</p>
      <label className="block"><span className="mb-1 block text-xs text-zinc-400">Number</span><input className={box} value={p[nk]} onChange={(e) => set(nk, e.target.value)} inputMode="tel" placeholder="0700 000 000" maxLength={20} /></label>
      <label className="block"><span className="mb-1 block text-xs text-zinc-400">Registered name on this number</span><input className={box} value={p[nameK]} onChange={(e) => set(nameK, e.target.value)} placeholder="Name customers will see" maxLength={60} /></label>
    </div>
  );
  return (
    <section className="adm-rise space-y-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 shadow-sm shadow-black/20 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-accent/12 text-accent"><Icon name="credit-card" size={17} /></span>
        <div className="min-w-0"><h3 className="text-sm font-semibold text-zinc-100">Mobile-money details</h3><p className="mt-0.5 text-xs leading-relaxed text-zinc-500">Shown to customers when they pay for a website or a deposit. Each network has its own number and its own registered name. Leave a network empty to hide it.</p></div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {net('MTN MoMo', 'text-amber-300', 'mtnNumber', 'mtnName')}
        {net('Airtel Money', 'text-rose-300', 'airtelNumber', 'airtelName')}
      </div>
      <label className="block"><span className="mb-1 block text-xs text-zinc-400">Extra note (optional)</span><input className={box} value={p.note} onChange={(e) => set('note', e.target.value)} placeholder="For example: send the exact amount, then submit the transaction ID" maxLength={200} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primary} onClick={save} disabled={busy || !dirty}>{busy ? 'Saving...' : 'Save payment details'}</button>
        {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
