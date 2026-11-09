// src/components/admin/adminKit.ts
//
// Shared pieces of the admin dashboard: the API helper, types, small utilities, CSV export and the
// hook that keeps the request list fresh. Kept separate so each dashboard panel stays small.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TicketStatus } from '@/lib/shared';

export type AdminTicket = {
  id: string; kind: 'repair' | 'design' | 'template'; projectId?: string; name: string; email: string; phone: string; details: string; wa: string;
  slot?: { date: string; time: string }; status: TicketStatus; quoteUGX?: number; depositUGX?: number; adminNotes?: string;
  payments: { id: string; network: string; txId: string; amountUGX?: number; status: string; at: string }[];
  history: { at: string; status: TicketStatus; note?: string }[]; createdAt: string; updatedAt?: string;
};

export type Stats = {
  daily: { day: string; views: number }[]; pages: Record<string, number>; events: Record<string, number>; byStatus: Record<string, number>;
  unanswered: { q: string; n: number; last: string }[]; audit: { at: string; ip: string; ua: string; event: string; ok: boolean }[]; errors: { msg: string; where: string; n: number; last: string }[];
};

export async function api<T = any>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { status: r.status, data: d });
  return d as T;
}

export const box = 'w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500';
export const btn = 'px-3 py-1.5 rounded border border-zinc-700 text-xs font-mono hover:border-zinc-500 cursor-pointer disabled:opacity-40';
export const primary = 'px-3 py-1.5 rounded bg-cyan-500 text-black text-xs font-mono font-semibold hover:bg-cyan-400 cursor-pointer disabled:opacity-40';

/* ───────────── small helpers ───────────── */

const TZ = 'Africa/Kampala';

/** YYYY-MM-DD for a moment, in the shop's time zone (the booking slots use it too). */
export const kampalaDay = (d: Date | string = new Date()) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const isOpenTicket = (t: AdminTicket) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED';
export const hasPaymentToCheck = (t: AdminTicket) => t.payments.some((p) => p.status === 'SUBMITTED');
/** Brand-new request nobody has answered for a day, or a payment waiting to be verified. */
export const needsAttention = (t: AdminTicket) =>
  isOpenTicket(t) && (hasPaymentToCheck(t) || (t.status === 'RECEIVED' && Date.now() - new Date(t.createdAt).getTime() > 24 * 3600 * 1000));

/* ───────────── downloads ───────────── */

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One CSV cell. Text that starts like a spreadsheet formula is neutralised (CSV injection). */
function cell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s-]+$/.test(s)) s = `'${s}`; // plain phone numbers are fine
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ticketsToCsv(list: AdminTicket[]): string {
  const head = ['id', 'kind', 'status', 'name', 'phone', 'email', 'appointment', 'quote_ugx', 'deposit_ugx', 'payments', 'created', 'details'];
  const rows = list.map((t) => [
    t.id, t.kind, t.status, t.name, t.phone, t.email, t.slot ? `${t.slot.date} ${t.slot.time}` : '', t.quoteUGX ?? '', t.depositUGX ?? '',
    t.payments.map((p) => `${p.network}:${p.status}`).join(' | '), t.createdAt, t.details.replace(/\s+/g, ' '),
  ]);
  return '\uFEFF' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n'); // BOM so Excel reads UTF-8
}

/* ───────────── live request list (polls while the tab is visible) ───────────── */

export function useAdminTickets(enabled: boolean, onAuthLost: () => void) {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string[]>([]); // arrived since you opened the dashboard
  const known = useRef<Set<string> | null>(null);

  const reload = useCallback(
    async (silent = false) => {
      try {
        const d = await api<{ tickets: AdminTicket[] }>('tickets');
        if (known.current) {
          const seen = known.current;
          const added = d.tickets.filter((t) => !seen.has(t.id)).map((t) => t.id);
          if (added.length) setFresh((f) => [...new Set([...f, ...added])]);
        }
        known.current = new Set(d.tickets.map((t) => t.id));
        setTickets(d.tickets);
        setError(null);
      } catch (e: any) {
        if (e.status === 401) onAuthLost();
        else if (!silent) setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [onAuthLost]
  );

  useEffect(() => {
    if (!enabled) return;
    reload();
    const tick = setInterval(() => document.visibilityState === 'visible' && reload(true), 45_000);
    const onVisible = () => document.visibilityState === 'visible' && reload(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, reload]);

  return { tickets, setTickets, loading, error, reload, fresh, clearFresh: () => setFresh([]) };
}

/* ───────────── printable job card (for the repair bench) ───────────── */

const h = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function printJobCard(t: AdminTicket) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return false; // pop-up blocked
  w.opener = null; // the card is our own page, but it never needs a handle back to the admin
  const money = (n?: number) => (n || n === 0 ? `UGX ${n.toLocaleString('en-UG')}` : '—');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Job card ${h(t.id)}</title>
<style>body{font:14px system-ui,sans-serif;margin:32px;color:#111}h1{font:700 22px monospace;margin:0 0 4px}.m{color:#555;font-size:12px}
table{border-collapse:collapse;width:100%;margin-top:16px}td{border:1px solid #bbb;padding:8px;vertical-align:top}td:first-child{width:140px;background:#f3f3f3;font:600 12px monospace}
.box{border:1px solid #bbb;min-height:120px;margin-top:16px;padding:8px}@media print{button{display:none}}</style></head><body>
<h1>JOB CARD · ${h(t.id)}</h1><div class="m">${h(t.kind.toUpperCase())} · received ${h(new Date(t.createdAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala' }))}</div>
<table>
<tr><td>CUSTOMER</td><td>${h(t.name)}</td></tr><tr><td>PHONE</td><td>${h(t.phone || '—')}</td></tr><tr><td>EMAIL</td><td>${h(t.email || '—')}</td></tr>
<tr><td>VISIT</td><td>${t.slot ? h(`${t.slot.date} at ${t.slot.time}`) : '—'}</td></tr><tr><td>STATUS</td><td>${h(t.status)}</td></tr>
<tr><td>QUOTE</td><td>${money(t.quoteUGX)}</td></tr><tr><td>DEPOSIT</td><td>${money(t.depositUGX)}</td></tr>
<tr><td>PROBLEM / DETAILS</td><td style="white-space:pre-wrap">${h(t.details)}</td></tr>
</table>
<div class="box"><strong class="m">TECHNICIAN NOTES</strong></div>
<p class="m">Customer signature: ______________________ &nbsp;&nbsp; Date: ______________</p>
<button onclick="print()">Print</button><script>addEventListener('load',()=>setTimeout(()=>print(),250))</script></body></html>`);
  w.document.close();
  return true;
}
