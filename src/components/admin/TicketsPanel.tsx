// src/components/admin/TicketsPanel.tsx — the requests list: search, filters, sorting, bulk actions, CSV export.
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { STATUS_FLOW, STATUS_LABEL, type TicketStatus } from '@/lib/shared';
import { api, box, btn, downloadText, hasPaymentToCheck, kampalaDay, needsAttention, primary, ticketsToCsv, timeAgo, type AdminTicket } from './adminKit';

import Icon from '@/components/ui/Icon';
import { AButton, Avatar, Banner, Chips, Empty, KindBadge, Priv, STATUS_STYLE, StatusPill } from './ui';
import { ask } from '@/lib/dialog';
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
    if (op === 'delete' && !await ask(`Permanently delete ${ids.length} request(s)? This cannot be undone. (Download a backup first if unsure.)`, { danger: true })) return;
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

  return (
    <section className="space-y-4">
      {error && <Banner tone="warn" icon="bell">{error}</Banner>}
      {pendingPay > 0 && <Banner tone="warn" icon="money">{pendingPay} payment{pendingPay > 1 ? 's' : ''} waiting for you to verify. Open the request to confirm or reject.</Banner>}
      {fresh.length > 0 && <Banner tone="ok" icon="bell" action="Dismiss" onAction={clearFresh}>{fresh.length} new request{fresh.length > 1 ? 's' : ''} arrived while you were here.</Banner>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input ref={searchRef} className={`${box} pl-9`} placeholder="Search name, phone, id, details…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} aria-label="Search requests" />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-zinc-700 px-1.5 font-mono text-[10px] text-zinc-500 sm:block">/</kbd>
        </div>
        <select className={`${box} !w-auto`} value={kind} onChange={(e) => setKind(e.target.value as any)} aria-label="Filter by type">
          <option value="ALL">All types</option><option value="repair">Repairs</option><option value="design">Design</option><option value="template">Websites</option>
        </select>
        <select className={`${box} !w-auto`} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="visit">Next visit first</option><option value="attention">Needs attention first</option>
        </select>
        <div className="ml-auto flex gap-2">
          <AButton onClick={() => reload()} title="Refresh (r)" icon="refresh" />
          <AButton onClick={() => downloadText(`requests-${kampalaDay()}.csv`, ticketsToCsv(shown), 'text/csv')} disabled={!shown.length} title="Download the requests shown as a spreadsheet" icon="download">CSV</AButton>
        </div>
      </div>

      <Chips value={status} onChange={(v) => { setStatus(v); setLimit(PAGE); }}
        items={[{ id: 'ALL' as const, label: 'All', count: counts.ALL || 0 }, ...ALL_STATUSES.filter((st) => counts[st]).map((st) => ({ id: st, label: STATUS_LABEL[st], count: counts[st], dot: STATUS_STYLE[st]?.dot }))]} />

      {picked.size > 0 && (
        <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-zinc-900/95 p-2.5 text-xs shadow-xl shadow-black/40 backdrop-blur ios-enter" role="region" aria-label="Bulk actions">
          <strong className="px-1 font-mono text-accent">{picked.size} selected</strong>
          <select className={`${box} !w-auto !min-h-9`} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as TicketStatus)} aria-label="New status">
            {ALL_STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
          </select>
          <button className={primary} disabled={busy} onClick={() => bulk('status')}>Set status</button>
          <button className={`${btn} !border-rose-500/50 !text-rose-300 hover:!bg-rose-500/10`} disabled={busy} onClick={() => bulk('delete')}>Delete</button>
          <button className={btn} onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}
      {msg && <p role="status" className="text-xs text-zinc-300">{msg}</p>}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="mail" title={tickets.length ? 'No requests match these filters' : 'No requests yet'} text={tickets.length ? 'Try a different search or clear the filters.' : 'When a customer sends a repair, design or website request it appears here.'} /></div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={allVisiblePicked} onChange={() => setPicked(allVisiblePicked ? new Set() : new Set(visible.map((t) => t.id)))} aria-label="Select all shown" className="accent-[var(--accent)]" />
              Select all shown
            </label>
            <span>Showing {visible.length} of {shown.length}</span>
          </div>
          <ul className="ios-stagger space-y-2.5">
            {visible.map((t, i) => {
              const urgent = needsAttention(t);
              return (
                <li key={t.id} id={`t-${t.id}`} style={{ ['--i' as string]: Math.min(i, 10) }} className={`adm-rise overflow-hidden rounded-2xl border bg-zinc-900/50 transition ${picked.has(t.id) ? 'border-accent/60' : openId === t.id ? 'border-zinc-600' : 'border-zinc-800/80 hover:border-zinc-700'}`}>
                  <div className="flex items-stretch">
                    <label className="flex cursor-pointer items-center pl-3.5 pr-1" aria-label={`Select ${t.id}`}>
                      <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} className="accent-[var(--accent)]" />
                    </label>
                    <button className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-3.5 text-left" onClick={() => setOpenId(openId === t.id ? null : t.id)} aria-expanded={openId === t.id}>
                      <Avatar name={t.name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <strong className="truncate text-sm font-semibold text-zinc-100"><Priv>{t.name}</Priv></strong>
                          <KindBadge kind={t.kind} withLabel />
                          {fresh.includes(t.id) && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">NEW</span>}
                          {hasPaymentToCheck(t) && <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"><Icon name="money" size={11} />PAYMENT</span>}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                          <span className="font-mono text-accent/80">{t.id}</span>
                          {t.slot && <span className="inline-flex items-center gap-1"><Icon name="calendar" size={11} />{t.slot.date} · {t.slot.time}</span>}
                          {t.quoteUGX ? <span>UGX {t.quoteUGX.toLocaleString()}</span> : null}
                        </span>
                      </span>
                      <span className="flex flex-none flex-col items-end gap-1">
                        <StatusPill status={t.status} label={STATUS_LABEL[t.status]} />
                        <span className={`text-[11px] ${urgent ? 'font-semibold text-amber-300' : 'text-zinc-600'}`}>{timeAgo(t.createdAt)}</span>
                      </span>
                      <Icon name="arrow" size={14} className={`hidden flex-none text-zinc-600 transition sm:block ${openId === t.id ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                  {openId === t.id && renderEditor(t, (nt) => setTickets((l) => l.map((x) => (x.id === nt.id ? nt : x))))}
                </li>
              );
            })}
          </ul>
          {shown.length > limit && <button className={`${btn} w-full !min-h-11`} onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}
        </>
      )}
    </section>
  );
}
