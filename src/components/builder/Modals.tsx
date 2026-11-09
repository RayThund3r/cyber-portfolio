// src/components/builder/Modals.tsx — "Confirm & buy" and "New project".
'use client';

import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, categoryOf } from '@/lib/builder/schema';
import { CURRENCIES, FALLBACK_RATES, effectiveUGX, formatMoney, type Rates } from '@/lib/builder/pricing';
import type { TemplateDef } from '@/lib/builder/templates';
import { post } from './lib';

export function BuyModal({ priceUGX, templateName, warnings, projectId, keyStr, onClose, onDone }: {
  priceUGX: number | null; templateName: string; warnings: string[]; projectId: string; keyStr: string; onClose: () => void; onDone: (ticket: string, contact: string) => void;
}) {
  const [f, setF] = useState({ name: '', email: '', phone: '' });
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  useEffect(() => { fetch('/api/rates').then((r) => r.json()).then((r) => r?.rates?.UGX && setRates(r)).catch(() => {}); }, []);
  const inp = 'w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const d = await post('/api/builder', { action: 'order', id: projectId, key: keyStr, ...f }); onDone(d.ticket, f.email || f.phone); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Confirm and buy">
      <form onSubmit={submit} className="w-full max-w-md max-h-[94vh] overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-t-2xl sm:rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-start"><h2 className="text-lg font-bold">Is your website ready?</h2><button type="button" onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-white cursor-pointer text-lg">✕</button></div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm">
          <div className="text-zinc-400 text-xs font-mono">{templateName}</div>
          <div className="text-xl font-bold text-cyan-300">{formatMoney(priceUGX, 'UGX', rates)}</div>
          {priceUGX ? <div className="text-[11px] text-zinc-500 font-mono">≈ {formatMoney(priceUGX, 'USD', rates)} · live rate · one-time payment, no monthly fees</div> : null}
        </div>
        {warnings.length > 0 && <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200 space-y-1"><div className="font-mono">Before you confirm (you can still go back and fix these):</div><ul className="list-disc pl-4">{warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>}
        {priceUGX === null ? <p className="text-sm text-zinc-300">The owner hasn&apos;t set a price for this template yet, so it can&apos;t be bought online. Please contact us and mention project <strong>{projectId}</strong>.</p> : (
          <>
            <input className={inp} placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required aria-label="Your name" />
            <input className={inp} type="email" placeholder="Email (or phone below)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" />
            <input className={inp} type="tel" placeholder="Phone / WhatsApp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label="Phone" />
            <label className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5" /><span>My website is ready. I understand the design is locked once I confirm (I can unlock it until I pay), and I can download the .zip after my payment is confirmed.</span></label>
            {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
            <button disabled={!ok || busy || !(f.name && (f.email || f.phone))} className="w-full py-3 rounded bg-cyan-500 text-black font-mono text-sm font-semibold hover:bg-cyan-400 disabled:opacity-40 cursor-pointer">{busy ? '…' : priceUGX === 0 ? 'Confirm & get my download' : 'Confirm & continue to payment →'}</button>
          </>
        )}
      </form>
    </div>
  );
}

export function NewProjectModal({ onClose, onPick, busy }: { onClose: () => void; onPick: (t: TemplateDef) => void; busy: boolean }) {
  const [list, setList] = useState<TemplateDef[] | null>(null);
  const [cat, setCat] = useState('all');
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  useEffect(() => {
    fetch('/api/builder/templates').then((r) => r.json()).then((d) => setList(d.templates || [])).catch(() => setList([]));
    fetch('/api/rates').then((r) => r.json()).then((r) => r?.rates?.UGX && setRates(r)).catch(() => {});
  }, []);
  const shown = useMemo(() => (list || []).filter((t) => cat === 'all' || t.category === cat), [list, cat]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="New project">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-700 rounded-t-2xl sm:rounded-xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800"><h2 className="font-bold">Start a new project</h2><button onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-white cursor-pointer text-lg">✕</button></div>
        <div className="flex gap-2 overflow-x-auto p-3 border-b border-zinc-800">
          {[{ id: 'all', label: 'All', icon: '✨' }, ...CATEGORIES].map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 px-3 py-1 rounded-full border text-xs font-mono cursor-pointer ${cat === c.id ? 'bg-cyan-500 border-cyan-500 text-black' : 'border-zinc-700 text-zinc-300'}`}>{c.icon} {c.label}</button>)}
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list === null && <p className="col-span-full text-sm text-zinc-500">Loading…</p>}
          {shown.map((t) => (
            <button key={t.id} disabled={busy} onClick={() => onPick(t)} className="text-left rounded-lg border border-zinc-800 hover:border-cyan-500 bg-zinc-900/50 p-3 cursor-pointer disabled:opacity-50">
              <div className="text-2xl">{categoryOf(t.category).icon}</div>
              <div className="text-sm font-semibold mt-1">{t.name}</div>
              <div className="text-[11px] text-zinc-400 line-clamp-2">{t.description}</div>
              <div className="text-[11px] font-mono text-cyan-300 mt-1">{formatMoney(effectiveUGX(t, rates.rates.UGX), 'UGX', rates)}</div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-zinc-800 text-[11px] text-zinc-500">{busy ? 'Creating your project…' : 'Your current project is saved first, so nothing is lost.'}</div>
      </div>
    </div>
  );
}
export { CURRENCIES };
