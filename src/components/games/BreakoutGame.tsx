// src/components/games/BreakoutGame.tsx — Breakout: drag / mouse / arrow keys, 3 lives, faster levels.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { H, PADDLE_H, PADDLE_Y, W, launch, newGame, step, type BreakoutState } from '@/lib/games/breakout';
import { Banner, Btn, Panel, Pill, useRecord } from './ui';
import { accentColor, say, setupCanvas, useFrameLoop, useGameKeys } from './arcade';

const ROW_COLORS = ['#f43f5e', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#60a5fa', '#a78bfa', '#e879f9'];

export default function BreakoutGame() {
  const { rec, best } = useRecord('breakout');
  const st = useRef<BreakoutState>(newGame());
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef<number | undefined>(undefined);
  const keys = useRef({ l: false, r: false });
  const color = useRef('#22d3ee');
  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'over'>('ready');
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1 });
  const phaseRef = useRef(phase); phaseRef.current = phase;

  const draw = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const ctx = setupCanvas(c, W, H); if (!ctx) return;
    const s = st.current;
    ctx.clearRect(0, 0, W, H);
    s.bricks.forEach((b) => { if (b.alive) { ctx.fillStyle = ROW_COLORS[b.row % ROW_COLORS.length]; ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2); } });
    ctx.fillStyle = color.current; ctx.fillRect(s.paddle.x - s.paddle.w / 2, PADDLE_Y, s.paddle.w, PADDLE_H);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < s.lives; i++) { ctx.fillStyle = color.current; ctx.fillRect(8 + i * 14, H - 10, 10, 4); }
  }, []);

  const begin = () => { st.current = newGame(); setHud({ score: 0, lives: 3, level: 1 }); setPhase('playing'); phaseRef.current = 'playing'; say('breakout', 'start'); draw(); };
  useEffect(() => { color.current = accentColor(); say('breakout', 'open'); draw(); return () => say('breakout', 'leave'); }, [draw]);

  useFrameLoop((dt) => {
    const s = st.current;
    const k = keys.current;
    if (k.l || k.r) target.current = Math.max(0, Math.min(W, (target.current ?? s.paddle.x) + (k.r ? 1 : -1) * 420 * dt));
    const prevLives = s.lives, prevLevel = s.level;
    const ev = step(s, dt, target.current);
    if (ev.includes('brick') && s.chain >= 4) say('breakout', 'streak', { streak: s.chain });
    if (s.lives < prevLives && !s.over) say('breakout', 'mistake');
    if (s.level > prevLevel) say('breakout', 'level', { level: s.level });
    setHud((h) => (h.score !== s.score || h.lives !== s.lives || h.level !== s.level ? { score: s.score, lives: s.lives, level: s.level } : h));
    draw();
    if (s.over) {
      setPhase('over'); phaseRef.current = 'over';
      say('breakout', 'lose', { score: s.score });
      if (s.score > (rec.best ?? 0) && s.score > 0) say('breakout', 'highscore', { score: s.score });
      best(s.score);
    }
  }, phase === 'playing');

  const point = (clientX: number) => {
    const c = canvas.current; if (!c) return;
    const r = c.getBoundingClientRect();
    target.current = ((clientX - r.left) / r.width) * W;
  };
  const go = () => { if (phaseRef.current === 'ready' || phaseRef.current === 'over') begin(); else if (phaseRef.current === 'playing') launch(st.current); };

  useGameKeys((k) => {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.current.l = true; return true; }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.current.r = true; return true; }
    if (k === ' ' || k === 'Enter') { go(); return true; }
    if (k === 'p' || k === 'P') { setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p)); return true; }
  });
  useEffect(() => {
    const up = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.current.l = false; if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.current.r = false; };
    window.addEventListener('keyup', up);
    return () => window.removeEventListener('keyup', up);
  }, []);

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill label="Score" value={hud.score} tone="accent" /><Pill label="Lives" value={hud.lives} /><Pill label="Level" value={hud.level} /><Pill label="Best" value={rec.best ?? 0} />
        <div className="ml-auto flex gap-2"><Btn icon={phase === 'playing' ? 'clock' : 'play'} onClick={() => (phase === 'playing' || phase === 'paused' ? setPhase(phase === 'playing' ? 'paused' : 'playing') : begin())}>{phase === 'playing' ? 'Pause' : phase === 'paused' ? 'Resume' : 'Start'}</Btn></div>
      </div>
      <div className="relative mx-auto w-full max-w-[360px] touch-none">
        <canvas ref={canvas} role="img" aria-label="Breakout board" onPointerMove={(e) => point(e.clientX)} onPointerDown={(e) => { point(e.clientX); go(); }}
          className="block h-auto w-full cursor-none rounded-xl border border-zinc-800 bg-zinc-950" style={{ aspectRatio: `${W} / ${H}` }} />
        {phase === 'ready' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 px-6 text-center font-mono text-xs text-zinc-300">Move to aim the paddle. Tap or press Space to launch the ball.</div>}
        {phase === 'paused' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 font-mono text-sm text-accent">PAUSED</div>}
      </div>
      {phase === 'over' && <div className="mt-3"><Banner tone="lose" title={`Out of lives with ${hud.score} points`} action={<Btn variant="solid" icon="refresh" onClick={begin}>Play again</Btn>} /></div>}
    </Panel>
  );
}
