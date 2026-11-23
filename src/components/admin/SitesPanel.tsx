// src/components/admin/SitesPanel.tsx — sites customers are building or have ordered: preview, download, delete.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildSite } from '@/lib/builder/generate';
import type { SiteConfig } from '@/lib/builder/schema';
import { formatUGX } from '@/lib/shared';
import { api } from './adminKit';
import { AButton, Avatar, Badge, Empty, Notice, Priv } from './ui';

type SiteRow = { id: string; name: string; template: string; siteName: string; updatedAt: string; status: 'DRAFT' | 'AWAITING_PAYMENT' | 'PAID'; ticket: string | null; price: number | null; contact: { name: string; email: string; phone: string } | null; kb: number };
const TONE = { PAID: 'ok', AWAITING_PAYMENT: 'warn', DRAFT: 'default' } as const;
const LABEL = { PAID: 'Paid', AWAITING_PAYMENT: 'Awaiting payment', DRAFT: 'Draft' } as const;

export default function SitesPanel() {
  const [rows, setRows] = useState<SiteRow[]>([]); const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<{ id: string; html: string } | null>(null);
  const load = useCallback(() => api<{ sites: SiteRow[] }>('sites.list').then((d) => setRows(d.sites ?? [])).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const preview = async (id: string) => {
    try {
      const d = await api<{ config: SiteConfig; assets: Record<string, string> }>('site.get', { id });
      setView({ id, html: buildSite(d.config, { mode: 'preview', assetSrc: (a) => d.assets[a] || '' }).html });
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <section className="space-y-5">
      <Notice title="Sites customers are building">Confirm their payment under <b className="text-zinc-200">Requests</b>; that unlocks their download. You can always preview or download any site here.</Notice>
      {msg && <p role="alert" className="text-xs font-medium text-rose-300">{msg}</p>}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="globe" title="No customer sites yet" text="When someone starts a site in the builder it shows up here." /></div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 transition hover:border-zinc-700">
              <Avatar name={r.siteName || r.name || 'Site'} size={40} />
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-zinc-100">{r.siteName}</span><span className="text-xs text-zinc-500">{r.template}</span></div>
                <div className="mt-0.5 text-[11px] text-zinc-500"><span className="font-mono">{r.id}</span> · {r.kb} KB · {new Date(r.updatedAt).toLocaleDateString('en-UG')}{r.contact ? <> · <Priv>{r.contact.name} {r.contact.phone || r.contact.email}</Priv></> : ''}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                {r.price ? <Badge>{formatUGX(r.price)}</Badge> : null}
                {r.ticket ? <Badge tone="accent">{r.ticket}</Badge> : null}
              </div>
              <div className="flex gap-1.5">
                <AButton small icon="eye" onClick={() => preview(r.id)}>Preview</AButton>
                <a className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 font-mono text-[11px] text-zinc-300 hover:border-accent/50 hover:text-accent" href={`/api/admin/zip?id=${r.id}`}>Zip</a>
                <AButton small danger icon="trash" title="Delete" onClick={async () => { if (confirm(`Delete project ${r.id}? This cannot be undone.`)) { await api('site.delete', { id: r.id }); load(); } }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {view && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Site preview">
          <div className="mb-2 flex items-center justify-between text-xs font-mono text-zinc-300"><span>Preview · {view.id}</span><AButton small icon="close" onClick={() => setView(null)}>Close</AButton></div>
          <iframe title="Customer site preview" sandbox="allow-scripts" srcDoc={view.html} className="w-full flex-1 rounded-xl border-0 bg-white" />
        </div>
      )}
    </section>
  );
}
