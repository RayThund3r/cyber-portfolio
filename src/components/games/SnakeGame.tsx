// src/components/games/SnakeGame.tsx — Snake with walls or wrap-around, speed that grows, swipe + keys + on-screen pad.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mulberry32 } from '@/lib/games/rng';
import { newSnake, step, tickMs, turn, type Dir, type SnakeState } from '@/lib/games/snake';
import { Banner, Btn, Panel, Pill, Segmented, useRecord } from './ui';
import { Arrow, PadButton, accentColor, say, setupCanvas, useGameKeys, useSwipe } from './arcade';

const W = 20, H = 20, CELL = 18;
const KEYS: Record<string, Dir> = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R', W: 'U', S: 'D', A: 'L', D: 'R' };

export default function SnakeGame() {
  const { rec, best } = useRecord('snake');
  const [mode, setMode] = useState<'walls' | 'wrap'>('walls');
  const rng = useRef(mulberry32((Date.now() & 0xffffff) | 1));
  const st = useRef<SnakeState>(newSnake(W, H, rng.current));
  const [view, setView] = useState({ score: 0, eaten: 0, alive: true });
  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'over'>('ready');
  const canvas = useRef<HTMLCanvasElement>(null);
  const timer = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const color = useRef('#22d3ee');

  const draw = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const ctx = setupCanvas(c, W * CELL, H * CELL); if (!ctx) return;
    const s = st.current;
    ctx.clearRect(0, 0, W * CELL, H * CELL);
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { ctx.fillStyle = (x + y) % 2 ? 'rgba(113,113,122,.07)' : 'rgba(113,113,122,.13)'; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
    ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.arc(s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, CELL * 0.34, 0, Math.PI * 2); ctx.fill();
    s.body.forEach((p, i) => { ctx.globalAlpha = Math.max(0.4, 1 - i * 0.02); ctx.fillStyle = i === 0 ? '#fff' : color.current; ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2); });
    ctx.globalAlpha = 1;
  }, []);

  const stop = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  const loop = useCallback(() => {
    stop();
    timer.current = window.setTimeout(() => {
      if (phaseRef.current !== 'playing' || document.hidden) { if (phaseRef.current === 'playing') loop(); return; }
      const r = step(st.current, rng.current);
      st.current = r.state;
      setView({ score: r.state.score, eaten: r.state.eaten, alive: r.state.alive });
      draw();
      if (r.ate) { say('snake', 'score', { score: r.state.score }); if (r.state.eaten > 0 && r.state.eaten % 5 === 0) say('snake', 'streak', { streak: r.state.eaten }); }
      if (r.died) {
        setPhase('over'); phaseRef.current = 'over';
        say('snake', 'lose', { score: r.state.score });
        if (r.state.score > (rec.best ?? 0) && r.state.score > 0) { say('snake', 'highscore', { score: r.state.score }); }
        best(r.state.score);
        return;
      }
      loop();
    }, tickMs(st.current.eaten));
  }, [draw, best, rec.best]);

  const reset = useCallback(() => {
    stop();
    st.current = newSnake(W, H, rng.current, mode === 'wrap');
    setView({ score: 0, eaten: 0, alive: true });
    setPhase('ready'); phaseRef.current = 'ready';
    draw();
  }, [draw, mode]);

  useEffect(() => { color.current = accentColor(); say('snake', 'open'); return () => { stop(); say('snake', 'leave'); }; }, []);
  useEffect(() => { reset(); }, [mode, reset]);

  const go = (d: Dir) => {
    if (phaseRef.current === 'over') return;
    st.current = turn(st.current, d);
    if (phaseRef.current === 'ready' || phaseRef.current === 'paused') { setPhase('playing'); phaseRef.current = 'playing'; if (phaseRef.current === 'playing') { say('snake', 'start'); loop(); } }
  };
  const toggle = () => {
    if (phaseRef.current === 'playing') { setPhase('paused'); phaseRef.current = 'paused'; stop(); }
    else if (phaseRef.current === 'paused' || phaseRef.current === 'ready') { setPhase('playing'); phaseRef.current = 'playing'; if (phaseRef.current === 'playing') loop(); }
  };
  useGameKeys((k) => {
    if (KEYS[k]) { go(KEYS[k]); return true; }
    if (k === ' ' || k === 'p' || k === 'P') { toggle(); return true; }
    if (k === 'Enter' && phaseRef.current === 'over') { reset(); return true; }
  });
  const swipe = useSwipe(go);

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill label="Score" value={view.score} tone="accent" /><Pill label="Eaten" value={view.eaten} /><Pill label="Best" value={rec.best ?? 0} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented label="Mode" value={mode} onChange={setMode} disabled={phase === 'playing'} options={[{ id: 'walls', label: 'Walls' }, { id: 'wrap', label: 'Wrap' }]} />
          <Btn icon={phase === 'playing' ? 'clock' : 'play'} onClick={toggle} disabled={phase === 'over'}>{phase === 'playing' ? 'Pause' : phase === 'paused' ? 'Resume' : 'Start'}</Btn>
          <Btn icon="refresh" onClick={reset}>New</Btn>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[400px] touch-none" {...swipe}>
        <canvas ref={canvas} role="img" aria-label="Snake board" className="block h-auto w-full rounded-xl border border-zinc-800 bg-zinc-950" style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
      {phase === 'ready' && <p className="mt-3 text-center font-mono text-xs text-zinc-500">Press an arrow key, swipe, or tap an arrow to start.</p>}
      {phase === 'over' && <div className="mt-3"><Banner tone="lose" title={`Crashed with ${view.score} points`} text={view.score >= (rec.best ?? 0) && view.score > 0 ? 'That is your best run.' : 'Try again, it gets easier.'} action={<Btn variant="solid" icon="refresh" onClick={reset}>Play again</Btn>} /></div>}
      <div className="mx-auto mt-4 grid w-fit grid-cols-3 gap-2 md:hidden" aria-label="On-screen controls">
        <span /><PadButton label="Up" onPress={() => go('U')}><Arrow dir="U" /></PadButton><span />
        <PadButton label="Left" onPress={() => go('L')}><Arrow dir="L" /></PadButton><PadButton label="Down" onPress={() => go('D')}><Arrow dir="D" /></PadButton><PadButton label="Right" onPress={() => go('R')}><Arrow dir="R" /></PadButton>
      </div>
    </Panel>
  );
}
