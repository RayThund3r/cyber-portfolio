// src/components/games/Game2048.tsx — 2048 with undo, an expectimax AI hint and auto-play.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/games/g2048';
import { Banner, Btn, Panel, Pill, useRecord } from './ui';
import { safeLocal } from '@/lib/safeStorage';

const TILE: Record<number, string> = {
  0: 'bg-zinc-800/60 text-transparent',
  2: 'bg-zinc-200 text-zinc-800', 4: 'bg-zinc-300 text-zinc-800',
  8: 'bg-orange-300 text-zinc-900', 16: 'bg-orange-400 text-zinc-900', 32: 'bg-orange-500 text-white', 64: 'bg-red-500 text-white',
  128: 'bg-yellow-300 text-zinc-900', 256: 'bg-yellow-400 text-zinc-900', 512: 'bg-lime-400 text-zinc-900', 1024: 'bg-emerald-400 text-zinc-900', 2048: 'bg-accent text-zinc-950',
};
const ARROW: Record<G.Dir, string> = { left: '←', right: '→', up: '↑', down: '↓' };

export default function Game2048() {
  const { best, rec } = useRecord('g2048');
  const [board, setBoard] = useState<G.Board>(() => Array(16).fill(0));
  const [score, setScore] = useState(0);
  const [stack, setStack] = useState<Array<{ board: G.Board; score: number }>>([]);
  const [hint, setHint] = useState<G.Dir | null>(null);
  const [auto, setAuto] = useState(false);
  const [keepGoing, setKeepGoing] = useState(false);
  const [hiScore, setHiScore] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const dead = !G.canMove(board);
  const won = G.maxTile(board) >= 2048;

  useEffect(() => { setBoard(G.newBoard()); setHiScore(Number(safeLocal.get('sys_2048_best') || 0)); }, []);
  useEffect(() => {
    if (score > hiScore) { setHiScore(score); safeLocal.set('sys_2048_best', String(score)); }
  }, [score, hiScore]);
  useEffect(() => { if (dead && score) best(score); }, [dead, score, best]);

  // Pure transition: no side effects inside a state updater (they would run twice under React strict mode).
  const go = useCallback((dir: G.Dir) => {
    const m = G.move(board, dir);
    if (!m.moved) return;
    setStack((s) => [...s.slice(-30), { board, score }]);
    setScore(score + m.gain);
    setLastGain(m.gain);
    setHint(null);
    setBoard(G.spawn(m.board));
  }, [board, score]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      const map: Record<string, G.Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
      const d = map[e.key];
      if (d) { e.preventDefault(); setAuto(false); go(d); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // auto-play: one AI move at a time so the page stays responsive
  useEffect(() => {
    if (!auto || dead) { if (dead) setAuto(false); return; }
    const id = window.setTimeout(() => { const { dir } = G.bestMove(board, undefined, { timeMs: 35 }); if (dir) go(dir); else setAuto(false); }, 60);
    return () => window.clearTimeout(id);
  }, [auto, board, dead, go]);

  const reset = () => { setBoard(G.newBoard()); setScore(0); setStack([]); setHint(null); setAuto(false); setKeepGoing(false); setLastGain(0); };
  const undo = () => { const s = stack[stack.length - 1]; if (!s) return; setBoard(s.board); setScore(s.score); setStack(stack.slice(0, -1)); setHint(null); setAuto(false); };
  const askHint = () => setHint(G.bestMove(board, undefined, { timeMs: 160 }).dir);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <div className="space-y-3">
        <div
          className="relative aspect-square w-full touch-none select-none rounded-2xl bg-zinc-900 p-2 shadow-xl"
          onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
          onTouchEnd={(e) => {
            const s = touch.current; if (!s) return; const t = e.changedTouches[0]; const dx = t.clientX - s.x, dy = t.clientY - s.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
            setAuto(false); go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
          }}
          role="grid" aria-label="2048 board"
        >
          <div className="grid h-full w-full grid-cols-4 grid-rows-4 gap-2">
            {board.map((v, i) => (
              <div key={i} role="gridcell" aria-label={v ? String(v) : 'empty'} className={`flex items-center justify-center rounded-lg font-mono font-extrabold transition-colors duration-150 ${TILE[v] || 'bg-fuchsia-500 text-white'} ${v >= 1024 ? 'text-[clamp(1rem,6vw,1.8rem)]' : v >= 128 ? 'text-[clamp(1.2rem,7vw,2.2rem)]' : 'text-[clamp(1.4rem,8vw,2.6rem)]'}`}>
                {v ? <span key={`${i}-${v}`} className="g-pop">{v}</span> : ''}
              </div>
            ))}
          </div>
          {hint && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="g-pop rounded-2xl bg-accent/90 px-6 py-3 font-mono text-5xl font-bold text-zinc-950 shadow-2xl">{ARROW[hint]}</span></div>}
        </div>
        {dead ? <Banner tone="lose" title={`Game over. Score ${score}`} text={`Highest tile ${G.maxTile(board)}.`} action={<Btn variant="solid" icon="play" onClick={reset}>Try again</Btn>} />
          : won && !keepGoing ? <Banner tone="win" title="You made 2048!" action={<Btn variant="solid" onClick={() => setKeepGoing(true)}>Keep going</Btn>} />
          : <p className="min-h-6 font-mono text-xs text-zinc-400" role="status" aria-live="polite">{auto ? <span className="text-accent">AI is playing… press any arrow to take over.</span> : 'Swipe or use the arrow keys / WASD.'}</p>}
        <div className="grid grid-cols-3 gap-2 sm:hidden" aria-label="Move buttons">
          {(['up', 'left', 'down', 'right'] as G.Dir[]).map((d) => <Btn key={d} onClick={() => go(d)} className={d === 'up' ? 'col-start-2' : ''}>{ARROW[d]}</Btn>)}
        </div>
      </div>
      <Panel className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Pill label="Score" value={score} tone="accent" />
          <Pill label="Best" value={hiScore} />
          <Pill label="Top tile" value={G.maxTile(board)} />
          {lastGain > 0 && <Pill label="Last merge" value={`+${lastGain}`} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="solid" icon="refresh" onClick={reset}>New game</Btn>
          <Btn icon="undo" onClick={undo} disabled={!stack.length}>Undo</Btn>
          <Btn icon="lightbulb" onClick={askHint} disabled={dead} title="Ask the AI for the best move">AI hint</Btn>
          <Btn active={auto} icon="play" onClick={() => setAuto((a) => !a)} disabled={dead}>{auto ? 'Stop AI' : 'Watch AI play'}</Btn>
        </div>
        <p className="font-mono text-[11px] text-zinc-500">Best scores saved: {rec.best ?? 0}</p>
        <p className="text-[11px] leading-relaxed text-zinc-500">Slide the tiles; equal numbers merge. The AI uses expectimax search: it tries every move, averages over where new tiles could appear, and scores boards by empty space, smoothness, monotonic rows and a locked corner. Watch it chase 1024+.</p>
      </Panel>
    </div>
  );
}
