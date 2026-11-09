// src/components/admin/TicketsPanel.tsx — the requests list: search, filters, sorting, bulk actions, CSV export.
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { STATUS_FLOW, STATUS_LABEL, type TicketStatus } from '@/lib/shared';
import { api, box, btn, downloadText, hasPaymentToCheck, kampalaDay, needsAttention, primary, ticketsToCsv, timeAgo, type AdminTicket } from './adminKit';

const ALL_STATUSES: TicketStatus[] = [...STATUS_FLOW, 'CANCELLED'];
const PAGE = 25;
type Sort = 'newest' | 'oldest' | 'visit' | 'attention';

export default function TicketsPanel({
  tickets, setTickets, reload, error, fresh, clearFresh, openId, setOpenId, renderEditor,
}: {
  tickets: AdminTicket[];
  setTickets: (fn: (l: AdminTicket[]) => AdminTicket[]) => void;
  reload: () => void;
  error: string | null;
  fresh: string[];
  clearFresh: () => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  renderEditor: (t: AdminTicket, onSaved: (t: AdminTicket) => void) => ReactNode;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'ALL' | TicketStatus>('ALL');
  const [kind, setKind] = useState<'ALL' | AdminTicket['kind']>('ALL');
  const [sort, setSort] = useState<Sort>('newest');
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<TicketStatus>('IN_PROGRESS');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tickets.length };
    tickets.forEach((t) => (c[t.status] = (c[t.status] || 0) + 1));
    return c;
  }, [tickets]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = tickets.filter(
      (t) => (status === 'ALL' || t.status === status) && (kind === 'ALL' || t.kind === kind) && (!needle || `${t.id} ${t.name} ${t.phone} ${t.email} ${t.details}`.toLowerCase().includes(needle))
    );
    const byDate = (a: AdminTicket, b: AdminTicket) => b.createdAt.localeCompare(a.createdAt);
    if (sort === 'oldest') list.sort((a, b) => -byDate(a, b));
    else if (sort === 'visit') list.sort((a, b) => (a.slot ? `${a.slot.date} ${a.slot.time}` : '9999').localeCompare(b.slot ? `${b.slot.date} ${b.slot.time}` : '9999') || byDate(a, b));
    else if (sort === 'attention') list.sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)) || byDate(a, b));
    else list.sort(byDate);
    return list;
  }, [tickets, q, status, kind, sort]);

  // Jumping here from the Overview: make sure the request is visible, then scroll to it.
  useEffect(() => {
    if (!openId) return;
    const idx = shown.findIndex((t) => t.id === openId);
    if (idx < 0) {
      if (tickets.some((t) => t.id === openId)) { setStatus('ALL'); setKind('ALL'); setQ(''); }
      return;
    }
    if (idx >= limit) { setLimit(idx + 1); return; }
    requestAnimationFrame(() => document.getElementById(`t-${openId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, shown.length]);

  // Keyboard: / search · r refresh · Esc clears the selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === 'Escape' && picked.size) setPicked(new Set());
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'r') reload();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picked.size, reload]);

  const visible = shown.slice(0, limit);
  const allVisiblePicked = visible.length > 0 && visible.every((t) => picked.has(t.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pendingPay = tickets.filter(hasPaymentToCheck).length;

  const bulk = async (op: 'status' | 'delete') => {
    const ids = [...picked];
    if (!ids.length) return;
    if (op === 'delete' && !confirm(`Permanently delete ${ids.length} request(s)? This cannot be undone. (Download a backup first if unsure.)`)) return;
    setBusy(true); setMsg(null);
    try {
      if (op === 'delete') {
        const r = await api<{ deleted: number }>('tickets.bulk', { op: 'delete', ids });
        setTickets((l) => l.filter((t) => !picked.has(t.id)));
        setMsg(`Deleted ${r.deleted}.`);
      } else {
        const r = await api<{ updated: number }>('tickets.bulk', { ids, status: bulkStatus });
        setTickets((l) => l.map((t) => (picked.has(t.id) ? { ...t, status: bulkStatus } : t)));
        setMsg(`${r.updated} request(s) set to "${STATUS_LABEL[bulkStatus]}". Customers were not emailed.`);
      }
      setPicked(new Set());
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const chip = (value: 'ALL' | TicketStatus, label: string) => (
    <button key={value} type="button" onClick={() => { setStatus(value); setLimit(PAGE); }} aria-pressed={status === value}
      className={`${btn} ${status === value ? 'border-cyan-500 text-cyan-400' : ''}`}>
      {label} <span className="text-zinc-500">{counts[value] || 0}</span>
    </button>
  );

  return (
    <section className="space-y-4">
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
      {pendingPay > 0 && <p className="text-xs font-mono text-amber-400">💰 {pendingPay} payment(s) waiting for you to verify.</p>}
      {fresh.length > 0 && (
        <button type="button" onClick={clearFresh} className="w-full rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-left text-xs font-mono text-emerald-400">
          🔔 {fresh.length} new request{fresh.length > 1 ? 's' : ''} arrived while you were here. Tap to dismiss.
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <input ref={searchRef} className={`${box} sm:max-w-xs`} placeholder="Search name, phone, id, details…  ( / )" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} aria-label="Search requests" />
        <select className={`${box} sm:max-w-[9rem]`} value={kind} onChange={(e) => setKind(e.target.value as any)} aria-label="Filter by type">
          <option value="ALL">All types</option><option value="repair">Repairs</option><option value="design">Design</option><option value="template">Websites</option>
        </select>
        <select className={`${box} sm:max-w-[12rem]`} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="visit">Next visit first</option><option value="attention">Needs attention first</option>
        </select>
        <button className={btn} onClick={() => reload()} title="Refresh (r)">↻</button>
        <button className={btn} onClick={() => downloadText(`requests-${kampalaDay()}.csv`, ticketsToCsv(shown), 'text/csv')} disabled={!shown.length} title="Download the requests shown as a spreadsheet">⬇ CSV</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {chip('ALL', 'All')}
        {ALL_STATUSES.filter((s) => counts[s]).map((s) => chip(s, STATUS_LABEL[s]))}
      </div>

      {picked.size > 0 && (
        <div className="sticky top-16 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/40 bg-zinc-900/95 p-3 text-xs backdrop-blur ios-enter" role="region" aria-label="Bulk actions">
          <strong className="font-mono text-cyan-400">{picked.size} selected</strong>
          <select className={`${box} !w-auto`} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as TicketStatus)} aria-label="New status">
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button className={primary} disabled={busy} onClick={() => bulk('status')}>Set status</button>
          <button className={`${btn} !border-red-500/60 text-red-400`} disabled={busy} onClick={() => bulk('delete')}>Delete</button>
          <button className={btn} onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}
      {msg && <p role="status" className="text-xs text-zinc-300">{msg}</p>}

      {shown.length === 0 ? (
        <p className="text-sm text-zinc-400">{tickets.length ? 'No requests match these filters.' : 'No requests yet.'}</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={allVisiblePicked} onChange={() => setPicked(allVisiblePicked ? new Set() : new Set(visible.map((t) => t.id)))} aria-label="Select all shown" />
              select all shown
            </label>
            <span>showing {visible.length} of {shown.length}</span>
          </div>
          <ul className="ios-stagger space-y-3">
            {visible.map((t, i) => (
              <li key={t.id} id={`t-${t.id}`} style={{ ['--i' as string]: Math.min(i, 10) }} className={`rounded-xl border bg-zinc-900/40 ${picked.has(t.id) ? 'border-cyan-500/60' : 'border-zinc-800'}`}>
                <div className="flex items-stretch">
                  <label className="flex cursor-pointer items-center px-3" aria-label={`Select ${t.id}`}>
                    <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                  </label>
                  <button className="flex flex-1 cursor-pointer flex-wrap items-center justify-between gap-2 py-4 pr-4 text-left" onClick={() => setOpenId(openId === t.id ? null : t.id)} aria-expanded={openId === t.id}>
                    <span>
                      <span className="font-mono text-xs text-cyan-400">{t.id}</span> <strong className="ml-2">{t.name}</strong>{' '}
                      <span className="text-xs text-zinc-400">· {t.kind}{t.slot ? ` · 📅 ${t.slot.date} ${t.slot.time}` : ''}</span>
                      {fresh.includes(t.id) && <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">NEW</span>}
                    </span>
                    <span className="text-xs font-mono text-zinc-300">
                      <span className={needsAttention(t) ? 'mr-2 text-amber-400' : 'mr-2 text-zinc-500'}>{timeAgo(t.createdAt)}</span>
                      {hasPaymentToCheck(t) && '💰 '}{STATUS_LABEL[t.status]}
                    </span>
                  </button>
                </div>
                {openId === t.id && renderEditor(t, (nt) => setTickets((l) => l.map((x) => (x.id === nt.id ? nt : x))))}
              </li>
            ))}
          </ul>
          {shown.length > limit && <button className={`${btn} w-full py-2.5`} onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}
        </>
      )}
    </section>
  );
}
