// src/components/admin/InsightsPanel.tsx — the activity log: visits, unanswered chat questions, sign-ins, errors.
'use client';

import { useEffect, useState } from 'react';
import { STATUS_LABEL, type TicketStatus } from '@/lib/shared';
import { api, type Stats } from './adminKit';
import { AButton, AreaChart, Bars, Card, Empty, ErrorBox, Skel } from './ui';

const when = (iso: string) => new Date(iso).toLocaleString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' });
const toBars = (o: Record<string, number>, label: (k: string) => string = (k) => k, n = 8) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ name: label(k), n: v }));

export default function InsightsPanel() {
  const [s, setS] = useState<Stats | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<Stats>('stats').then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <ErrorBox text={err} />;
  if (!s) return <div className="space-y-4"><Skel h="h-56" /><div className="grid gap-4 sm:grid-cols-2"><Skel h="h-48" /><Skel h="h-48" /></div></div>;
  const total = s.daily.reduce((a, d) => a + d.views, 0);

  return (
    <section className="space-y-5">
      <Card title="Page views · last 14 days" icon="spark" right={<span className="font-mono text-[11px] text-zinc-500">{total.toLocaleString()} total</span>}>
        {s.daily.length > 1 ? <AreaChart labels={s.daily.map((d) => d.day)} a={s.daily.map((d) => d.views)} aName="Views" height={200} /> : <Empty icon="spark" title="No data yet" text="Visits are counted as people open your pages." />}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Top pages" icon="grid"><Bars items={toBars(s.pages)} empty="No page views yet" /></Card>
        <Card title="Actions people took" icon="bolt"><Bars items={toBars(s.events)} empty="No actions recorded yet" /></Card>
        <Card title="Requests by status" icon="layout"><Bars items={toBars(s.byStatus, (k) => STATUS_LABEL[k as TicketStatus] || k, 10)} empty="No requests yet" /></Card>
        <Card title="Questions the chat couldn't answer" icon="chat" right={<span className="text-[11px] text-zinc-500">add these to the knowledge base</span>}>
          {s.unanswered.length ? <Bars items={s.unanswered.slice(0, 8).map((u) => ({ name: u.q, n: u.n }))} unit="×" /> : <Empty icon="check" title="Nothing missed" text="Every question so far was answered." />}
        </Card>
      </div>

      <Card title="Recent admin activity" icon="shield"
        right={<div className="flex gap-1.5">
          <AButton small onClick={async () => { if (confirm('Sign out every device, including this one?')) { await api('logoutAll'); location.reload(); } }}>Sign out everywhere</AButton>
          <AButton small danger onClick={async () => { if (confirm('Clear the sign-in log? One entry will remain saying it was cleared.')) { await api('clearAudit'); location.reload(); } }}>Clear log</AButton>
        </div>} pad={false}>
        {s.audit?.length ? (
          <ul className="divide-y divide-zinc-800/70">
            {s.audit.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-xs">
                <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold ${a.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{a.ok ? 'OK' : '!'}</span>
                <span className="font-medium text-zinc-200">{a.event}</span>
                <span className="ml-auto font-mono text-zinc-500">{a.ip} · {when(a.at)}</span>
                {a.ua && <span className="w-full truncate pl-8 text-[10px] text-zinc-600">{a.ua}</span>}
              </li>
            ))}
          </ul>
        ) : <Empty icon="shield" title="No activity recorded" />}
      </Card>

      <Card title="Errors" icon="bell" pad={false}>
        {s.errors.length ? (
          <ul className="divide-y divide-zinc-800/70">
            {s.errors.map((e, i) => (
              <li key={i} className="px-4 py-3"><div className="text-sm text-rose-300">{e.msg}</div><div className="mt-0.5 font-mono text-[11px] text-zinc-500">{e.where} · ×{e.n} · last {when(e.last)}</div></li>
            ))}
          </ul>
        ) : <Empty icon="check" title="No errors recorded" text="Good news: nothing has broken." />}
      </Card>
    </section>
  );
}
