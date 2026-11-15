// src/components/games/FlappyGame.tsx — a one-button flapper: tap, click or Space.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mulberry32 } from '@/lib/games/rng';
import { BIRD_R, BIRD_X, GROUND, H, PIPE_W, W, flap, newGame, step, type FlappyState } from '@/lib/games/flappy';
import { Banner, Btn, Panel, Pill, useRecord } from './ui';
import { accentColor, say, setupCanvas, useFrameLoop, useGameKeys } from './arcade';

export default function FlappyGame() {
  const { rec, best } = useRecord('flappy');
  const rng = useRef(mulberry32((Date.now() & 0xffffff) | 1));
  const st = useRef<FlappyState>(newGame());
  const canvas = useRef<HTMLCanvasElement>(null);
  const color = useRef('#22d3ee');
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [score, setScore] = useState(0);
  const phaseRef = useRef(phase); phaseRef.current = phase;

  const draw = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const ctx = setupCanvas(c, W, H); if (!ctx) return;
    const s = st.current;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#16a34a';
    s.pipes.forEach((p) => {
      ctx.fillRect(p.x, 0, PIPE_W, p.gapY - p.gap / 2);
      ctx.fillRect(p.x, p.gapY + p.gap / 2, PIPE_W, H - GROUND - (p.gapY + p.gap / 2));
      ctx.fillStyle = '#22c55e'; ctx.fillRect(p.x - 3, p.gapY - p.gap / 2 - 10, PIPE_W + 6, 10); ctx.fillRect(p.x - 3, p.gapY + p.gap / 2, PIPE_W + 6, 10); ctx.fillStyle = '#16a34a';
    });
    ctx.fillStyle = '#3f3f46'; ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = color.current; ctx.fillRect(0, H - GROUND, W, 3);
    ctx.save(); ctx.translate(BIRD_X, s.y); ctx.rotate(Math.max(-0.5, Math.min(1.1, s.vy / 500)));
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(4, -3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fb923c'; ctx.fillRect(BIRD_R - 2, -1, 7, 4);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(String(s.score), W / 2, 56); ctx.textAlign = 'start';
  }, []);

  const begin = useCallback(() => { st.current = newGame(); setScore(0); setPhase('playing'); phaseRef.current = 'playing'; flap(st.current); say('flappy', 'start'); draw(); }, [draw]);
  useEffect(() => { color.current = accentColor(); say('flappy', 'open'); draw(); return () => say('flappy', 'leave'); }, [draw]);

  useFrameLoop((dt) => {
    const s = st.current;
    const ev = step(s, dt, rng.current);
    if (ev.includes('score')) { setScore(s.score); if (s.score > 0 && s.score % 10 === 0) say('flappy', 'streak', { streak: s.score }); else say('flappy', 'score', { score: s.score }); }
    draw();
    if (ev.includes('crash') || s.over) {
      setPhase('over'); phaseRef.current = 'over';
      say('flappy', 'lose', { score: s.score });
      if (s.score > (rec.best ?? 0) && s.score > 0) say('flappy', 'highscore', { score: s.score });
      best(s.score);
    }
  }, phase === 'playing');

  const tap = () => { if (phaseRef.current === 'playing') flap(st.current); else begin(); };
  useGameKeys((k) => { if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Enter') { tap(); return true; } });

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2"><Pill label="Score" value={score} tone="accent" /><Pill label="Best" value={rec.best ?? 0} /><div className="ml-auto"><Btn icon="refresh" onClick={begin}>Restart</Btn></div></div>
      <div className="relative mx-auto w-full max-w-[320px] touch-none select-none">
        <canvas ref={canvas} role="img" aria-label="Flappy board" onPointerDown={(e) => { e.preventDefault(); tap(); }} className="block h-auto w-full cursor-pointer rounded-xl border border-zinc-800 bg-sky-950" style={{ aspectRatio: `${W} / ${H}` }} />
        {phase === 'ready' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 px-6 text-center font-mono text-xs text-zinc-200">Tap, click or press Space to flap. Slip through the gaps.</div>}
      </div>
      {phase === 'over' && <div className="mt-3"><Banner tone="lose" title={`Splat. ${score} pipes`} text={score >= (rec.best ?? 0) && score > 0 ? 'A new personal best.' : 'Short taps keep you steadier than big ones.'} action={<Btn variant="solid" icon="refresh" onClick={begin}>Try again</Btn>} /></div>}
    </Panel>
  );
}
