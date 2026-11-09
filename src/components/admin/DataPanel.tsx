// src/components/admin/DataPanel.tsx — backups, restore and exports.
'use client';

import { useRef, useState } from 'react';
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

  return (
    <section className="space-y-6">
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="font-mono text-xs text-cyan-400">BACKUP</h2>
        <p className="text-sm text-zinc-400">Download everything you would need to rebuild the dashboard: all requests (with payments and history) and your portfolio. Keep a copy somewhere safe, especially if your host stores files on a temporary disk.</p>
        <button className={primary} onClick={backup} disabled={busy}>{busy ? '…' : '⬇ Download backup (.json)'}</button>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="font-mono text-xs text-cyan-400">RESTORE</h2>
        <p className="text-sm text-zinc-400">Choose a backup file. Restoring only <strong>adds</strong> what is missing (matched by id): it never overwrites or deletes anything you have now, so it is safe to try.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => pick(e.target.files?.[0])} className="block w-full text-xs text-zinc-300 file:mr-3 file:cursor-pointer file:rounded file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-1.5 file:font-mono file:text-xs file:text-zinc-200" aria-label="Backup file" />
        {pending && (
          <div className="flex flex-wrap items-center gap-3 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
            <span className="text-zinc-300">{pending.name}: <strong>{pending.tickets}</strong> requests, <strong>{pending.projects}</strong> projects</span>
            <button className={primary} onClick={restore} disabled={busy}>{busy ? '…' : 'Restore missing items'}</button>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="font-mono text-xs text-cyan-400">EXPORT</h2>
        <p className="text-sm text-zinc-400">All {tickets.length} requests as a spreadsheet (opens in Excel or Google Sheets).</p>
        <button className={btn} onClick={() => downloadText(`requests-${kampalaDay()}.csv`, ticketsToCsv(tickets), 'text/csv')} disabled={!tickets.length}>⬇ Export requests (.csv)</button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-xs text-zinc-400">
        <h2 className="mb-2 font-mono text-xs text-cyan-400">KEYBOARD SHORTCUTS</h2>
        <ul className="space-y-1 font-mono">
          <li><kbd className="rounded border border-zinc-700 px-1.5">/</kbd> search requests</li>
          <li><kbd className="rounded border border-zinc-700 px-1.5">r</kbd> refresh</li>
          <li><kbd className="rounded border border-zinc-700 px-1.5">Esc</kbd> clear selection</li>
        </ul>
      </div>

      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
    </section>
  );
}
