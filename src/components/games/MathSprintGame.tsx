// src/components/games/MathSprintGame.tsx — 60-second mental arithmetic with streak multipliers.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as M from '@/lib/games/mathsprint';
import { Banner, Btn, Panel, Pill, Segmented, useRecord } from './ui';

export default function MathSprintGame() {
  const { rec, best } = useRecord('math');
  const [level, setLevel] = useState<M.MathLevel>('normal');
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');
  const [left, setLeft] = useState(M.SECONDS);
  const [q, setQ] = useState<M.Question>(() => ({ text: '7 × 8', answer: 56 }));
  const [val, setVal] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [shake, setShake] = useState(0);
  const [flashOk, setFlashOk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = () => { setPhase('run'); setLeft(M.SECONDS); setScore(0); setStreak(0); setBestStreak(0); setRight(0); setWrong(0); setVal(''); setQ(M.question(level)); window.setTimeout(() => inputRef.current?.focus(), 30); };

  useEffect(() => {
    if (phase !== 'run') return;
    if (left <= 0) { setPhase('done'); best(score); return; }
    const id = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(id);
  }, [phase, left, score, best]);

  const submit = useCallback((text: string) => {
    if (phase !== 'run' || text.trim() === '') return;
    if (Number(text) === q.answer) {
      const s = streak + 1;
      setStreak(s); setBestStreak((b) => Math.max(b, s)); setRight((r) => r + 1); setScore((x) => x + M.points(streak, level)); setFlashOk(true);
      window.setTimeout(() => setFlashOk(false), 200);
    } else { setStreak(0); setWrong((w) => w + 1); setShake((x) => x + 1); }
    setVal(''); setQ(M.question(level));
  }, [phase, q, streak, level]);

  const onChange = (v: string) => {
    const clean = v.replace(/[^0-9-]/g, '').slice(0, 6);
    setVal(clean);
    // auto-submit as soon as the typed number has as many digits as the answer, so you never need Enter
    if (clean && !clean.startsWith('-') && clean.length >= String(q.answer).length) submit(clean);
  };

  const acc = right + wrong ? Math.round((right / (right + wrong)) * 100) : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <div className="space-y-3">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={M.SECONDS} aria-valuenow={left} aria-label="Time left">
          <div className={`h-full transition-all duration-1000 ease-linear ${left <= 10 ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${(left / M.SECONDS) * 100}%` }} />
        </div>
        <div className={`flex min-h-56 flex-col items-center justify-center rounded-2xl border bg-zinc-900/60 p-6 text-center transition-colors ${flashOk ? 'border-emerald-400' : 'border-zinc-700'}`}>
          {phase === 'idle' && <p className="font-mono text-sm text-zinc-400">Solve as many as you can in {M.SECONDS} seconds.<br />Streaks multiply your points.</p>}
          {phase === 'run' && (
            <>
              <p key={q.text} className="g-pop font-mono text-4xl font-bold text-zinc-100 sm:text-5xl">{q.text}</p>
              <input key={shake} ref={inputRef} value={val} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(val); }} inputMode="numeric" autoComplete="off" aria-label="Your answer" placeholder="?"
                className={`mt-5 w-40 rounded-xl border bg-zinc-950 px-4 py-3 text-center font-mono text-2xl text-accent outline-none focus:border-accent ${shake ? 'g-shake border-red-500/70' : 'border-zinc-700'}`} />
            </>
          )}
          {phase === 'done' && <><p className="font-mono text-xs uppercase tracking-wider text-zinc-500">Time</p><p className="font-mono text-5xl font-bold text-accent">{score}</p><p className="mt-1 text-xs text-zinc-400">points</p></>}
        </div>
        {phase === 'done' && <Banner tone="win" title={`${right} correct · ${acc}% accuracy · best streak ${bestStreak}`} text={score >= (rec.best ?? 0) ? 'That is a new personal best!' : `Your best is ${rec.best}.`} action={<Btn variant="solid" icon="play" onClick={start}>Go again</Btn>} />}
      </div>
      <Panel className="space-y-4">
        <Segmented label="Level" value={level} onChange={setLevel} options={[{ id: 'warmup', label: 'Warm-up' }, { id: 'normal', label: 'Normal' }, { id: 'brutal', label: 'Brutal' }]} disabled={phase === 'run'} />
        <div className="flex flex-wrap gap-2"><Pill label="Time" value={`${left}s`} tone={left <= 10 && phase === 'run' ? 'warn' : 'accent'} /><Pill label="Score" value={score} /><Pill label="Streak" value={streak} /><Pill label="Best" value={rec.best ?? 0} /></div>
        <Btn variant="solid" icon="play" onClick={start}>{phase === 'run' ? 'Restart' : 'Start'}</Btn>
        <p className="text-[11px] leading-relaxed text-zinc-500">Type the answer and it submits itself once it has the right number of digits (Enter also works). Wrong answers reset your streak. Higher levels add multiplication, division, squares and mixed operations, with bigger point multipliers.</p>
      </Panel>
    </div>
  );
}
