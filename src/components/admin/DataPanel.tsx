// src/components/admin/DataPanel.tsx — backups, restore and exports.
'use client';

import { useRef, useState } from 'react';
import Icon from '@/components/ui/IconAny';
import { api, btn, downloadText, kampalaDay, primary, ticketsToCsv, type AdminTicket } from './adminKit';

export default function DataPanel({ tickets }: { tickets: AdminTicket[] }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ name: string; data: any; tickets: number; projects: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const backup = async () => {
    setBusy(true); setMsg(null);
    try {
      const data = await api('backup');
      downloadText(`system-portfolio-backup-${kampalaDay()}.json`, JSON.stringify(data, null, 2), 'application/json');
      try { localStorage.setItem('sys_admin_last_backup', String(Date.now())); } catch { /* storage blocked */ }
      setMsg({ ok: true, text: `Backup downloaded: ${data.tickets.length} requests and ${data.portfolio.length} portfolio projects.` });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  const pick = async (file?: File) => {
    setMsg(null); setPending(null);
    if (!file) return;
    if (file.size > 8_000_000) return setMsg({ ok: false, text: 'That file is too large for a backup.' });
    try {
      const data = JSON.parse(await file.text());
      if (data?.app !== 'system-portfolio') throw new Error('not a backup');
      setPending({ name: file.name, data, tickets: Array.isArray(data.tickets) ? data.tickets.length : 0, projects: Array.isArray(data.portfolio) ? data.portfolio.length : 0 });
    } catch { setMsg({ ok: false, text: 'This is not a backup file from this dashboard.' }); }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api('restore', { data: pending.data });
      setMsg({ ok: true, text: `Restored: ${r.tickets.added} requests added (${r.tickets.skipped} already existed, ${r.tickets.invalid} skipped as invalid), ${r.projects.added} projects added. Reload the dashboard to see them.` });
      setPending(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  const Card = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
    <section className="adm-rise space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 shadow-sm shadow-black/20 sm:p-5">
      <header className="flex items-center gap-3"><span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-accent/12 text-accent"><Icon name={icon} size={17} /></span><h3 className="text-sm font-semibold text-zinc-100">{title}</h3></header>
      {children}
    </section>
  );
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card icon="download" title="Backup">
        <p className="text-sm leading-relaxed text-zinc-400">Download everything you would need to rebuild the dashboard: all requests (with payments and history) and your portfolio. Keep a copy somewhere safe, especially if your host stores files on a temporary disk.</p>
        <button className={primary} onClick={backup} disabled={busy}>{busy ? 'Working…' : 'Download backup (.json)'}</button>
      </Card>

      <Card icon="undo" title="Restore">
        <p className="text-sm leading-relaxed text-zinc-400">Choose a backup file. Restoring only <strong className="text-zinc-200">adds</strong> what is missing (matched by id): it never overwrites or deletes anything you have now, so it is safe to try.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => pick(e.target.files?.[0])} className="block w-full text-xs text-zinc-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-2 file:text-xs file:text-zinc-200" />
        {pending && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
            <span className="text-zinc-300">{pending.name}: <strong>{pending.tickets}</strong> requests, <strong>{pending.projects}</strong> projects</span>
            <button className={primary} onClick={restore} disabled={busy}>{busy ? 'Working…' : 'Restore missing items'}</button>
          </div>
        )}
      </Card>

      <Card icon="save" title="Export">
        <p className="text-sm text-zinc-400">All {tickets.length} requests as a spreadsheet (opens in Excel or Google Sheets).</p>
        <button className={btn} onClick={() => downloadText(`requests-${kampalaDay()}.csv`, ticketsToCsv(tickets), 'text/csv')} disabled={!tickets.length}>Export requests (.csv)</button>
      </Card>

      <Card icon="terminal" title="Keyboard shortcuts">
        <ul className="space-y-2 text-xs text-zinc-400">
          <li className="flex items-center gap-3"><kbd className="min-w-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-center font-mono">/</kbd> search requests</li>
          <li className="flex items-center gap-3"><kbd className="min-w-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-center font-mono">r</kbd> refresh</li>
          <li className="flex items-center gap-3"><kbd className="min-w-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-center font-mono">Esc</kbd> clear selection</li>
          <li className="flex items-center gap-3"><kbd className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono">Ctrl K</kbd> command palette</li>
        </ul>
      </Card>

      {msg && <p role="status" className={`rounded-xl border px-3 py-2 text-sm lg:col-span-2 ${msg.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>{msg.text}</p>}
    </section>
  );
}
