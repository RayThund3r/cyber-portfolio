// src/components/games/PongGame.tsx — Pong against an AI that predicts the bounce (four difficulty levels). First to 7.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mulberry32 } from '@/lib/games/rng';
import { H, PH, PW, W, WIN_SCORE, newGame, step, type Difficulty, type PongState } from '@/lib/games/pong';
import { Banner, Btn, Panel, Pill, Segmented, useRecord } from './ui';
import { accentColor, say, setupCanvas, useFrameLoop, useGameKeys } from './arcade';

export default function PongGame() {
  const { rec, win, loss } = useRecord('pong');
  const [level, setLevel] = useState<Difficulty>('medium');
  const rng = useRef(mulberry32((Date.now() & 0xffffff) | 1));
  const st = useRef<PongState>(newGame('medium', rng.current));
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef<number | undefined>(undefined);
  const dir = useRef(0);
  const color = useRef('#22d3ee');
  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'over'>('ready');
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [won, setWon] = useState<boolean | null>(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;

  const draw = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const ctx = setupCanvas(c, W, H); if (!ctx) return;
    const s = st.current;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(113,113,122,.35)'; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = color.current; ctx.fillRect(10, s.player - PH / 2, PW, PH);
    ctx.fillStyle = '#e4e4e7'; ctx.fillRect(W - 10 - PW, s.ai - PH / 2, PW, PH);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, 6, 0, Math.PI * 2); ctx.fill();
  }, []);

  const begin = useCallback((lv: Difficulty = level) => {
    st.current = newGame(lv, rng.current); setScore({ player: 0, ai: 0 }); setWon(null);
    setPhase('playing'); phaseRef.current = 'playing'; say('pong', 'start'); draw();
  }, [draw, level]);

  useEffect(() => { color.current = accentColor(); say('pong', 'open'); draw(); return () => say('pong', 'leave'); }, [draw]);
  useEffect(() => { if (phaseRef.current !== 'playing') { st.current = newGame(level, rng.current); draw(); } }, [level, draw]);

  useFrameLoop((dt) => {
    const s = st.current;
    const ev = step(s, dt, { target: target.current, dir: dir.current }, rng.current);
    if (ev.length) {
      setScore({ player: s.score.player, ai: s.score.ai });
      if (ev.includes('player-score')) say('pong', 'good', { score: s.score.player });
      if (ev.includes('ai-score')) say('pong', 'mistake', { score: s.score.ai });
      if (s.rallies >= 8 && ev.includes('hit')) say('pong', 'streak', { streak: s.rallies });
    }
    draw();
    if (s.over) {
      const w = s.score.player > s.score.ai;
      setWon(w); setPhase('over'); phaseRef.current = 'over';
      if (w) { win(); say('pong', 'win', { score: s.score.player }); } else { loss(); say('pong', 'lose', { score: s.score.player }); }
    }
  }, phase === 'playing');

  const point = (clientY: number) => { const c = canvas.current; if (!c) return; const r = c.getBoundingClientRect(); target.current = ((clientY - r.top) / r.height) * H; dir.current = 0; };
  useGameKeys((k) => {
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { dir.current = -1; target.current = undefined; return true; }
    if (k === 'ArrowDown' || k === 's' || k === 'S') { dir.current = 1; target.current = undefined; return true; }
    if (k === ' ' || k === 'Enter') { if (phaseRef.current !== 'playing') begin(); return true; }
    if (k === 'p' || k === 'P') { setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p)); return true; }
  });
  useEffect(() => {
    const up = (e: KeyboardEvent) => { if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(e.key)) dir.current = 0; };
    window.addEventListener('keyup', up);
    return () => window.removeEventListener('keyup', up);
  }, []);

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill label="You" value={score.player} tone="accent" /><Pill label="AI" value={score.ai} /><Pill label="First to" value={WIN_SCORE} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented label="Difficulty" value={level} onChange={setLevel} disabled={phase === 'playing'} options={[{ id: 'easy', label: 'Easy' }, { id: 'medium', label: 'Medium' }, { id: 'hard', label: 'Hard' }, { id: 'insane', label: 'Insane' }]} />
          <Btn icon={phase === 'playing' ? 'clock' : 'play'} onClick={() => (phase === 'playing' || phase === 'paused' ? setPhase(phase === 'playing' ? 'paused' : 'playing') : begin())}>{phase === 'playing' ? 'Pause' : phase === 'paused' ? 'Resume' : 'Start'}</Btn>
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-[520px] touch-none">
        <canvas ref={canvas} role="img" aria-label="Pong court" onPointerMove={(e) => point(e.clientY)} onPointerDown={(e) => point(e.clientY)}
          className="block h-auto w-full rounded-xl border border-zinc-800 bg-zinc-950" style={{ aspectRatio: `${W} / ${H}` }} />
        {phase === 'ready' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 px-6 text-center font-mono text-xs text-zinc-300">Drag or move up and down to steer your paddle. Press Start.</div>}
        {phase === 'paused' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 font-mono text-sm text-accent">PAUSED</div>}
      </div>
      {phase === 'over' && won !== null && <div className="mt-3"><Banner tone={won ? 'win' : 'lose'} title={won ? 'You win!' : 'The AI wins this one'} text={`${score.player} to ${score.ai} on ${level}.`} action={<Btn variant="solid" icon="refresh" onClick={() => begin()}>Rematch</Btn>} /></div>}
      <p className="mt-3 font-mono text-[11px] text-zinc-500">Record: <span className="text-emerald-400">{rec.w}W</span> · <span className="text-red-400">{rec.l}L</span></p>
    </Panel>
  );
}
