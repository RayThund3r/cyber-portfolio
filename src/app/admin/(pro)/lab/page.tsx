// src/app/admin/lab/page.tsx — the fun and unexpected: a live radar of your site, site vitality score, report generator,
// link builder with referral tracking, busiest-hours advisor and a keyboard cheat-sheet with a hidden surprise.
'use client';
import { useMemo, useState } from 'react';
import { useApi } from '@/lib/admin/client';
import { busyWindows, digest, groupQuestions, vitality, weeklyReportMarkdown } from '@/lib/admin/derive';
import type { Stats } from '@/lib/admin/stats';
import type { DeskSummary } from '@/lib/admin/desk';
import type { LiveEvent } from '@/lib/admin/track';
import { ROUTES } from '@/lib/siteMap';
import { AButton, Badge, Card, CopyBtn, Field, inputCls, PageHead, Skel, Toggle } from '@/components/admin/ui';
import { NAV } from '@/components/admin/AdminShell';
import Pulse from '@/components/admin/Pulse';

const KEYS: Array<[string, string]> = [['Ctrl/Cmd + K  or  /', 'Command palette'], ['g then d o a c s h e b t l', 'Jump: desk overview analytics chat site health security board shell lab'], ['Ctrl + L (in Shell)', 'Clear the screen'], ['↑ ↑ ↓ ↓ ← → ← → B A', 'Something you should see once']];

export default function LabPage() {
  const stats = useApi<Stats>('/api/admin/stats?days=14');
  const live = useApi<{ events: LiveEvent[]; activeNow: number }>('/api/admin/live', { every: 5000 });
  const desk = useApi<DeskSummary>('/api/admin/desk');
  const chat = useApi<{ questions: Array<{ t: number; q: string; src: string; gap: boolean }> }>('/api/admin/chat');
  const [demo, setDemo] = useState(false);
  const [path, setPath] = useState('/');
  const [ref, setRef] = useState('newsletter');
  const [base, setBase] = useState('');
  const s = stats.data;
  const unread = desk.data?.fresh ?? 0;
  const gaps = useMemo(() => groupQuestions(chat.data?.questions || []).gaps, [chat.data]);
  const vit = useMemo(() => (s ? vitality(s, unread, gaps.length) : null), [s, unread, gaps.length]);
  const lines = useMemo(() => (s ? digest(s, { unread, gaps: gaps.length }) : []), [s, unread, gaps.length]);
  const md = useMemo(() => (s ? weeklyReportMarkdown(s, lines, gaps) : ''), [s, lines, gaps]);
  const windows = useMemo(() => (s ? busyWindows(s.hours) : []), [s]);
  const origin = base || (typeof location !== 'undefined' ? location.origin : '');
  const link = `${origin}${path}${path.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'link')}`;
  const save = (name: string, text: string, type: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const printable = () => { const w = window.open('', '_blank'); if (!w) return; const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); w.document.write(`<!doctype html><title>Site report</title><body style="font:14px/1.5 system-ui;max-width:42rem;margin:2rem auto;padding:0 1rem"><pre style="white-space:pre-wrap;font:13px/1.55 ui-monospace,monospace">${esc(md)}</pre><script>window.onload=()=>setTimeout(()=>print(),200)<\/script>`); w.document.close(); };

  return (
    <>
      <PageHead title="Lab" sub="The unexpected corner: things you did not ask for but might like." icon="spark" />
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <Card title="Pulse" icon="bolt" right={<Badge tone="ok">{live.data ? `${live.data.activeNow} active` : '…'}</Badge>}>
            <div className="flex justify-center"><Pulse events={live.data?.events || []} demo={demo} /></div>
            <div className="mt-3"><Toggle checked={demo} onChange={setDemo} label="Demo mode" hint="Makes up activity so you can see it move on a quiet day." /></div>
            <p className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-zinc-500"><span className="text-cyan-300">visit</span><span className="text-violet-300">chat</span><span className="text-amber-300">stumped</span><span className="text-emerald-300">game</span></p>
          </Card>
          <div className="space-y-4">
            <Card title="Site vitality" icon="heart">
              {!vit ? <Skel h="h-32" /> : (
                <div className="flex flex-wrap items-center gap-5"><div className="relative flex h-28 w-28 shrink-0 items-center justify-center" role="img" aria-label={`Vitality ${vit.score} out of 100`}><svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90"><circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" strokeWidth="9" /><circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(vit.score / 100) * 264} 264`} /></svg><span className="font-mono text-3xl font-bold text-zinc-100">{vit.score}</span></div>
                  <ul className="min-w-0 flex-1 space-y-2">{vit.parts.map((p) => <li key={p.label}><div className="flex justify-between font-mono text-[11px]"><span className="text-zinc-300">{p.label}</span><span className="text-zinc-500">{p.pts}/{p.max}</span></div><div className="mt-0.5 h-1.5 overflow-hidden rounded bg-zinc-800"><div className="h-full bg-accent" style={{ width: `${(p.pts / p.max) * 100}%` }} /></div><div className="text-[10px] text-zinc-600">{p.note}</div></li>)}</ul></div>)}
            </Card>
            <Card title="Be reachable when it counts" icon="clock">
              {windows.length ? <><p className="text-sm text-zinc-300">Your visitors are most active around:</p><ul className="mt-2 space-y-1 font-mono text-xs text-accent">{windows.map((w) => <li key={w}>{w}</li>)}</ul><p className="mt-2 text-[11px] text-zinc-500">Reply to messages and post updates in these windows. Times are UTC; East Africa is UTC+3.</p></> : <p className="text-sm text-zinc-500">Needs a little more traffic to tell.</p>}
            </Card>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Link builder with tracking" icon="globe">
            <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Page"><select value={path} onChange={(e) => setPath(e.target.value)} className={inputCls}>{ROUTES.map((r) => <option key={r.path} value={r.path}>{r.title} ({r.path})</option>)}</select></Field><Field label="Where will you share it?" hint="Shows up as the referrer in Analytics"><input value={ref} onChange={(e) => setRef(e.target.value)} className={inputCls} placeholder="whatsapp-status" /></Field></div>
              <Field label="Site address (optional)"><input value={base} onChange={(e) => setBase(e.target.value.replace(/\/+$/, ''))} className={inputCls} placeholder={origin} /></Field>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs break-all text-emerald-200">{link}</div><CopyBtn text={link} label="Copy link" /><p className="text-[11px] text-zinc-500">Put this link in a WhatsApp status, flyer QR code, business card or email signature. Visits then appear under that name, so you learn which channel actually brings people.</p></div>
          </Card>
          <Card title="Report generator" icon="disk">
            {!s ? <Skel h="h-32" /> : <div className="space-y-3"><p className="text-sm text-zinc-400">A tidy summary of the last 14 days for yourself, a client or a partner. No personal data inside.</p><div className="flex flex-wrap gap-2"><CopyBtn text={md} label="Copy Markdown" small={false} /><AButton icon="disk" onClick={() => save(`site-report-${s.days[s.days.length - 1]?.date}.md`, md, 'text/markdown')}>Download .md</AButton><AButton icon="arrow" onClick={printable}>Print / PDF</AButton></div><pre className="max-h-52 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] whitespace-pre-wrap text-zinc-400">{md}</pre></div>}
          </Card>
        </div>
        <Card title="Shortcuts and secrets" icon="key">
          <ul className="grid gap-2 sm:grid-cols-2">{KEYS.map(([k, d]) => <li key={k} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs"><kbd className="shrink-0 rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-accent">{k}</kbd><span className="text-zinc-400">{d}</span></li>)}</ul>
          <p className="mt-3 text-[11px] text-zinc-600">Pages: {NAV.map((n) => n.label).join(' · ')}.</p>
        </Card>
      </div>
    </>
  );
}
