// src/components/games/Connect4Game.tsx — Connect Four vs. an alpha-beta AI.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as C from '@/lib/games/connect4';
import { Banner, Btn, Panel, Pill, Record, Segmented, useDefer, useRecord } from './ui';

type LevelId = (typeof C.LEVELS)[number]['id'];

export default function Connect4Game() {
  const { rec, win, loss, draw } = useRecord('connect4');
  const defer = useDefer();
  const [level, setLevel] = useState<LevelId>('medium');
  const [first, setFirst] = useState<'you' | 'ai'>('you');
  const [board, setBoard] = useState<Int8Array>(() => C.newBoard());
  const [turn, setTurn] = useState<1 | 2>(1);
  const [history, setHistory] = useState<Array<{ r: number; c: number; p: number }>>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [line, setLine] = useState<number[] | null>(null);
  const [scores, setScores] = useState<number[] | null>(null);
  const [fresh, setFresh] = useState<number>(-1);
  const token = useRef(0);
  const counted = useRef(false);

  const full = C.isFull(board);
  const winner = line ? board[line[0]] : 0;
  const over = !!line || full;

  const drop = useCallback((col: number, p: 1 | 2, b: Int8Array) => {
    const r = C.dropRow(b, col);
    if (r < 0) return null;
    const nb = new Int8Array(b);
    nb[r * C.COLS + col] = p;
    setBoard(nb); setFresh(r * C.COLS + col); setHistory((h) => [...h, { r, c: col, p }]); setScores(null);
    const wl = C.winLine(nb, r, col);
    if (wl) setLine(wl); else setTurn(p === 1 ? 2 : 1);
    return nb;
  }, []);

  useEffect(() => {
    if (over) return;
    const aiTurn = (first === 'you' ? 2 : 1) === turn;
    if (!aiTurn) return;
    const my = ++token.current;
    setThinking(true);
    const L = C.LEVELS.find((l) => l.id === level)!;
    defer(() => {
      const r = C.bestColumn(board, turn, L.depth, { noise: L.noise });
      if (my !== token.current) return;
      setThinking(false);
      drop(r.col, turn, board);
    }, 380);
    return () => { token.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, over, board, level, first]);

  useEffect(() => {
    if (!over || counted.current) return;
    counted.current = true;
    const me = first === 'you' ? 1 : 2;
    if (!line) draw(); else if (winner === me) win(); else loss();
  }, [over, line, winner, first, win, loss, draw]);

  const yourTurn = !over && !thinking && (first === 'you' ? 1 : 2) === turn;

  const reset = () => { token.current++; setBoard(C.newBoard()); setTurn(1); setHistory([]); setLine(null); setScores(null); setThinking(false); setFresh(-1); counted.current = false; };
  const undo = () => {
    if (!history.length || thinking) return;
    const mine = first === 'you' ? 1 : 2;
    const h = history.slice();
    const nb = new Int8Array(board);
    const m = h.pop()!;
    nb[m.r * C.COLS + m.c] = 0;
    if (m.p !== mine && h.length) { const m2 = h.pop()!; nb[m2.r * C.COLS + m2.c] = 0; } // take back the AI reply too
    token.current++;
    setBoard(nb); setHistory(h); setLine(null); setScores(null); setFresh(-1);
    setTurn(h.length === 0 ? 1 : (mine as 1 | 2));
    counted.current = false;
  };
  const analyse = () => {
    if (!yourTurn) return;
    setThinking(true);
    defer(() => { const r = C.bestColumn(board, turn, 7); setScores(r.scores); setThinking(false); }, 30);
  };

  const play = (c: number) => { if (yourTurn && C.dropRow(board, c) >= 0) drop(c, turn, board); };
  const best = scores ? scores.indexOf(Math.max(...scores)) : -1;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,32rem)_1fr]">
      <div className="space-y-3">
        <div className="rounded-2xl border border-blue-900/60 bg-blue-950/60 p-2 shadow-xl sm:p-3" onMouseLeave={() => setHover(null)}>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label="Connect four board">
            {Array.from({ length: C.COLS }, (_, c) => (
              <div key={c} className="relative">
                <button
                  type="button"
                  aria-label={`Drop in column ${c + 1}`}
                  disabled={!yourTurn || C.dropRow(board, c) < 0}
                  onClick={() => play(c)}
                  onMouseEnter={() => setHover(c)}
                  onFocus={() => setHover(c)}
                  className="group flex w-full cursor-pointer flex-col gap-1 rounded-lg p-0 enabled:hover:bg-white/5 disabled:cursor-default sm:gap-1.5"
                >
                  <span className={`mx-auto h-3 w-3 rounded-full transition-opacity sm:h-4 sm:w-4 ${hover === c && yourTurn ? 'opacity-100' : 'opacity-0'} ${turn === 1 ? 'bg-rose-500' : 'bg-amber-400'}`} />
                  {Array.from({ length: C.ROWS }, (_, r) => {
                    const i = r * C.COLS + c, v = board[i];
                    const inLine = line?.includes(i);
                    return (
                      <span key={r} className="relative block aspect-square w-full rounded-full bg-zinc-950 shadow-inner">
                        {v !== 0 && (
                          <span
                            key={`${i}-${v}`}
                            className={`absolute inset-[6%] rounded-full ${v === 1 ? 'bg-rose-500' : 'bg-amber-400'} ${i === fresh ? 'g-drop' : ''} ${inLine ? 'g-flash ring-2 ring-white' : ''}`}
                            style={{ ['--from' as string]: `${-(r + 1) * 105}%` }}
                          />
                        )}
                      </span>
                    );
                  })}
                </button>
                {scores && Number.isFinite(scores[c]) && (
                  <span className={`absolute -top-5 left-1/2 -translate-x-1/2 rounded px-1 font-mono text-[10px] ${c === best ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-500'}`}>
                    {Math.abs(scores[c]) > 90000 ? (scores[c] > 0 ? 'win' : 'lose') : scores[c]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        {over ? (
          <Banner
            tone={!line ? 'draw' : winner === (first === 'you' ? 1 : 2) ? 'win' : 'lose'}
            title={!line ? 'Draw: the board is full' : winner === (first === 'you' ? 1 : 2) ? 'Four in a row. You win!' : 'The AI connected four'}
            action={<Btn variant="solid" icon="play" onClick={reset}>Play again</Btn>}
          />
        ) : (
          <p className="min-h-6 font-mono text-xs text-zinc-400" role="status" aria-live="polite">{thinking ? <span className="text-accent">AI is thinking…</span> : yourTurn ? <>Your move <span className={turn === 1 ? 'text-rose-400' : 'text-amber-300'}>({turn === 1 ? 'red' : 'gold'})</span></> : ''}</p>
        )}
      </div>
      <Panel className="space-y-4">
        <Segmented label="AI level" value={level} onChange={setLevel} options={C.LEVELS.map((l) => ({ id: l.id, label: l.label }))} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Who starts" value={first} onChange={(v) => { setFirst(v); }} options={[{ id: 'you', label: 'You start' }, { id: 'ai', label: 'AI starts' }]} disabled={history.length > 0 && !over} />
          <Btn variant="solid" icon="refresh" onClick={reset}>New game</Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn icon="lightbulb" onClick={analyse} disabled={!yourTurn} title="Score every column with a 7-move lookahead">Analyse</Btn>
          <Btn icon="undo" onClick={undo} disabled={!history.length || thinking}>Undo</Btn>
        </div>
        <div className="flex flex-wrap gap-2"><Pill label="Moves" value={history.length} /><Pill label="You" value={first === 'you' ? 'Red' : 'Gold'} tone="accent" /></div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">Drop discs and connect four in any direction. The AI uses negamax with alpha-beta pruning and a window-scoring heuristic, looking up to 10 moves ahead on the top level. "Analyse" shows its score for each column.</p>
      </Panel>
    </div>
  );
}
