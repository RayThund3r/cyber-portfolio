// src/components/admin/PricingPanel.tsx — the rate card behind the builder's smart price, with a live preview on every template.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { formatUGX } from '@/lib/shared';
import { effectiveUGX, FALLBACK_RATES } from '@/lib/builder/pricing';
import { DEFAULT_RATE_CARD, RATE_LABELS, TYPE_LABELS, normalizeRateCard, quote, type RateCard } from '@/lib/builder/smartPricing';
import { api, box, btn, primary } from './adminKit';

const COUNTS = ['includedSections', 'includedItems', 'includedImages'];

export default function PricingPanel() {
  const [ugxPerUsd, setUgx] = useState<number>(FALLBACK_RATES.rates.UGX);
  const [card, setCard] = useState<RateCard | null>(null);
  const [saved, setSaved] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ card: RateCard }>('pricing.get').then((d) => { setCard(d.card); setSaved(JSON.stringify(d.card)); }).catch((e) => setMsg({ ok: false, text: e.message }));
    fetch('/api/rates').then((r) => r.json()).then((r) => r?.rates?.UGX && setUgx(r.rates.UGX)).catch(() => undefined);
    fetch('/api/builder/templates').then((r) => r.json()).then((d) => setTemplates(d.templates || [])).catch(() => undefined);
  }, []);

  const dirty = card && JSON.stringify(card) !== saved;
  const rows = useMemo(() => (card ? templates.map((t) => ({ t, q: quote(t.config, card, effectiveUGX(t, ugxPerUsd) || null) })) : []), [card, templates, ugxPerUsd]);
  if (!card) return <p className="text-sm text-zinc-400">{msg?.text || 'Loading…'}</p>;

  const toNum = (v: string) => Math.max(0, Math.round(Number(v.replace(/[^\d]/g, '')) || 0));
  const setNum = (k: string, v: string) => setCard({ ...card, [k]: toNum(v) } as RateCard);
  const setType = (k: string, v: string) => setCard({ ...card, typeFees: { ...card.typeFees, [k]: toNum(v) } });
  const save = async () => {
    setBusy(true); setMsg(null);
    try { const d = await api<{ card: RateCard }>('pricing.save', { card }); setCard(d.card); setSaved(JSON.stringify(d.card)); setMsg({ ok: true, text: 'Saved. New quotes use these prices straight away.' }); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  const field = (k: string) => {
    const money = !COUNTS.includes(k);
    return (
      <label key={k} className="block text-xs text-zinc-400">{RATE_LABELS[k]}
        <div className="relative mt-1">
          <input className={`${box} font-mono ${money ? 'pr-12' : ''}`} inputMode="numeric" value={(card as any)[k]} onChange={(e) => setNum(k, e.target.value)} aria-label={RATE_LABELS[k]} />
          {money && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-zinc-500">UGX</span>}
        </div>
      </label>
    );
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-mono text-xs text-accent">SMART PRICING</h2>
        <p className="mt-1 text-sm text-zinc-400">A website&apos;s price is worked out from what is <strong>in</strong> it: sections, special features, pictures, colours and extras. Set your rates here; customers see a live price while they build, with an itemised breakdown, and the server recalculates it at checkout. A template&apos;s own price (Admin → TEMPLATES) acts as a &quot;starting from&quot; minimum. The numbers below are starting suggestions: review them against your real costs.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h3 className="font-mono text-xs text-zinc-300">BASE &amp; SIZE</h3>
          <div className="grid gap-3 sm:grid-cols-2">{['base', 'includedSections', 'perExtraSection', 'includedItems', 'perExtraItem', 'includedImages', 'perImage'].map(field)}</div>
          <h3 className="font-mono text-xs text-zinc-300">SPECIAL FEATURES (fee when the site has one)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(DEFAULT_RATE_CARD.typeFees).map((k) => (
              <label key={k} className="block text-xs text-zinc-400">{TYPE_LABELS[k] || k}
                <div className="relative mt-1"><input className={`${box} pr-12 font-mono`} inputMode="numeric" value={card.typeFees[k] ?? 0} onChange={(e) => setType(k, e.target.value)} aria-label={TYPE_LABELS[k]} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-zinc-500">UGX</span></div>
              </label>
            ))}
          </div>
          <h3 className="font-mono text-xs text-zinc-300">DESIGN EXTRAS &amp; LIMITS</h3>
          <div className="grid gap-3 sm:grid-cols-2">{['customColors', 'animations', 'darkMode', 'logo', 'min', 'roundTo'].map(field)}</div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button className={primary} onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save prices'}</button>
            <button className={btn} onClick={() => setCard(normalizeRateCard(DEFAULT_RATE_CARD))}><Icon name="refresh" /> Reset to suggestions</button>
            {dirty && <span className="font-mono text-[11px] text-amber-300">unsaved changes</span>}
            {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h3 className="font-mono text-xs text-zinc-300">WHAT EACH STARTING TEMPLATE WOULD COST (live)</h3>
          {rows.length === 0 && <p className="text-sm text-zinc-500">Loading templates…</p>}
          <ul className="space-y-3">
            {rows.map(({ t, q }) => (
              <li key={t.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-baseline justify-between gap-3"><strong className="text-sm text-zinc-100">{t.name}</strong><span className="font-mono text-emerald-300">{formatUGX(q.total)} <span className="text-[10px] text-zinc-500">{q.tier}</span></span></div>
                <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-400">{q.lines.map((l) => <li key={l.key} className="flex justify-between gap-3"><span>{l.label}</span><span className="font-mono">{formatUGX(l.amount)}</span></li>)}</ul>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-zinc-500">Customers pay for what they add. Try changing a fee and watch these totals move.</p>
        </div>
      </div>
    </section>
  );
}
