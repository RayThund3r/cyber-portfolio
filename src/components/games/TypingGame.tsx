// src/components/games/TypingGame.tsx — Typing Sprint: 45 seconds, live WPM and accuracy.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { mulberry32 } from '@/lib/games/rng';
import { DURATION, accuracy, isMatch, makeWords, prefixOk, wpm } from '@/lib/games/typing';
import { Banner, Btn, Panel, Pill, useRecord } from './ui';
import { say } from './arcade';

export default function TypingGame() {
  const { rec, best } = useRecord('typing');
  const [seed, setSeed] = useState(1);
  const words = useMemo(() => makeWords(mulberry32(seed * 7919 + 13), 160), [seed]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [left, setLeft] = useState(DURATION);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const stats = useRef({ correctChars: 0, keys: 0, goodKeys: 0, streak: 0 });
  const input = useRef<HTMLInputElement>(null);
  const startedAt = useRef(0);

  useEffect(() => { setSeed(Math.floor(Math.random() * 100000) + 1); say('typing', 'open'); return () => say('typing', 'leave'); }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const t = window.setInterval(() => {
      const remain = Math.max(0, DURATION - Math.floor((Date.now() - startedAt.current) / 1000));
      setLeft(remain);
      if (remain <= 0) { window.clearInterval(t); setPhase('over'); }
    }, 250);
    return () => window.clearInterval(t);
  }, [phase]);

  const elapsed = Math.max(1, DURATION - left);
  const live = wpm(stats.current.correctChars, phase === 'over' ? DURATION : elapsed);
  const acc = accuracy(stats.current.goodKeys, stats.current.keys);

  useEffect(() => {
    if (phase !== 'over') return;
    const score = wpm(stats.current.correctChars, DURATION);
    say('typing', score >= 40 ? 'win' : 'lose', { score });
    if (score > (rec.best ?? 0) && score > 0) say('typing', 'highscore', { score });
    best(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const begin = () => { stats.current = { correctChars: 0, keys: 0, goodKeys: 0, streak: 0 }; setSeed((x) => x + 1); setIdx(0); setTyped(''); setLeft(DURATION); setPhase('playing'); startedAt.current = Date.now(); say('typing', 'start'); window.setTimeout(() => input.current?.focus(), 30); };

  const onChange = (v: string) => {
    if (phase === 'over') return;
    if (phase === 'ready') { startedAt.current = Date.now(); setPhase('playing'); say('typing', 'start'); }
    const w = words[idx];
    const grew = v.length > typed.length;
    if (grew) {
      stats.current.keys += 1;
      if (prefixOk(v.replace(/\s+$/, ''), w) === v.replace(/\s+$/, '').length) stats.current.goodKeys += 1;
    }
    if (v.endsWith(' ')) {
      if (isMatch(v, w)) { stats.current.correctChars += w.length + 1; stats.current.streak += 1; if (stats.current.streak % 10 === 0) say('typing', 'streak', { streak: stats.current.streak }); }
      else { stats.current.streak = 0; say('typing', 'mistake'); }
      setIdx((i) => i + 1); setTyped(''); return;
    }
    setTyped(v);
  };

  const cur = words[idx] || '';
  const ok = prefixOk(typed, cur);
  const wrong = typed.length > ok;

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill label="WPM" value={live} tone="accent" /><Pill label="Accuracy" value={`${acc}%`} /><Pill label="Time" value={left} tone={left <= 8 && phase === 'playing' ? 'warn' : 'default'} /><Pill label="Best" value={rec.best ?? 0} />
        <div className="ml-auto"><Btn icon={phase === 'playing' ? 'refresh' : 'play'} onClick={begin}>{phase === 'playing' ? 'Restart' : 'Start'}</Btn></div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-lg leading-9 sm:text-xl" aria-live="off">
        {words.slice(Math.max(0, idx - 3), idx + 24).map((w, k) => {
          const i = Math.max(0, idx - 3) + k;
          return <span key={i} className={`mr-3 inline-block ${i < idx ? 'text-zinc-600' : i === idx ? (wrong ? 'rounded bg-red-500/20 text-red-300' : 'rounded bg-accent/15 text-accent') : 'text-zinc-300'}`}>{w}</span>;
        })}
      </div>
      <input ref={input} value={typed} onChange={(e) => onChange(e.target.value)} disabled={phase === 'over'} aria-label="Type the highlighted word, then press space" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        placeholder={phase === 'ready' ? 'Start typing to begin…' : ''} className="mt-3 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 font-mono text-base text-zinc-100 outline-none focus:border-accent" />
      {phase === 'over' && <div className="mt-3"><Banner tone={live >= 40 ? 'win' : 'info'} title={`${live} WPM at ${acc}% accuracy`} text={live >= (rec.best ?? 0) && live > 0 ? 'A new personal best.' : 'Accuracy first, speed follows.'} action={<Btn variant="solid" icon="refresh" onClick={begin}>Go again</Btn>} /></div>}
    </Panel>
  );
}
