// src/components/admin/Overview.tsx — the dashboard's landing tab: what needs you right now, and how things are going.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { STATUS_FLOW, STATUS_LABEL, formatUGX } from '@/lib/shared';
import { api, hasPaymentToCheck, isOpenTicket, kampalaDay, needsAttention, timeAgo, type AdminTicket, type Stats } from './adminKit';
import { AButton, AreaChart, Avatar, Banner, Card, Empty, KindBadge, ListRow, Priv, STATUS_STYLE, Skel, Stat, StatusPill, Tabs, compactUGX } from './ui';

type Goto = 'tickets' | 'insights' | 'data' | 'customers';

const pct = (cur: number, prev: number): number | null => (prev === 0 ? (cur === 0 ? 0 : null) : Math.round(((cur - prev) / prev) * 100));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export default function Overview({ tickets, loading, onOpenTicket, goTab, storageNote }: { tickets: AdminTicket[]; loading: boolean; onOpenTicket: (id: string) => void; goTab: (t: Goto) => void; storageNote?: string | null }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<'requests' | 'views'>('requests');
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
    const quoted = open.reduce((a, t) => a + (t.quoteUGX || 0), 0);
    const collected = tickets.reduce((a, t) => {
      const ok = t.payments.filter((p) => p.status === 'CONFIRMED');
      if (!ok.length) return a;
      const total = ok.reduce((x, p) => x + (p.amountUGX || 0), 0);
      return a + (total || t.depositUGX || 0);
    }, 0);
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) days.push(kampalaDay(new Date(Date.now() - i * 86400000)));
    const perDay = days.map((day) => tickets.filter((t) => kampalaDay(t.createdAt) === day).length);
    const counts: Record<string, number> = {};
    for (const s of [...STATUS_FLOW, 'CANCELLED']) counts[s] = tickets.filter((t) => t.status === s).length;
    const recent = [...tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    return { today, open, attention, visits, quoted, collected, days, perDay, counts, recent, todayVisits: visits.filter((t) => t.slot!.date === today).length };
  }, [tickets]);

  const views = useMemo(() => (stats?.daily ?? []).map((x) => ({ label: x.day, value: x.views })), [stats]);
  const series = chart === 'requests' ? { labels: d.days, a: d.perDay } : { labels: views.map((v) => v.label), a: views.map((v) => v.value) };
  const half = Math.floor(series.a.length / 2);
  const trend = series.a.length >= 4 ? pct(sum(series.a.slice(half)), sum(series.a.slice(0, half))) : null;

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Skel h="h-28" /><Skel h="h-28" /><Skel h="h-28" /><Skel h="h-28" /></div>
        <div className="grid gap-5 lg:grid-cols-3"><div className="lg:col-span-2"><Skel h="h-64" /></div><Skel h="h-64" /></div>
      </div>
    );
  }

  const backupDue = tickets.length > 0 && (backupAge === null || (typeof backupAge === 'number' && backupAge >= 7));
  const total = Math.max(1, tickets.length);

  return (
    <section className="space-y-5">
      {(storageNote || backupDue) && (
        <div className="space-y-2">
          {storageNote && <Banner id="storage" tone="warn" icon="server" action="Fix it" onAction={() => { window.location.assign('/admin/launch'); }}><b className="font-semibold">Temporary storage.</b> Requests and sites can disappear when the server restarts.</Banner>}
          {backupDue && <Banner id="backup" tone="info" icon="save" action="Back up now" onAction={() => goTab('data')}>{backupAge === null ? 'You have not downloaded a backup yet.' : `Your last backup was ${backupAge} days ago.`}</Banner>}
        </div>
      )}

      <div className="ios-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open requests" value={d.open.length} icon="mail" hint={`${tickets.length} in total`} spark={d.perDay} onClick={() => goTab('tickets')} />
        <Stat label="Need attention" value={d.attention.length} icon="bell" tone={d.attention.length ? 'warn' : 'ok'} hint={d.attention.length ? 'waiting on you' : 'all caught up'} onClick={d.attention.length ? () => goTab('tickets') : undefined} />
        <Stat label="Visits today" value={d.todayVisits} icon="calendar" hint={`${d.visits.length} upcoming`} />
        <Stat label="Quoted · open" value={compactUGX(d.quoted)} icon="money" hint={`Collected ${compactUGX(d.collected)}`} tone="ok" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Activity · last 14 days" icon="spark"
          right={<Tabs value={chart} onChange={setChart} items={[{ id: 'requests', label: 'Requests' }, { id: 'views', label: 'Site views' }]} />}>
          {series.a.length > 1 ? (
            <>
              <div className="mb-3 flex items-end gap-3">
                <span className="text-3xl font-bold tabular-nums tracking-tight text-zinc-50">{sum(series.a).toLocaleString()}</span>
                <span className="pb-1 text-xs text-zinc-500">{chart === 'requests' ? 'new requests' : 'page views'}</span>
                {trend !== null && <span className={`mb-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${trend === 0 ? 'bg-zinc-800 text-zinc-400' : trend > 0 ? 'bg-emerald-500/12 text-emerald-300' : 'bg-rose-500/12 text-rose-300'}`}>{trend === 0 ? 'Same as the week before' : `${trend > 0 ? '▲' : '▼'} ${Math.abs(trend)}% vs the week before`}</span>}
              </div>
              <AreaChart labels={series.labels} a={series.a} aName={chart === 'requests' ? 'Requests' : 'Views'} height={190} />
            </>
          ) : (
            <Empty icon="spark" title={chart === 'requests' ? 'No requests yet' : 'No visits recorded yet'} text="The chart fills in as people use your site." />
          )}
        </Card>

        <Card title="Needs attention" icon="bell" right={d.attention.length > 0 ? <AButton small onClick={() => goTab('tickets')}>All</AButton> : undefined}>
          {d.attention.length === 0 ? (
            <Empty icon="check" title="You're all caught up" text="Nothing is waiting on you right now." />
          ) : (
            <ul className="space-y-2">
              {d.attention.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <ListRow tone="warn" onClick={() => onOpenTicket(t.id)} lead={<Avatar name={t.name} size={34} />} title={<Priv>{t.name}</Priv>}
                    sub={<span className="font-mono">{t.id}</span>}
                    right={hasPaymentToCheck(t)
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300"><Icon name="money" size={13} />Verify payment</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-amber-300"><Icon name="clock" size={13} />{timeAgo(t.createdAt).replace(' ago', '')}</span>} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Upcoming visits" icon="calendar">
          {d.visits.length === 0 ? (
            <Empty icon="calendar" title="No visits booked" text="Bookings from the repair form show up here." />
          ) : (
            <ul className="space-y-2">
              {d.visits.slice(0, 5).map((t) => {
                const isToday = t.slot!.date === d.today;
                const day = new Date(`${t.slot!.date}T12:00:00`);
                return (
                  <li key={t.id}>
                    <ListRow onClick={() => onOpenTicket(t.id)} title={<Priv>{t.name}</Priv>} sub={<>{isToday ? 'Today' : day.toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })} · {t.slot!.time}</>}
                      lead={<span className={`flex h-10 w-10 flex-none flex-col items-center justify-center rounded-xl leading-none ${isToday ? 'bg-accent/15 text-accent' : 'bg-zinc-800/80 text-zinc-300'}`}><span className="text-[9px] font-semibold uppercase">{day.toLocaleDateString('en-US', { month: 'short' })}</span><span className="text-base font-bold">{day.getDate()}</span></span>}
                      right={<KindBadge kind={t.kind} withLabel />} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Pipeline" icon="layout" right={<span className="font-mono text-[11px] text-zinc-500">{tickets.length} total</span>}>
          {tickets.length === 0 ? (
            <Empty icon="layout" title="Nothing in the pipeline" text="New requests move through these stages." />
          ) : (
            <>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-zinc-800" role="img" aria-label="Requests by status">
                {Object.entries(d.counts).filter(([, n]) => n > 0).map(([s, n]) => <div key={s} title={`${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}: ${n}`} style={{ width: `${(n / total) * 100}%` }} className={`adm-grow ${(STATUS_STYLE[s] ?? STATUS_STYLE.CANCELLED).bar} first:rounded-l-full last:rounded-r-full`} />)}
              </div>
              <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {Object.entries(d.counts).map(([s, n]) => (
                  <li key={s} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 flex-none rounded-full ${(STATUS_STYLE[s] ?? STATUS_STYLE.CANCELLED).dot}`} />
                    <span className="min-w-0 flex-1 truncate text-zinc-400">{STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</span>
                    <b className="tabular-nums text-zinc-100">{n}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card title="Latest requests" icon="mail" right={<AButton small onClick={() => goTab('tickets')} icon="arrow">View all</AButton>} pad={false}>
        {d.recent.length === 0 ? (
          <Empty icon="mail" title="No requests yet" text="When a customer sends a request, it appears here first." />
        ) : (
          <ul className="divide-y divide-zinc-800/70">
            {d.recent.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onOpenTicket(t.id)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-900/60">
                  <Avatar name={t.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate text-sm font-medium text-zinc-100"><Priv>{t.name}</Priv></span><KindBadge kind={t.kind} /></span>
                    <span className="block truncate text-xs text-zinc-500"><span className="font-mono">{t.id}</span> · <Priv>{t.details || 'No details'}</Priv></span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1"><StatusPill status={t.status} label={STATUS_LABEL[t.status]} /><span className="text-[11px] text-zinc-600">{timeAgo(t.createdAt)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-center text-[11px] text-zinc-600">Quoted {formatUGX(d.quoted)} · Collected {formatUGX(d.collected)} · Times are Kampala time</p>
    </section>
  );
}
