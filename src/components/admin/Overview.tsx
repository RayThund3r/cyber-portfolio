// src/components/admin/Overview.tsx — the dashboard's landing tab: what needs you right now.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { STATUS_FLOW, STATUS_LABEL, formatUGX } from '@/lib/shared';
import { api, hasPaymentToCheck, isOpenTicket, kampalaDay, needsAttention, timeAgo, type AdminTicket, type Stats } from './adminKit';

/** Tiny dependency-free bar chart. */
function Bars({ data, label, tone = 'text-cyan-400' }: { data: { label: string; value: number }[]; label: string; tone?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 280, H = 64, gap = 4;
  const bw = (W - gap * (data.length - 1)) / data.length;
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className={`w-full ${tone}`} role="img" aria-label={`${label}: ${total} in total over ${data.length} days`}>
      {data.map((d, i) => {
        const h = Math.max(d.value ? 3 : 1, (d.value / max) * H);
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${d.value}`}</title>
            <rect x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={2} fill="currentColor" opacity={d.value ? 0.9 : 0.18} />
          </g>
        );
      })}
      <text x="0" y={H + 11} fontSize="8" fill="#71717a">{data[0]?.label.slice(5)}</text>
      <text x={W} y={H + 11} fontSize="8" fill="#71717a" textAnchor="end">{data[data.length - 1]?.label.slice(5)}</text>
    </svg>
  );
}

const Card = ({ title, value, hint, tone = 'text-zinc-100', onClick }: { title: string; value: string | number; hint?: string; tone?: string; onClick?: () => void }) => (
  <button type="button" onClick={onClick} disabled={!onClick} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-left transition-colors enabled:hover:border-zinc-600 disabled:cursor-default">
    <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{title}</div>
    <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
    {hint && <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div>}
  </button>
);

export default function Overview({ tickets, loading, onOpenTicket, goTab }: { tickets: AdminTicket[]; loading: boolean; onOpenTicket: (id: string) => void; goTab: (t: 'tickets' | 'insights' | 'data') => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  // Days since the last backup downloaded from this browser (null = never).
  const [backupAge, setBackupAge] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    try { const t = Number(localStorage.getItem('sys_admin_last_backup')); setBackupAge(t ? Math.floor((Date.now() - t) / 86400000) : null); } catch { setBackupAge(undefined); }
  }, []);
  useEffect(() => { api<Stats>('stats').then(setStats).catch(() => undefined); }, []);

  const d = useMemo(() => {
    const today = kampalaDay();
    const open = tickets.filter(isOpenTicket);
    const attention = tickets.filter(needsAttention);
    const visits = tickets
      .filter((t) => t.slot && t.status !== 'CANCELLED' && t.slot.date >= today)
      .sort((a, b) => `${a.slot!.date} ${a.slot!.time}`.localeCompare(`${b.slot!.date} ${b.slot!.time}`));
    const byDay = new Map<string, AdminTicket[]>();
    visits.slice(0, 14).forEach((t) => byDay.set(t.slot!.date, [...(byDay.get(t.slot!.date) || []), t]));
    const quoted = open.reduce((a, t) => a + (t.quoteUGX || 0), 0);
    const collected = tickets.reduce((a, t) => {
      const ok = t.payments.filter((p) => p.status === 'CONFIRMED');
      if (!ok.length) return a;
      const sum = ok.reduce((x, p) => x + (p.amountUGX || 0), 0);
      return a + (sum || t.depositUGX || 0);
    }, 0);
    // requests per day, last 14 days (shop time zone)
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) days.push(kampalaDay(new Date(Date.now() - i * 86400000)));
    const perDay = days.map((day) => ({ label: day, value: tickets.filter((t) => kampalaDay(t.createdAt) === day).length }));
    const counts: Record<string, number> = {};
    for (const s of [...STATUS_FLOW, 'CANCELLED']) counts[s] = tickets.filter((t) => t.status === s).length;
    return { today, open, attention, visits, byDay, quoted, collected, perDay, counts, todayVisits: visits.filter((t) => t.slot!.date === today).length };
  }, [tickets]);

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;

  return (
    <section className="space-y-6">
      {tickets.length > 0 && (backupAge === null || (typeof backupAge === 'number' && backupAge >= 7)) && (
        <button type="button" onClick={() => goTab('data')} className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-300">
          💾 {backupAge === null ? 'You have not downloaded a backup yet.' : `Your last backup was ${backupAge} days ago.`} Tap to back up your requests and portfolio.
        </button>
      )}
      <div className="ios-stagger grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card title="Open requests" value={d.open.length} hint={`${tickets.length} in total`} onClick={() => goTab('tickets')} />
        <Card title="Need attention" value={d.attention.length} tone={d.attention.length ? 'text-amber-400' : 'text-emerald-400'} hint={d.attention.length ? 'see the list below' : 'all caught up'} />
        <Card title="Visits today" value={d.todayVisits} hint={`${d.visits.length} upcoming`} />
        <Card title="Quoted (open)" value={formatUGX(d.quoted)} hint="not yet completed" />
        <Card title="Payments confirmed" value={formatUGX(d.collected)} hint="from confirmed deposits" tone="text-emerald-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="font-mono text-xs text-cyan-400">NEEDS ATTENTION</h2>
          {d.attention.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">Nothing is waiting on you. 🎉</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {d.attention.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => onOpenTicket(t.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-sm transition-colors hover:border-zinc-600">
                    <span className="min-w-0 truncate"><span className="font-mono text-xs text-cyan-400">{t.id}</span> <strong className="ml-1">{t.name}</strong></span>
                    <span className="flex-shrink-0 text-xs text-amber-400">{hasPaymentToCheck(t) ? '💰 verify payment' : `⏰ waiting ${timeAgo(t.createdAt).replace(' ago', '')}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="font-mono text-xs text-cyan-400">UPCOMING VISITS</h2>
          {d.byDay.size === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No visits booked.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {[...d.byDay.entries()].slice(0, 5).map(([day, list]) => (
                <div key={day}>
                  <div className="font-mono text-[11px] text-zinc-400">{day === d.today ? `TODAY · ${day}` : new Date(`${day}T12:00:00`).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                  <ul className="mt-1 space-y-1">
                    {list.map((t) => (
                      <li key={t.id}>
                        <button type="button" onClick={() => onOpenTicket(t.id)} className="flex w-full items-center gap-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-left text-sm hover:border-zinc-600">
                          <span className="font-mono text-xs text-emerald-400">{t.slot!.time}</span>
                          <span className="truncate">{t.name}</span>
                          <span className="ml-auto flex-shrink-0 text-[11px] text-zinc-500">{t.kind}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 font-mono text-xs text-cyan-400">NEW REQUESTS · LAST 14 DAYS</h2>
          <Bars data={d.perDay} label="New requests per day" />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-xs text-cyan-400">SITE VIEWS · LAST 14 DAYS</h2>
            <button type="button" onClick={() => goTab('insights')} className="font-mono text-[11px] text-zinc-400 hover:text-zinc-200">more →</button>
          </div>
          {stats && stats.daily.length > 0 ? <Bars data={stats.daily.map((x) => ({ label: x.day, value: x.views }))} label="Site views per day" tone="text-emerald-400" /> : <p className="text-sm text-zinc-400">No visits recorded yet.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 font-mono text-xs text-cyan-400">PIPELINE</h2>
        <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800" role="img" aria-label="Requests by status">
          {Object.entries(d.counts).filter(([, n]) => n > 0).map(([s, n], i) => (
            <div key={s} title={`${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}: ${n}`} style={{ width: `${(n / Math.max(1, tickets.length)) * 100}%`, opacity: 1 - i * 0.11 }} className={s === 'CANCELLED' ? 'bg-zinc-500' : s === 'COMPLETED' ? 'bg-emerald-500' : 'bg-cyan-500'} />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          {Object.entries(d.counts).map(([s, n]) => (
            <li key={s}>{STATUS_LABEL[s as keyof typeof STATUS_LABEL]} <strong className="text-zinc-200">{n}</strong></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
