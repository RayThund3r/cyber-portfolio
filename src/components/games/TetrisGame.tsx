// src/components/games/TetrisGame.tsx — Tetris: 7-bag, ghost piece, hold, next queue, levels. Keys, swipe-free touch buttons.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mulberry32 } from '@/lib/games/rng';
import { COLS, ROWS, cellsOf, gravityMs, ghostY, hardDrop, holdPiece, matrixFor, move, newGame, rotate, softDrop, tick, type PieceId, type TetrisState } from '@/lib/games/tetris';
import { Banner, Btn, Panel, Pill, useRecord } from './ui';
import Icon from '@/components/ui/Icon';
import { PadButton, Arrow, say, setupCanvas, useFrameLoop, useGameKeys } from './arcade';

const CELL = 24, SIDE = 96, CW = COLS * CELL + SIDE, CH = ROWS * CELL;
const COLORS = ['', '#22d3ee', '#facc15', '#a78bfa', '#4ade80', '#f87171', '#60a5fa', '#fb923c'];

function drawPiece(ctx: CanvasRenderingContext2D, t: PieceId, ox: number, oy: number, size: number, alpha = 1) {
  const m = matrixFor(t, 0);
  const id = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(t) + 1;
  ctx.globalAlpha = alpha; ctx.fillStyle = COLORS[id];
  m.forEach((row, r) => row.forEach((v, c) => { if (v) ctx.fillRect(ox + c * size + 1, oy + r * size + 1, size - 2, size - 2); }));
  ctx.globalAlpha = 1;
}

export default function TetrisGame() {
  const { rec, best } = useRecord('tetris');
  const rng = useRef(mulberry32((Date.now() & 0xffffff) | 1));
  const st = useRef<TetrisState>(newGame(rng.current));
  const acc = useRef(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'over'>('ready');
  const [hud, setHud] = useState({ score: 0, lines: 0, level: 1 });
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const lastLevel = useRef(1);

  const draw = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const ctx = setupCanvas(c, CW, CH); if (!ctx) return;
    const s = st.current;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = 'rgba(9,9,11,.9)'; ctx.fillRect(0, 0, COLS * CELL, CH);
    ctx.strokeStyle = 'rgba(113,113,122,.12)';
    for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, CH); ctx.stroke(); }
    for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke(); }
    s.board.forEach((row, y) => row.forEach((v, x) => { if (v) { ctx.fillStyle = COLORS[v]; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2); } }));
    if (!s.over) {
      const gy = ghostY(s);
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#fff';
      cellsOf({ ...s.cur, y: gy }).forEach(([x, y]) => { if (y >= 0) ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4); });
      ctx.globalAlpha = 1;
      const id = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(s.cur.t) + 1;
      ctx.fillStyle = COLORS[id];
      cellsOf(s.cur).forEach(([x, y]) => { if (y >= 0) ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2); });
    }
    ctx.fillStyle = '#a1a1aa'; ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('HOLD', COLS * CELL + 12, 16);
    if (s.hold) drawPiece(ctx, s.hold, COLS * CELL + 12, 24, 14, s.canHold ? 1 : 0.35);
    ctx.fillText('NEXT', COLS * CELL + 12, 104);
    s.next.slice(0, 3).forEach((t, i) => drawPiece(ctx, t, COLS * CELL + 12, 112 + i * 52, 14));
  }, []);

  const sync = (s: TetrisState) => { setHud({ score: s.score, lines: s.lines, level: s.level }); };
  const afterLock = (s: TetrisState) => {
    if (s.lastClear >= 4) say('tetris', 'good', { score: s.score }); else if (s.lastClear >= 2) say('tetris', 'good', { score: s.score });
    if (s.combo >= 3) say('tetris', 'streak', { streak: s.combo });
    if (s.level > lastLevel.current) { lastLevel.current = s.level; say('tetris', 'level', { level: s.level }); }
    if (s.over) {
      setPhase('over'); phaseRef.current = 'over';
      say('tetris', 'lose', { score: s.score, level: s.level });
      if (s.score > (rec.best ?? 0) && s.score > 0) say('tetris', 'highscore', { score: s.score });
      best(s.score);
    }
  };
  const apply = (n: TetrisState, locked = false) => { st.current = n; if (locked) afterLock(n); sync(n); draw(); };

  const start = () => { st.current = newGame(rng.current); lastLevel.current = 1; acc.current = 0; setPhase('playing'); phaseRef.current = 'playing'; sync(st.current); draw(); say('tetris', 'start'); };
  const toggle = () => { if (phaseRef.current === 'playing') { setPhase('paused'); } else if (phaseRef.current === 'paused') setPhase('playing'); else if (phaseRef.current === 'ready' || phaseRef.current === 'over') start(); };

  useEffect(() => { say('tetris', 'open'); draw(); return () => say('tetris', 'leave'); }, [draw]);

  useFrameLoop((dt) => {
    acc.current += dt * 1000;
    const g = gravityMs(st.current.level);
    let guard = 0;
    while (acc.current >= g && guard++ < 4) { acc.current -= g; const r = tick(st.current, rng.current); apply(r.state, r.locked); if (r.state.over) break; }
    draw();
  }, phase === 'playing');

  const act = (fn: () => void) => { if (phaseRef.current === 'playing') fn(); };
  const left = () => act(() => apply(move(st.current, -1)));
  const right = () => act(() => apply(move(st.current, 1)));
  const rot = () => act(() => apply(rotate(st.current, 1)));
  const rotBack = () => act(() => apply(rotate(st.current, -1)));
  const soft = () => act(() => { const r = softDrop(st.current, rng.current); apply(r.state, r.locked); });
  const drop = () => act(() => { const n = hardDrop(st.current, rng.current); apply(n, true); });
  const hold = () => act(() => apply(holdPiece(st.current, rng.current)));

  useGameKeys((k) => {
    if (k === 'ArrowLeft') { left(); return true; }
    if (k === 'ArrowRight') { right(); return true; }
    if (k === 'ArrowUp' || k === 'x' || k === 'X') { rot(); return true; }
    if (k === 'z' || k === 'Z') { rotBack(); return true; }
    if (k === 'ArrowDown') { soft(); return true; }
    if (k === ' ') { if (phaseRef.current === 'playing') drop(); else toggle(); return true; }
    if (k === 'c' || k === 'C' || k === 'Shift') { hold(); return true; }
    if (k === 'p' || k === 'P' || k === 'Escape') { if (phaseRef.current === 'playing' || phaseRef.current === 'paused') toggle(); return true; }
    if (k === 'Enter' && (phaseRef.current === 'ready' || phaseRef.current === 'over')) { start(); return true; }
  });

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill label="Score" value={hud.score} tone="accent" /><Pill label="Lines" value={hud.lines} /><Pill label="Level" value={hud.level} /><Pill label="Best" value={rec.best ?? 0} />
        <div className="ml-auto flex gap-2">
          <Btn icon={phase === 'playing' ? 'clock' : 'play'} onClick={toggle}>{phase === 'playing' ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'over' ? 'Again' : 'Start'}</Btn>
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-[336px]">
        <canvas ref={canvas} role="img" aria-label="Tetris board" className="block h-auto w-full rounded-xl border border-zinc-800 bg-zinc-950" style={{ aspectRatio: `${CW} / ${CH}` }} />
        {phase === 'paused' && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 font-mono text-sm text-accent">PAUSED</div>}
        {phase === 'ready' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/55"><Btn variant="solid" icon="play" onClick={start}>Start</Btn><p className="px-6 text-center font-mono text-[11px] text-zinc-400">Arrows move, Up rotates, Space drops, C holds.</p></div>}
      </div>
      {phase === 'over' && <div className="mt-3"><Banner tone="lose" title={`Stacked out at level ${hud.level}`} text={`${hud.score} points, ${hud.lines} lines.`} action={<Btn variant="solid" icon="refresh" onClick={start}>Play again</Btn>} /></div>}
      <div className="mx-auto mt-4 flex max-w-[336px] flex-wrap justify-center gap-2 md:hidden" aria-label="On-screen controls">
        <PadButton label="Left" hold onPress={left}><Arrow dir="L" /></PadButton>
        <PadButton label="Rotate" onPress={rot}><Icon name="refresh" size={20} /></PadButton>
        <PadButton label="Right" hold onPress={right}><Arrow dir="R" /></PadButton>
        <PadButton label="Soft drop" hold onPress={soft}><Arrow dir="D" /></PadButton>
        <PadButton label="Hard drop" onPress={drop} className="px-3">DROP</PadButton>
        <PadButton label="Hold piece" onPress={hold} className="px-3">HOLD</PadButton>
      </div>
    </Panel>
  );
}
