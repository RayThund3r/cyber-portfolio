// src/components/admin/TemplatesPanel.tsx — the website templates customers pick in the builder, with their prices.
'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { CATEGORIES } from '@/lib/builder/schema';
import { FALLBACK_RATES, effectiveUGX, type Rates } from '@/lib/builder/pricing';
import { formatUGX } from '@/lib/shared';
import { api, box, btn, primary } from './adminKit';
import { AButton, Badge, Empty, Field, Notice } from './ui';

type TplRow = { id: string; name: string; description: string; category: string; tag?: string; priceUSD: number | null; priceUGX: number | null; enabled: boolean };

export default function TemplatesPanel() {
  const [rows, setRows] = useState<TplRow[]>([]); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  useEffect(() => { api<{ templates: TplRow[]; rates: Rates }>('templates.list').then((d) => { setRows(d.templates ?? []); if (d.rates?.rates?.UGX) setRates(d.rates); }).catch((e) => setMsg({ ok: false, text: e.message })); }, []);
  const set = (id: string, patch: Partial<TplRow>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const act = async (action: string, data: Record<string, unknown>, ok = 'Saved') => {
    setMsg(null);
    try { const d = await api<{ templates?: TplRow[] }>(action, data); if (d.templates) setRows(d.templates); setMsg({ ok: true, text: ok }); } catch (e: any) { setMsg({ ok: false, text: e.message }); }
  };
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/\D/g, '')));

  return (
    <section className="space-y-5">
      <Notice title="How prices work">
        Each template has a <b className="text-zinc-200">market-reference USD price</b> (about US$15 to 60 for comparable premium templates). Customers see it converted at the <b className="text-zinc-200">live exchange rate</b> and pay in UGX by mobile money. Want a fixed shilling price? Fill the <b className="text-zinc-200">UGX override</b> (0 = free). Leave both empty and it is not for sale.
        <span className="mt-1 block font-mono text-[11px] text-zinc-500">Current rate: 1 USD = {Math.round(rates.rates.UGX).toLocaleString()} UGX ({rates.source}{rates.source === 'fallback' ? ', estimate' : ''})</span>
      </Notice>
      {msg && <p role="status" className={`text-xs font-medium ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>}
      {rows.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="cube" title="No templates yet" /></div>}
      <ul className="space-y-3">
        {rows.map((t) => {
          const eff = effectiveUGX(t, rates.rates.UGX);
          return (
            <li key={t.id} className={`adm-rise space-y-3 rounded-2xl border bg-zinc-900/50 p-4 ${t.enabled ? 'border-zinc-800/80' : 'border-zinc-800/50 opacity-80'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-sky-500/12 text-sky-300"><Icon name="cube" size={17} /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{t.name || 'Untitled template'}</span>
                {!t.enabled && <Badge>Hidden</Badge>}
                <Badge tone={eff === null ? 'bad' : eff === 0 ? 'ok' : 'accent'}>{eff === null ? 'Not for sale' : eff === 0 ? 'Free' : formatUGX(eff)}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name"><input className={box} value={t.name} onChange={(e) => set(t.id, { name: e.target.value })} /></Field>
                <Field label="Category"><select className={box} value={t.category} onChange={(e) => set(t.id, { category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
                <Field label="Badge"><input className={box} value={t.tag ?? ''} maxLength={16} placeholder="e.g. New" onChange={(e) => set(t.id, { tag: e.target.value })} /></Field>
              </div>
              <Field label="Description"><textarea className={box} rows={2} value={t.description} onChange={(e) => set(t.id, { description: e.target.value })} /></Field>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-28"><Field label="Price (USD)"><input className={box} inputMode="numeric" placeholder="none" value={t.priceUSD ?? ''} onChange={(e) => set(t.id, { priceUSD: num(e.target.value) })} /></Field></div>
                <div className="w-44"><Field label="UGX override"><input className={box} inputMode="numeric" placeholder="auto (live rate)" value={t.priceUGX ?? ''} onChange={(e) => set(t.id, { priceUGX: num(e.target.value) })} /></Field></div>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-zinc-300"><input type="checkbox" className="accent-[var(--accent)]" checked={t.enabled} onChange={(e) => set(t.id, { enabled: e.target.checked })} />Visible to customers</label>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-800/80 pt-3">
                <button className={primary} onClick={() => act('template.save', { ...t })}>Save</button>
                <a className={btn} href={`/builder/edit?template=${t.id}`} target="_blank" rel="noopener noreferrer"><Icon name="pencil" size={13} />Edit design</a>
                <a className={btn} href={`/builder/view?t=${t.id}`} target="_blank" rel="noopener noreferrer"><Icon name="eye" size={13} />View</a>
                <AButton onClick={() => act('template.duplicate', { id: t.id }, 'Duplicated. It stays hidden until you make it visible.')} icon="copy">Duplicate</AButton>
                <AButton danger onClick={() => confirm(`Delete “${t.name}”?`) && act('template.delete', { id: t.id }, 'Deleted')} icon="trash">Delete</AButton>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
