// src/components/chat/AccessPanel.tsx — "get more AI answers": redeem a code, or pay by mobile money and send the transaction id.
'use client';
import { useEffect, useState } from 'react';
import { loadAccess, redeemPass, requestPass } from '@/utils/chatEngine/remoteLLM';

type Plan = { id: string; name: string; price: string; note: string };
const field = 'w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none';

export default function AccessPanel({ onClose }: { onClose: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payInfo, setPayInfo] = useState('');
  const [mode, setMode] = useState<'code' | 'pay'>('code');
  const [code, setCode] = useState('');
  const [plan, setPlan] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [tx, setTx] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    loadAccess().then((a) => { if (alive && a) { setPlans(a.plans); setPayInfo(a.payInfo); setPlan((p) => p || a.plans[0]?.id || ''); } });
    return () => { alive = false; };
  }, []);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okText: string) => {
    setBusy(true); setMsg(null);
    const r = await fn();
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? r.message || okText : r.error || 'Something went wrong.' });
    if (r.ok && mode === 'code') window.setTimeout(onClose, 1400);
  };

  const tab = (m: 'code' | 'pay', label: string) => (
    <button type="button" onClick={() => { setMode(m); setMsg(null); }} aria-pressed={mode === m}
      className={`hit cursor-pointer rounded px-2 py-1 ${mode === m ? 'bg-accent-strong font-bold text-black' : 'border border-zinc-700 text-zinc-400 hover:text-zinc-100'}`}>{label}</button>
  );

  return (
    <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/70 p-2 text-zinc-300" role="region" aria-label="Get more AI answers">
      <div className="mb-2 flex items-center gap-2">
        {tab('code', 'I HAVE A CODE')}{plans.length > 0 && tab('pay', 'BUY A PASS')}
        <button type="button" onClick={onClose} aria-label="Close" className="hit ml-auto cursor-pointer px-1 text-zinc-500 hover:text-zinc-200">✕</button>
      </div>
      {mode === 'code' ? (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void run(() => redeemPass(code), 'Pass unlocked. Enjoy!'); }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SD-XXXX-XXXX-XXXX" aria-label="Access code" autoCapitalize="characters" autoComplete="off" spellCheck={false} className={field} />
          <button type="submit" disabled={busy || !code.trim()} className="shrink-0 cursor-pointer rounded bg-accent-strong px-3 py-1.5 font-bold text-black disabled:opacity-50">{busy ? '…' : 'UNLOCK'}</button>
        </form>
      ) : (
        <form className="space-y-1.5" onSubmit={(e) => { e.preventDefault(); void run(() => requestPass({ plan, name, contact, txId: tx }), 'Request sent.'); }}>
          <div className="grid gap-1" role="radiogroup" aria-label="Plan">
            {plans.map((p) => (
              <label key={p.id} className={`flex cursor-pointer items-center justify-between gap-2 rounded border px-2 py-1.5 ${plan === p.id ? 'border-accent text-zinc-100' : 'border-zinc-800 text-zinc-400'}`}>
                <span className="flex items-center gap-2"><input type="radio" name="aiplan" checked={plan === p.id} onChange={() => setPlan(p.id)} className="accent-[var(--accent,#34d399)]" /><b>{p.name}</b> <span className="text-zinc-500">{p.note}</span></span>
                <span className="shrink-0 text-accent">{p.price}</span>
              </label>
            ))}
          </div>
          {payInfo && <p className="whitespace-pre-line rounded bg-zinc-900 p-2 text-zinc-400">{payInfo}</p>}
          <p className="text-zinc-500">Pay with mobile money, then enter the transaction id from the confirmation message.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" maxLength={60} className={field} />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" aria-label="Phone or email" maxLength={80} className={field} />
          <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="Transaction id" aria-label="Transaction id" maxLength={40} autoComplete="off" className={field} />
          <button type="submit" disabled={busy || !plan || !name.trim() || !contact.trim() || !tx.trim()} className="w-full cursor-pointer rounded bg-accent-strong px-3 py-1.5 font-bold text-black disabled:opacity-50">{busy ? 'SENDING…' : 'SEND FOR APPROVAL'}</button>
        </form>
      )}
      {msg && <p role="status" className={`mt-1.5 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
    </div>
  );
}
