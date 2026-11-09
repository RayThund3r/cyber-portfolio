// src/app/admin/analytics/page.tsx
'use client';
import { useState } from 'react';
import { fmtNum, useApi } from '@/lib/admin/client';
import type { Stats } from '@/lib/admin/stats';
import { AButton, AreaChart, Bars, Card, Donut, ErrorBox, HourBars, PageHead, Skel, Tabs } from '@/components/admin/ui';

const csv = (s: Stats) => ['date,views,visitors,chat,unanswered,games,messages', ...s.days.map((d) => [d.date, d.pv, d.uv, d.chat, d.gap, d.games, d.msgs].join(','))].join('\n');
function download(name: string, text: string, type = 'text/csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

export default function Analytics() {
  const [range, setRange] = useState<'7' | '14' | '30' | '90'>('30');
  const { data: s, error, reload } = useApi<Stats>(`/api/admin/stats?days=${range}`, { every: 120000 });
  return (
    <>
      <PageHead title="Analytics" sub="First-party and cookie-free. No personal data or raw IP addresses are stored." icon="grid"
        right={<div className="flex flex-wrap items-center gap-2"><Tabs value={range} onChange={setRange} items={[{ id: '7', label: '7d' }, { id: '14', label: '14d' }, { id: '30', label: '30d' }, { id: '90', label: '90d' }]} />{s && <AButton icon="disk" small onClick={() => download(`analytics-${range}d.csv`, csv(s))}>CSV</AButton>}</div>} />
      {error && <ErrorBox text={error} retry={reload} />}
      {!s && !error && <div className="grid gap-4 md:grid-cols-2"><Skel h="h-56" /><Skel h="h-56" /></div>}
      {s && (
        <div className="space-y-4">
          <Card title="Views and visitors" icon="grid"><AreaChart labels={s.days.map((d) => d.date)} a={s.days.map((d) => d.pv)} aName="Views" b={s.days.map((d) => d.uv)} bName="Visitors" height={210} /></Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Top pages" icon="home"><Bars items={s.paths} empty="No page views yet" /></Card>
            <Card title="Where visitors come from" icon="globe"><Bars items={s.refs} empty="No referrers yet. Add ?ref=name to a link (Lab → Link builder) to see it here." /></Card>
            <Card title="Devices" icon="phone"><Donut items={s.devices} label="Devices" /></Card>
            <Card title="Browsers" icon="search"><Donut items={s.browsers} label="Browsers" /></Card>
            <Card title="Operating systems" icon="cpu"><Donut items={s.os} label="Operating systems" /></Card>
            <Card title="Countries" icon="globe"><Bars items={s.countries} empty="Country data appears once the site is on Vercel" /></Card>
            <Card title="Busiest hours (UTC)" icon="clock"><HourBars hours={s.hours} /></Card>
            <Card title="Page speed (real visitors)" icon="bolt">
              {s.speed.length === 0 ? <p className="py-6 text-center text-xs text-zinc-600">No timing samples yet.</p> : <ul className="space-y-1.5 font-mono text-xs">{s.speed.map((p) => <li key={p.path} className="flex items-center justify-between gap-3"><span className="truncate text-zinc-300">{p.path}</span><span className={p.avgMs > 2500 ? 'text-rose-300' : p.avgMs > 1200 ? 'text-amber-300' : 'text-emerald-300'}>{fmtNum(p.avgMs)} ms <span className="text-zinc-600">· {p.n}</span></span></li>)}</ul>}
            </Card>
          </div>
          <Card title="Day by day" icon="clock" pad={false}>
            <div className="max-h-80 overflow-auto"><table className="w-full min-w-[34rem] border-collapse font-mono text-xs"><thead className="sticky top-0 bg-zinc-900 text-left text-zinc-500"><tr>{['Date', 'Views', 'Visitors', 'Chat', 'Unanswered', 'Games', 'Messages'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{[...s.days].reverse().map((d) => <tr key={d.date} className="border-t border-zinc-800/70 text-zinc-300"><td className="px-3 py-1.5 text-zinc-400">{d.date}</td><td className="px-3 py-1.5">{d.pv}</td><td className="px-3 py-1.5">{d.uv}</td><td className="px-3 py-1.5">{d.chat}</td><td className="px-3 py-1.5">{d.gap}</td><td className="px-3 py-1.5">{d.games}</td><td className="px-3 py-1.5">{d.msgs}</td></tr>)}</tbody></table></div>
          </Card>
          <Card title="Game hall of fame (all visitors)" icon="trophy">
            {s.games.length === 0 ? <p className="py-6 text-center text-xs text-zinc-600">No finished games yet.</p> : <ul className="space-y-1.5">{s.games.map((g) => <li key={g.id} className="flex items-center justify-between gap-3 rounded-md bg-zinc-900/60 px-3 py-1.5 font-mono text-xs"><span className="text-zinc-200">{g.id}</span><span className="text-zinc-400">{g.plays} played <span className="text-emerald-300">· {g.w} W</span> <span className="text-rose-300">· {g.l} L</span> <span className="text-amber-300">· {g.d} D</span></span></li>)}</ul>}
          </Card>
        </div>
      )}
    </>
  );
}
