// src/components/games/TwentyFourGame.tsx — The 24 game with an exhaustive solver and a safe expression checker.
'use client';

import { useEffect, useRef, useState } from 'react';
import * as T from '@/lib/games/twentyfour';
import { Banner, Btn, Panel, Pill, Record, Segmented, useRecord, useStopwatch, fmt } from './ui';

export default function TwentyFourGame() {
  const { rec, win, best } = useRecord('twentyfour');
  const [hard, setHard] = useState<'easy' | 'hard'>('easy');
  const [deal, setDeal] = useState<{ nums: number[]; solution: string } | null>(null);
  const [expr, setExpr] = useState('');
  const [msg, setMsg] = useState('');
  const [state, setState] = useState<'play' | 'solved' | 'shown'>('play');
  const [streak, setStreak] = useState(0);
  const [seed, setSeed] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const secs = useStopwatch(state === 'play' && !!deal, seed);

  const next = (h = hard) => { setDeal(T.deal(Math.random, h === 'hard')); setExpr(''); setMsg(''); setState('play'); setSeed((s) => s + 1); setTimeout(() => input.current?.focus(), 30); };
  useEffect(() => { next(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (!deal) return <div className="h-48" aria-busy="true" />;
  const submit = () => {
    if (state !== 'play') return;
    const r = T.check(expr, deal.nums);
    if (r.ok) { setState('solved'); setMsg(''); setStreak((s) => { const v = s + 1; best(v); return v; }); win(); }
    else if (r.error) setMsg(r.error);
    else setMsg(`That equals ${Number.isInteger(r.value) ? r.value : r.value?.toFixed(3)}, not 24. Keep going!`);
  };
  const add = (s: string) => { setExpr((e) => e + s); input.current?.focus(); };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <div className="space-y-3">
        <div className="flex justify-center gap-3" aria-label={`Numbers: ${deal.nums.join(', ')}`}>
          {deal.nums.map((v, i) => <button key={i} type="button" onClick={() => add(String(v))} className="flex h-20 w-16 cursor-pointer items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 font-mono text-3xl font-bold text-accent transition hover:border-accent/60 active:scale-95 sm:h-24 sm:w-20">{v}</button>)}
        </div>
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Operators">
          {['+', '−', '×', '÷', '(', ')'].map((o) => <Btn key={o} onClick={() => add(o)}>{o}</Btn>)}
          <Btn onClick={() => setExpr((e) => e.slice(0, -1))} icon="undo" title="Backspace" />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
          <input ref={input} value={expr} onChange={(e) => setExpr(e.target.value)} disabled={state !== 'play'} inputMode="text" autoComplete="off" spellCheck={false} aria-label="Your expression" placeholder="e.g. (8 ÷ (3 − 8 ÷ 3))"
            className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm text-zinc-100 outline-none focus:border-accent" />
          <Btn variant="solid" onClick={submit} disabled={state !== 'play'} icon="check">Check</Btn>
        </form>
        <p className="min-h-5 font-mono text-xs text-amber-300" role="status" aria-live="polite">{msg}</p>
        {state === 'solved' && <Banner tone="win" title={`24! Solved in ${fmt(secs)}`} text={`One solution the AI found: ${deal.solution.replace(/-/g, '−')}`} action={<Btn variant="solid" icon="play" onClick={() => next()}>Next hand</Btn>} />}
        {state === 'shown' && <Banner tone="info" title="One way to make 24" text={deal.solution.replace(/-/g, '−')} action={<Btn variant="solid" icon="play" onClick={() => { setStreak(0); next(); }}>Next hand</Btn>} />}
      </div>
      <Panel className="space-y-4">
        <Segmented label="Difficulty" value={hard} onChange={(h) => { setHard(h); next(h); }} options={[{ id: 'easy', label: 'Friendly hands' }, { id: 'hard', label: 'Tricky hands' }]} />
        <div className="flex flex-wrap gap-2">
          <Btn icon="lightbulb" onClick={() => setMsg(`Hint: the AI’s answer starts with ${deal.solution.slice(0, deal.solution.search(/[+\-×÷]/) + 1).replace(/-/g, '−')}…`)} disabled={state !== 'play'}>Hint</Btn>
          <Btn icon="cpu" onClick={() => { setState('shown'); setStreak(0); }} disabled={state !== 'play'}>Show answer</Btn>
          <Btn icon="refresh" onClick={() => { setStreak(0); next(); }}>Skip</Btn>
        </div>
        <div className="flex gap-2"><Pill label="Streak" value={streak} tone="accent" /><Pill label="Best" value={rec.best ?? 0} /><Pill label="Time" value={fmt(secs)} /></div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">Use all four numbers exactly once with + − × ÷ and brackets; intermediate fractions are allowed (8 ÷ (3 − 8 ÷ 3) = 24). Your expression is parsed by a tiny safe evaluator using exact fractions, and the AI checks every ordering and bracketing to deal only hands that are solvable.</p>
      </Panel>
    </div>
  );
}
