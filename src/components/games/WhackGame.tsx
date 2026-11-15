// src/components/games/WhackGame.tsx — Whack-a-Mole: 30 seconds, golden moles score big, bombs cost points. Great on a phone.
'use client';

import { useEffect, useRef, useState } from 'react';
import { mulberry32 } from '@/lib/games/rng';
import { DURATION, HOLES, newGame, step, whack, type WhackState } from '@/lib/games/whack';
import Icon from '@/components/ui/Icon';
import { Banner, Btn, Panel, Pill, useRecord } from './ui';
import { say, useFrameLoop } from './arcade';

export default function WhackGame() {
  const { rec, best } = useRecord('whack');
  const rng = useRef(mulberry32((Date.now() & 0xffffff) | 1));
  const st = useRef<WhackState>(newGame());
  const [, force] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const streakSaid = useRef(0);

  useEffect(() => { say('whack', 'open'); return () => say('whack', 'leave'); }, []);
  const begin = () => { st.current = newGame(); streakSaid.current = 0; setPhase('playing'); phaseRef.current = 'playing'; say('whack', 'start'); force((n) => n + 1); };

  useFrameLoop((dt) => {
    const s = st.current;
    const ev = step(s, dt, rng.current);
    force((n) => (n + 1) % 1000000);
    if (ev.includes('over')) {
      setPhase('over'); phaseRef.current = 'over';
      say('whack', s.score > 150 ? 'win' : 'lose', { score: s.score });
      if (s.score > (rec.best ?? 0) && s.score > 0) say('whack', 'highscore', { score: s.score });
      best(s.score);
    }
  }, phase === 'playing');

  const hit = (hole: number) => {
    if (phaseRef.current !== 'playing') return;
    const s = st.current;
    const e = whack(s, hole);
    if (e === 'bomb') say('whack', 'mistake'); else if (e === 'golden') say('whack', 'good', { score: s.score }); else if (e === 'hit' && s.streak > 0 && s.streak % 5 === 0 && streakSaid.current !== s.streak) { streakSaid.current = s.streak; say('whack', 'streak', { streak: s.streak }); }
    force((n) => n + 1);
  };

  const s = st.current;
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill label="Score" value={s.score} tone="accent" /><Pill label="Time" value={Math.max(0, Math.ceil(s.time))} tone={s.time <= 8 && phase === 'playing' ? 'warn' : 'default'} /><Pill label="Streak" value={s.streak} /><Pill label="Best" value={rec.best ?? 0} />
        <div className="ml-auto"><Btn icon={phase === 'playing' ? 'refresh' : 'play'} onClick={begin}>{phase === 'playing' ? 'Restart' : 'Start'}</Btn></div>
      </div>
      <div className="mx-auto grid w-full max-w-[360px] grid-cols-3 gap-3" role="group" aria-label="Mole holes">
        {Array.from({ length: HOLES }).map((_, i) => {
          const p = s.popups.find((x) => x.hole === i);
          const up = !!p && !p.whacked;
          return (
            <button key={i} type="button" onPointerDown={(e) => { e.preventDefault(); hit(i); }} aria-label={up ? `${p!.kind} in hole ${i + 1}` : `Hole ${i + 1}`}
              className="relative aspect-square touch-none select-none overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 active:scale-95">
              <span className="absolute inset-x-3 bottom-3 h-3 rounded-full bg-black/70" />
              {p && (
                <span className={`absolute inset-x-0 bottom-0 flex items-end justify-center transition-transform duration-100 ${up ? 'translate-y-2' : 'translate-y-full'}`}>
                  <span className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 ${p.kind === 'bomb' ? 'border-red-500 bg-red-950 text-red-300' : p.kind === 'golden' ? 'border-amber-300 bg-amber-400 text-amber-950' : 'border-amber-700 bg-amber-800 text-amber-200'}`}>
                    <Icon name={p.kind === 'bomb' ? 'bolt' : p.kind === 'golden' ? 'star' : 'user'} size={26} />
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {phase === 'ready' && <p className="mt-3 text-center font-mono text-xs text-zinc-500">{DURATION} seconds. Tap the moles, the gold star is worth extra, avoid the red bolts.</p>}
      {phase === 'over' && <div className="mt-3"><Banner tone={s.score > 150 ? 'win' : 'info'} title={`Time. ${s.score} points`} text={`${s.hits} hits, ${s.misses} misses, ${s.bombs} bombs. Best streak ${s.bestStreak}.`} action={<Btn variant="solid" icon="refresh" onClick={begin}>Again</Btn>} /></div>}
    </Panel>
  );
}
