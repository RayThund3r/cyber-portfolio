// src/components/games/GomokuGame.tsx — Gomoku (five in a row, 15×15) vs. a threat-aware alpha-beta AI.
'use client';

import { useEffect, useRef, useState } from 'react';
import * as G from '@/lib/games/gomoku';
import { Banner, Btn, Panel, Pill, Record, Segmented, useDefer, useRecord } from './ui';

export default function GomokuGame() {
  const { rec, win, loss, draw } = useRecord('gomoku');
  const defer = useDefer();
  const [level, setLevel] = useState<G.GLevel>('medium');
  const [mine, setMine] = useState<G.Stone>(1);
  const [board, setBoard] = useState<Int8Array>(() => G.emptyBoard());
  const [turn, setTurn] = useState<G.Stone>(1);
  const [last, setLast] = useState(-1);
  const [line, setLine] = useState<number[] | null>(null);
  const [full, setFull] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState(-1);
  const [info, setInfo] = useState('');
  const counted = useRef(false);
  const over = !!line || full;

  const place = (i: number, side: G.Stone) => {
    const nb = new Int8Array(board); nb[i] = side;
    const wl = G.winLine(nb, i);
    setBoard(nb); setLast(i); setHint(-1);
    if (wl) setLine(wl);
    else if (!nb.includes(0)) setFull(true);
    else setTurn((-side) as G.Stone);
  };

  useEffect(() => {
    if (over || turn === mine) return;
    setThinking(true);
    const L = G.LEVELS.find((l) => l.id === level)!;
    defer(() => {
      const r = G.aiMove(board, turn, { maxDepth: L.depth, timeMs: L.timeMs, noise: L.noise });
      setThinking(false);
      setInfo(`depth ${r.depth} · ${r.nodes.toLocaleString()} nodes`);
      place(r.move, turn);
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, over, mine]);

  useEffect(() => {
    if (!over || counted.current) return;
    counted.current = true;
    if (!line) draw();
    else if (board[line[0]] === mine) win(); else loss();
  }, [over, line, board, mine, win, loss, draw]);

  const reset = (side: G.Stone = mine) => { setBoard(G.emptyBoard()); setTurn(1); setLast(-1); setLine(null); setFull(false); setThinking(false); setHint(-1); setInfo(''); counted.current = false; setMine(side); };
  const click = (i: number) => { if (over || thinking || turn !== mine || board[i]) return; place(i, mine); };
  const askHint = () => { if (over || turn !== mine) return; const r = G.aiMove(board, mine, { maxDepth: 4, timeMs: 700, noise: 0 }); setHint(r.move); };

  const winSet = new Set(line ?? []);
  const iWon = line ? board[line[0]] === mine : false;
  const stones = board.reduce((n, v) => n + (v ? 1 : 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,40rem)_1fr]">
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/80 p-1" role="grid" aria-label="Gomoku board">
          <div className="grid aspect-square w-full" style={{ gridTemplateColumns: `repeat(${G.N}, 1fr)` }}>
            {Array.from(board).map((v, i) => {
              const r = Math.floor(i / G.N), c = i % G.N;
              return (
                <button key={i} type="button" role="gridcell" onClick={() => click(i)} disabled={!!v || over}
                  aria-label={`Row ${r + 1}, column ${c + 1}${v ? (v === 1 ? ', black' : ', white') : ''}`}
                  className={`relative flex items-center justify-center ${!v && !over && turn === mine ? 'cursor-pointer hover:bg-accent/10' : 'cursor-default'}`}>
                  <span className="absolute left-0 right-0 top-1/2 h-px bg-zinc-700/80" style={{ left: c === 0 ? '50%' : 0, right: c === G.N - 1 ? '50%' : 0 }} />
                  <span className="absolute bottom-0 top-0 left-1/2 w-px bg-zinc-700/80" style={{ top: r === 0 ? '50%' : 0, bottom: r === G.N - 1 ? '50%' : 0 }} />
                  {v !== 0 && <span className={`g-pop relative h-[78%] w-[78%] rounded-full shadow ${v === 1 ? 'bg-zinc-950 ring-1 ring-zinc-500' : 'bg-zinc-100'} ${winSet.has(i) ? 'g-flash outline outline-2 outline-accent' : ''} ${last === i ? 'outline outline-2 outline-amber-400' : ''}`} />}
                  {!v && hint === i && <span className="relative h-1/2 w-1/2 rounded-full border-2 border-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>
        {over ? (
          <Banner tone={!line ? 'draw' : iWon ? 'win' : 'lose'} title={!line ? 'Draw — the board is full' : iWon ? 'Five in a row — you win!' : 'The AI made five'} action={<Btn variant="solid" icon="play" onClick={() => reset()}>Play again</Btn>} />
        ) : (
          <p className="min-h-6 font-mono text-xs text-zinc-400" role="status" aria-live="polite">{thinking ? <span className="text-accent">AI is thinking…</span> : turn === mine ? 'Your move.' : ''} {info && !thinking ? <span className="text-zinc-500">{info}</span> : null}</p>
        )}
      </div>
      <Panel className="space-y-4">
        <Segmented label="AI level" value={level} onChange={setLevel} options={G.LEVELS.map((l) => ({ id: l.id, label: l.label }))} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Your stones" value={mine === 1 ? 'b' : 'w'} onChange={(v) => reset(v === 'b' ? 1 : -1)} options={[{ id: 'b', label: 'Black (first)' }, { id: 'w', label: 'White' }]} />
          <Btn variant="solid" icon="refresh" onClick={() => reset()}>New game</Btn>
          <Btn icon="lightbulb" onClick={askHint} disabled={over || turn !== mine}>Hint</Btn>
        </div>
        <div className="flex gap-2"><Pill label="Stones" value={stones} tone="accent" /><Pill label="Goal" value="5 in a row" /></div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">Free-style rules: any line of five or more wins. The AI evaluates open threes and fours, always takes or blocks a five, and looks several moves deep on the higher levels. Black moves first and has the edge, so try White on Grandmaster for a real fight.</p>
      </Panel>
    </div>
  );
}
