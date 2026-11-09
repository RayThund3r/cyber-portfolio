// src/components/games/MinesweeperGame.tsx — Minesweeper with a safe first click, chording, flag mode for
// touch screens, and an AI helper that proves safe cells / mines (or picks the safest guess).
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as M from '@/lib/games/minesweeper';
import { Banner, Btn, Panel, Pill, Segmented, fmt, useRecord, useStopwatch } from './ui';
import Icon from '@/components/ui/Icon';

const NUM = ['', 'text-sky-400', 'text-emerald-400', 'text-red-400', 'text-indigo-400', 'text-amber-500', 'text-teal-300', 'text-zinc-100', 'text-zinc-400'];

export default function MinesweeperGame() {
  const { rec, win, loss, time } = useRecord('minesweeper');
  const [preset, setPreset] = useState<M.Preset>('beginner');
  const mk = (p: M.Preset) => M.empty(M.PRESETS[p].rows, M.PRESETS[p].cols, M.PRESETS[p].mines);
  const [b, setB] = useState<M.MsBoard>(() => mk('beginner'));
  const [flagMode, setFlagMode] = useState(false);
  const [hint, setHint] = useState<M.MsHint | null>(null);
  const [aiHelped, setAiHelped] = useState(0);
  const [odds, setOdds] = useState(false);
  const press = useRef<number | null>(null);
  const counted = useRef(false);
  const over = b.lost || b.won;
  // The timer resets only on a NEW game (keyed on a counter), not on every move.
  const [game, setGame] = useState(0);
  const timer = useStopwatch(b.started && !over, game);

  useEffect(() => {
    if (!over || counted.current) return;
    counted.current = true;
    if (b.won) { win(); if (!aiHelped) time(preset, timer); } else loss();
  }, [over, b.won, win, loss, time, preset, timer, aiHelped]);

  const newGame = (p: M.Preset = preset) => { setB(mk(p)); setHint(null); setGame((g) => g + 1); counted.current = false; setAiHelped(0); };
  const open = (i: number) => { setHint(null); setB((x) => (x.cells[i].open ? M.chord(x, i) : M.reveal(x, i))); };
  const flag = (i: number) => setB((x) => M.toggleFlag(x, i));
  const act = (i: number) => (flagMode && !b.cells[i].open ? flag(i) : open(i));

  const askHint = () => { if (!over) setHint(M.solveHint(b)); };
  const applyHint = () => {
    const h = M.solveHint(b);
    setAiHelped((n) => n + 1);
    let nb = b;
    if (h.wrongFlags?.length && !h.safe.length) for (const i of h.wrongFlags) nb = nb.cells[i].flag ? M.toggleFlag(nb, i) : nb;
    else if (h.safe.length) for (const i of h.safe) nb = M.reveal(nb, i);
    else if (h.mines.length) for (const i of h.mines) nb = nb.cells[i].flag ? nb : M.toggleFlag(nb, i);
    else if (h.guess !== undefined) nb = M.reveal(nb, h.guess);
    setB(nb); setHint(null);
  };

  const analysis = useMemo(() => (odds && b.started && !b.lost && !b.won ? M.analyse(b) : null), [odds, b]);
  const cols = b.cols;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,36rem)_1fr]">
      <div className="space-y-3">
        <div className="flex items-center justify-between font-mono text-sm">
          <span className="flex items-center gap-1.5 text-red-400"><Icon name="flag" size={14} /> {M.flagsLeft(b)}</span>
          <button type="button" onClick={() => newGame()} aria-label="New game" className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-accent hover:text-accent">{b.lost ? 'Boom. Retry' : b.won ? 'Cleared! Again' : 'Restart'}</button>
          <span className="tabular-nums text-accent">{fmt(timer)}</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-xl" onContextMenu={(e) => e.preventDefault()}>
          <div className="mx-auto grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 2.6}rem` }} role="grid" aria-label="Minesweeper board">
            {b.cells.map((c, i) => {
              const sugSafe = hint?.safe.includes(i), sugMine = hint?.mines.includes(i), sugGuess = hint?.guess === i, sugWrong = hint?.wrongFlags?.includes(i);
              const pr = analysis && !c.open && !c.flag ? analysis.probs[i] : -1;
              return (
                <button key={i} type="button" role="gridcell"
                  aria-label={c.open ? (c.mine ? 'mine' : c.n ? `${c.n} adjacent` : 'empty') : c.flag ? 'flagged' : 'hidden'}
                  onClick={() => { if (press.current === -1) { press.current = null; return; } act(i); }}
                  onContextMenu={(e) => { e.preventDefault(); flag(i); }}
                  onPointerDown={(e) => { if (e.pointerType === 'touch') press.current = window.setTimeout(() => { flag(i); press.current = -1; }, 420); }}
                  onPointerUp={() => { if (press.current && press.current > 0) window.clearTimeout(press.current); }}
                  onPointerLeave={() => { if (press.current && press.current > 0) window.clearTimeout(press.current); }}
                  className={`flex aspect-square cursor-pointer items-center justify-center rounded-[3px] font-mono text-[clamp(0.7rem,3.4vw,1.15rem)] font-bold leading-none transition-colors ${c.open ? (c.mine ? 'bg-red-600 text-white' : 'bg-zinc-800') : 'bg-zinc-600 hover:bg-zinc-500'} ${sugSafe ? 'ring-2 ring-emerald-400' : sugMine ? 'ring-2 ring-red-400' : sugGuess ? 'ring-2 ring-amber-400' : sugWrong ? 'ring-2 ring-fuchsia-400' : ''} ${NUM[c.n] || ''}`}>
                  {c.open ? (c.mine ? <Icon name="bolt" size={14} /> : c.n || '') : c.flag ? <Icon name="flag" size={13} className="text-red-400" /> : pr >= 0 ? <span className={`text-[clamp(0.45rem,2vw,0.7rem)] font-semibold ${pr <= 0.0001 ? 'text-emerald-300' : pr >= 0.9999 ? 'text-red-300' : pr < 0.25 ? 'text-lime-300' : pr < 0.5 ? 'text-amber-300' : 'text-orange-300'}`}>{pr <= 0.0001 ? '0' : pr >= 0.9999 ? '•' : Math.round(pr * 100)}</span> : ''}
                </button>
              );
            })}
          </div>
        </div>
        {b.won ? <Banner tone="win" title={`Cleared in ${fmt(timer)}!`} text={aiHelped ? 'The AI helped, so this time is not recorded as a best.' : undefined} action={<Btn variant="solid" icon="play" onClick={() => newGame()}>Play again</Btn>} />
          : b.lost ? <Banner tone="lose" title="You hit a mine" action={<Btn variant="solid" icon="play" onClick={() => newGame()}>Try again</Btn>} />
          : <p className="min-h-6 font-mono text-xs text-zinc-400" role="status" aria-live="polite">{hint ? hint.why : flagMode ? 'Flag mode: taps place flags.' : 'Tap to open. Right-click or long-press to flag. Click a number to chord.'}</p>}
      </div>
      <Panel className="space-y-4">
        <Segmented label="Size" value={preset} onChange={(p) => { setPreset(p); newGame(p); }} options={[{ id: 'beginner', label: '9×9' }, { id: 'intermediate', label: '12×12' }, { id: 'expert', label: '16×16' }]} />
        <div className="flex flex-wrap gap-2">
          <Btn active={flagMode} icon="flag" onClick={() => setFlagMode((f) => !f)}>Flag mode</Btn>
          <Btn icon="lightbulb" onClick={askHint} disabled={over || !b.started} title="Show what the AI can prove">AI hint</Btn>
          <Btn active={odds} icon="search" onClick={() => setOdds((o) => !o)} disabled={over || !b.started} title="Show the exact mine chance of every hidden cell">Odds</Btn>
          <Btn icon="brain" onClick={applyHint} disabled={over || !b.started} title="Let the AI make the next move">AI move</Btn>
        </div>
        <div className="flex flex-wrap gap-2"><Pill label="Mines" value={b.mines} /><Pill label="Wins" value={rec.w} tone="accent" />{rec.times?.[preset] !== undefined && <Pill label="Best" value={fmt(rec.times[preset])} />}</div>
        <p className="text-[11px] leading-relaxed text-zinc-500">Your first click is always safe. The AI reasons only from the numbers you can see. It enumerates every arrangement of mines that fits them, combines that with the total mine count and marks what is certain (green = safe, red = mine, purple = a flag that cannot be right). When nothing is certain it points at the cell with the lowest exact mine chance in amber. Turn on Odds to see every cell's chance as a percentage.</p>
      </Panel>
    </div>
  );
}
