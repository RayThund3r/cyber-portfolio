// src/app/admin/page.tsx — Overview: KPIs, traffic chart, live radar, "needs attention", anomalies and a plain-language digest.
'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { fmtNum, pct, relTime, useApi } from '@/lib/admin/client';
import type { Stats } from '@/lib/admin/stats';
import type { DeskSummary } from '@/lib/admin/desk';
import type { LiveEvent } from '@/lib/admin/track';
import { digest, findAnomalies, groupQuestions } from '@/lib/admin/derive';
import { AreaChart, Badge, Card, CopyBtn, ErrorBox, Notice, PageHead, Skel, Stat, Tabs } from '@/components/admin/ui';
import { useAdmin } from '@/components/admin/AdminShell';

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

export function EventLine({ e }: { e: LiveEvent }) {
  const label = e.k === 'pv' ? `viewed ${e.p}` : e.k === 'chat' ? `asked the assistant: “${e.x}”` : e.k === 'gap' ? `stumped the assistant: “${e.x}”` : e.k === 'game' ? `finished a game (${e.x})` : e.k;
  const tone = e.k === 'gap' ? 'text-amber-300' : e.k === 'chat' ? 'text-accent' : e.k === 'game' ? 'text-violet-300' : 'text-zinc-300';
  return <li className="flex items-baseline gap-2 py-1 font-mono text-[11px]"><span className="w-12 shrink-0 text-zinc-600">{new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className={`min-w-0 flex-1 truncate ${tone}`}>{label}</span><span className="shrink-0 text-zinc-600">{e.c || ''} {e.d === 'mobile' ? 'phone' : e.d || ''}</span></li>;
}

export default function Overview() {
  const { me } = useAdmin();
  const [range, setRange] = useState<'7' | '14' | '30'>('14');
  const stats = useApi<Stats>(`/api/admin/stats?days=${range}`, { every: 60000 });
  const live = useApi<{ events: LiveEvent[]; activeNow: number; uniqueToday: number; now: number }>('/api/admin/live', { every: 6000 });
  const desk = useApi<DeskSummary>('/api/admin/desk?limit=5', { every: 60000 });
  const chat = useApi<{ questions: Array<{ t: number; q: string; src: string; gap: boolean }> }>('/api/admin/chat');
  const s = stats.data;
  const unread = desk.data?.fresh ?? 0;
  const gaps = useMemo(() => groupQuestions(chat.data?.questions || []).gaps, [chat.data]);
  const anomalies = useMemo(() => (s ? findAnomalies(s.days) : []), [s]);
  const lines = useMemo(() => (s ? digest(s, { unread, gaps: gaps.length }) : []), [s, unread, gaps.length]);
  const attention: Array<{ href: string; icon: 'bell' | 'brain' | 'bolt' | 'shield'; text: string; tone: 'warn' | 'bad' | 'accent' }> = [];
  if (unread) attention.push({ href: '/admin', icon: 'bell', text: `${unread} new request${unread === 1 ? '' : 's'} waiting`, tone: 'accent' });
  if (gaps.length) attention.push({ href: '/admin/chat', icon: 'brain', text: `${gaps.length} question${gaps.length === 1 ? '' : 's'} the assistant could not answer`, tone: 'warn' });
  if (me?.store === 'memory') attention.push({ href: '/admin/health', icon: 'bolt', text: 'Storage is temporary: connect free Upstash to keep data', tone: 'warn' });
  if (me && !me.totp) attention.push({ href: '/admin/security', icon: 'shield', text: 'Two-factor sign-in is not enabled', tone: 'warn' });

  return (
    <>
      <PageHead title={`${greet()}.`} sub={me?.store === 'memory' ? 'Showing what this server has seen since it last started.' : 'Everything that happened on your site, in one place.'} icon="home"
        right={<Tabs value={range} onChange={setRange} items={[{ id: '7', label: '7 days' }, { id: '14', label: '14 days' }, { id: '30', label: '30 days' }]} />} />
      {stats.error && <ErrorBox text={stats.error} retry={stats.reload} />}
      {!s && !stats.error && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Skel /><Skel /><Skel /><Skel /></div>}
      {s && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Visitors" icon="globe" value={fmtNum(s.totals.uv)} delta={pct(s.totals.uv, s.prev.uv)} spark={s.days.map((d) => d.uv)} hint="unique, privacy-safe" />
            <Stat label="Page views" icon="grid" value={fmtNum(s.totals.pv)} delta={pct(s.totals.pv, s.prev.pv)} spark={s.days.map((d) => d.pv)} />
            <Stat label="Chat questions" icon="chat" value={fmtNum(s.totals.chat)} delta={pct(s.totals.chat, s.prev.chat)} spark={s.days.map((d) => d.chat)} hint={s.totals.gap ? `${s.totals.gap} unanswered` : 'all answered'} />
            <Stat label="Requests" icon="bell" value={fmtNum(s.totals.msgs)} hint={unread ? `${unread} new` : 'desk clear'} spark={s.days.map((d) => d.msgs)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Traffic" icon="grid" className="lg:col-span-2"><AreaChart labels={s.days.map((d) => d.date)} a={s.days.map((d) => d.pv)} aName="Views" b={s.days.map((d) => d.uv)} bName="Visitors" /></Card>
            <Card title="Live radar" icon="bolt" right={<Badge tone="ok">{live.data ? `${live.data.activeNow} active · 5 min` : '…'}</Badge>}>
              {!live.data ? <Skel h="h-40" /> : live.data.events.length === 0 ? <p className="py-8 text-center text-xs text-zinc-600">Quiet right now. Visits and chat questions will appear here as they happen.</p> : (
                <ul className="max-h-56 divide-y divide-zinc-800/60 overflow-y-auto" aria-live="polite">{live.data.events.slice(0, 14).map((e, i) => <EventLine key={e.t + ':' + i} e={e} />)}</ul>)}
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-zinc-600"><span>{live.data ? `${live.data.uniqueToday} visitors today (UTC)` : ''}</span><Link href="/admin/lab" className="hover:text-accent">open the Pulse →</Link></div>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Needs attention" icon="bell">
              {attention.length === 0 ? <p className="flex items-center gap-2 py-4 text-sm text-emerald-300"><Icon name="check" size={16} />Nothing needs you right now.</p> : (
                <ul className="space-y-2">{attention.map((a) => <li key={a.text}><Link href={a.href} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 transition hover:border-accent/50"><Icon name={a.icon} size={15} className={a.tone === 'warn' ? 'text-amber-300' : 'text-accent'} /><span className="flex-1">{a.text}</span><Icon name="arrow" size={13} className="text-zinc-600" /></Link></li>)}</ul>)}
            </Card>
            <Card title="Unusual days" icon="spark">
              {anomalies.length === 0 ? <p className="py-4 text-sm text-zinc-500">No spikes. {s.days.length < 7 ? 'Needs at least a week of data.' : 'Traffic looks normal for the period.'}</p> : (
                <ul className="space-y-2">{anomalies.map((a) => <li key={a.date + a.metric} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">{a.text}</li>)}</ul>)}
            </Card>
            <Card title="Digest" icon="lightbulb" right={<CopyBtn text={lines.join('\n')} label="Copy" />}>
              <ul className="space-y-2 text-sm leading-relaxed text-zinc-300">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </Card>
          </div>
          {s.mode === 'memory' && <Notice tone="warn" title="Numbers reset when the server restarts">You have no database connected. On Vercel each serverless instance keeps its own short-lived memory, so figures can look smaller than reality. A free Upstash Redis database (Vercel → Storage) makes everything permanent and takes about two minutes. The panel works either way.</Notice>}
        </div>
      )}
    </>
  );
}
