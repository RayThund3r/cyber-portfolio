// src/app/admin/chat/page.tsx — Chat Lab: what visitors ask, what the assistant missed, a live playground on the REAL engine, and a stress test.
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { relTime, useApi } from '@/lib/admin/client';
import { groupQuestions, kbSnippet } from '@/lib/admin/derive';
import type { Stats } from '@/lib/admin/stats';
import { processChatQuery } from '@/utils/chatEngine';
import type { PersonaMode, SessionMemory } from '@/utils/chatEngine/types';
import { AButton, Badge, Bars, Card, CopyBtn, Donut, Empty, ErrorBox, inputCls, Notice, PageHead, Skel, Tabs, useToast } from '@/components/admin/ui';

type Q = { t: number; q: string; src: string; gap: boolean };
const fresh = (): SessionMemory => ({ interactionCount: 0, lastTopic: 'GREETINGS', userContext: {}, conversationHistory: [] });

interface Turn { id: number; q: string; reply: string; source: string; ms: number; guided: boolean; gap: boolean; command?: string; trace?: string[]; suggestions?: string[]; cards?: number }
let turnId = 0;

/** Runs one query through the real engine and reports whether it fell through to the "I don't know" path. */
async function ask(q: string, mode: PersonaMode, memory: SessionMemory): Promise<{ turn: Turn; memory: SessionMemory }> {
  let gap = false;
  const onGap = () => { gap = true; };
  window.addEventListener('sys:gap', onGap);
  const t0 = performance.now();
  try {
    const r = await processChatQuery(q, mode, memory, { pathname: '/' });
    return { memory: r.updatedMemory, turn: { id: ++turnId, q, reply: r.reply, source: r.source, ms: Math.round(performance.now() - t0), guided: !!r.guided, gap, command: r.command?.label, trace: r.trace, suggestions: r.suggestions, cards: r.cards?.length } };
  } finally { window.removeEventListener('sys:gap', onGap); }
}

const SAMPLES = ['my phone will not charge', 'laptop overheating and loud fan', 'how much for a screen repair', 'how long does a repair take', 'do you do logo design', 'show me your projects', 'what is a VPN', 'ssd vs hdd', 'is my data safe', 'can you fix a water damaged phone', 'what are your hours', 'i need a website for my shop', 'play chess', 'open the services page', 'who are you', 'do you fix drones', 'recommend a laptop for video editing', 'my screen is flickering', 'what is the weather today', 'tell me a joke', 'how do i back up my photos', 'what does RAM do', 'wifi keeps dropping', 'can you recover deleted files', 'do you offer warranty', 'give me a tour', 'where are you located', 'can you build an app', 'how do i send you a file', 'what is the capital of france'];

export default function ChatLab() {
  const toast = useToast();
  const [tab, setTab] = useState<'insights' | 'gaps' | 'play' | 'stress'>('insights');
  const log = useApi<{ questions: Q[] }>('/api/admin/chat', { every: 60000 });
  const stats = useApi<Stats>('/api/admin/stats?days=30');
  const qs = log.data?.questions;
  const grouped = useMemo(() => groupQuestions(qs || []), [qs]);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [seed, setSeed] = useState('');

  // playground
  const [mode, setMode] = useState<PersonaMode>('HUMAN');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [mem, setMem] = useState<SessionMemory>(fresh);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const send = useCallback(async (text: string) => {
    const q = text.trim(); if (!q || busy) return;
    setBusy(true); setInput('');
    try { const r = await ask(q, mode, mem); setMem(r.memory); setTurns((t) => [...t, r.turn]); }
    catch (e) { toast(e instanceof Error ? e.message : 'The engine threw an error', 'err'); }
    finally { setBusy(false); }
  }, [busy, mode, mem, toast]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [turns.length]);
  const tryIt = (q: string) => { setSeed(q); setTab('play'); };
  useEffect(() => { if (tab === 'play' && seed) { const s = seed; setSeed(''); void send(s); } }, [tab, seed, send]);

  // stress test
  const [run, setRun] = useState<{ done: number; rows: Turn[] } | null>(null);
  const stress = async () => {
    setRun({ done: 0, rows: [] }); const rows: Turn[] = [];
    for (let i = 0; i < SAMPLES.length; i++) { try { rows.push((await ask(SAMPLES[i], 'HUMAN', fresh())).turn); } catch { rows.push({ id: ++turnId, q: SAMPLES[i], reply: 'ENGINE ERROR', source: 'error', ms: 0, guided: false, gap: true }); } setRun({ done: i + 1, rows: [...rows] }); await new Promise((r) => setTimeout(r, 0)); }
  };
  const sum = run && run.done === SAMPLES.length ? { gaps: run.rows.filter((r) => r.gap || r.source === 'error').length, avg: Math.round(run.rows.reduce((a, r) => a + r.ms, 0) / run.rows.length), slow: Math.max(...run.rows.map((r) => r.ms)) } : null;

  return (
    <>
      <PageHead title="Chat Lab" sub="See what visitors ask, teach the assistant what it missed, and test it live on the real engine." icon="brain"
        right={<Tabs value={tab} onChange={setTab} items={[{ id: 'insights', label: 'Insights' }, { id: 'gaps', label: 'Gaps', badge: grouped.gaps.length }, { id: 'play', label: 'Playground' }, { id: 'stress', label: 'Stress test' }]} />} />
      {log.error && <ErrorBox text={log.error} retry={log.reload} />}

      {tab === 'insights' && (!qs ? <Skel h="h-56" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Most asked" icon="chat">{grouped.top.length === 0 ? <Empty icon="chat" title="No questions yet" text="Visitor questions to the assistant show up here (no names, no IPs)." /> : <Bars items={grouped.top.map((g) => ({ name: g.text, n: g.n }))} />}</Card>
          <Card title="How questions were answered (30 days)" icon="cpu">{stats.data ? <Donut items={stats.data.chatSources} label="Answer sources" /> : <Skel h="h-28" />}
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">rules = built-in logic · knowledge = your knowledge base · web = encyclopedia lookup · local-ai/remote-ai = an on-device model</p></Card>
          <Card title="Latest conversation log" icon="clock" className="md:col-span-2" pad={false}>
            <ul className="max-h-96 divide-y divide-zinc-800/70 overflow-y-auto">{qs.slice(0, 60).map((x, i) => <li key={x.t + ':' + i} className="flex items-baseline gap-3 px-4 py-2 text-sm"><span className="w-20 shrink-0 font-mono text-[10px] text-zinc-600">{relTime(x.t)}</span><span className="min-w-0 flex-1 truncate text-zinc-300">{x.q}</span><Badge tone={x.gap ? 'warn' : 'default'}>{x.gap ? 'unanswered' : x.src}</Badge></li>)}{qs.length === 0 && <li className="px-4 py-8 text-center text-xs text-zinc-600">Nothing logged yet.</li>}</ul>
          </Card>
        </div>))}

      {tab === 'gaps' && (!qs ? <Skel h="h-56" /> : (
        <div className="space-y-4">
          <Notice title="Knowledge gaps = free content ideas">Each row is something visitors asked that the assistant could not answer. Draft an entry, paste it into <code className="text-accent">utils/chatEngine/knowledgeBase.ts</code>, fill in the answers and redeploy.</Notice>
          {grouped.gaps.length === 0 ? <Card><Empty icon="check" title="No gaps recorded" text="Either the assistant is covering everything, or there is not enough traffic yet." /></Card> : (
            <ul className="space-y-2">{grouped.gaps.map((g) => (
              <li key={g.key} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"><div className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1 text-sm text-zinc-200">{g.text}</span><Badge tone="warn">{g.n}×</Badge><span className="font-mono text-[10px] text-zinc-600">{relTime(g.last)}</span><AButton small icon="play" onClick={() => tryIt(g.text)}>Try now</AButton><AButton small icon="lightbulb" onClick={() => setSnippet(snippet === g.key ? null : g.key)}>Draft entry</AButton></div>
                {snippet === g.key && <div className="mt-3"><pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-emerald-200">{kbSnippet(g.text)}</pre><div className="mt-2"><CopyBtn text={kbSnippet(g.text)} label="Copy entry" /></div></div>}</li>))}</ul>)}
        </div>))}

      {tab === 'play' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
          <Card title="Live engine" icon="chat" right={<div className="flex gap-2"><Tabs value={mode} onChange={(m) => setMode(m as PersonaMode)} items={[{ id: 'HUMAN', label: 'Human' }, { id: 'EXPERT', label: 'Expert' }]} /><AButton small icon="refresh" onClick={() => { setTurns([]); setMem(fresh()); }}>Reset</AButton></div>}>
            <div className="max-h-[28rem] min-h-48 space-y-3 overflow-y-auto pr-1" aria-live="polite">
              {turns.length === 0 && <p className="py-10 text-center text-xs text-zinc-600">Type anything a visitor might. This runs the same engine as the chat widget, with its own private memory.</p>}
              {turns.map((t) => (
                <div key={t.id} className="space-y-1.5"><div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-accent/15 px-3 py-1.5 text-sm text-accent">{t.q}</div>
                  <div className="max-w-[92%] rounded-xl rounded-bl-sm border border-zinc-800 bg-zinc-950/70 px-3 py-2"><div className="whitespace-pre-wrap text-sm text-zinc-200">{t.reply}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5"><Badge tone={t.gap ? 'warn' : 'accent'}>{t.gap ? 'fallback' : t.source}</Badge><Badge>{t.ms} ms</Badge>{t.guided && <Badge tone="ok">guided</Badge>}{t.command && <Badge>cmd: {t.command}</Badge>}{!!t.cards && <Badge>{t.cards} cards</Badge>}</div>
                    {t.trace && t.trace.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-mono text-[10px] text-zinc-500">why I said that</summary><ul className="mt-1 list-disc pl-5 text-xs text-zinc-400">{t.trace.map((x, i) => <li key={i}>{x}</li>)}</ul></details>}
                    {t.suggestions && t.suggestions.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{t.suggestions.slice(0, 5).map((s) => <button key={s} type="button" onClick={() => send(s)} className="cursor-pointer rounded-full border border-zinc-700 px-2.5 py-0.5 font-mono text-[10px] text-zinc-400 hover:border-accent hover:text-accent">{s}</button>)}</div>}</div></div>))}
              <div ref={endRef} />
            </div>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask like a visitor…" aria-label="Test message" className={inputCls} /><AButton type="submit" variant="solid" icon="arrow" disabled={busy || !input.trim()}>{busy ? '…' : 'Send'}</AButton></form>
          </Card>
          <Card title="What it remembers" icon="brain"><dl className="space-y-1 font-mono text-[11px]"><div className="flex justify-between"><dt className="text-zinc-500">turns</dt><dd className="text-zinc-300">{mem.interactionCount}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">last topic</dt><dd className="truncate pl-2 text-zinc-300">{mem.lastTopic}</dd></div></dl>
            <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-zinc-950 p-2 font-mono text-[10px] text-zinc-400">{JSON.stringify(mem.userContext, null, 1)}</pre></Card>
        </div>)}

      {tab === 'stress' && (
        <div className="space-y-4">
          <Card title={`${SAMPLES.length} typical visitor questions`} icon="bolt" right={<AButton variant="solid" icon="play" onClick={stress} disabled={!!run && !sum}>{run && !sum ? `Running ${run.done}/${SAMPLES.length}…` : 'Run test'}</AButton>}>
            <p className="text-sm text-zinc-400">Sends each question through the engine with a fresh memory and records how it was answered, how long it took, and whether it fell back to “I don’t know”. Useful after you edit the knowledge base.</p>
            {sum && <div className="mt-3 flex flex-wrap gap-2"><Badge tone={sum.gaps ? 'warn' : 'ok'}>{sum.gaps} fallback{sum.gaps === 1 ? '' : 's'}</Badge><Badge>avg {sum.avg} ms</Badge><Badge tone={sum.slow > 1500 ? 'warn' : 'ok'}>slowest {sum.slow} ms</Badge></div>}
          </Card>
          {run && <Card pad={false}><ul className="divide-y divide-zinc-800/70">{run.rows.map((r) => <li key={r.id} className="flex flex-wrap items-baseline gap-2 px-4 py-2 text-sm"><span className="min-w-0 flex-1 text-zinc-300">{r.q}</span><Badge tone={r.gap ? 'warn' : 'accent'}>{r.gap ? 'fallback' : r.source}</Badge><span className="w-14 text-right font-mono text-[10px] text-zinc-600">{r.ms} ms</span><AButton small onClick={() => tryIt(r.q)}>Open</AButton></li>)}</ul></Card>}
        </div>)}
    </>
  );
}
