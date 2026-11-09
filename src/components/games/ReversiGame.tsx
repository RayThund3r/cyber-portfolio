// src/components/games/ReversiGame.tsx — Reversi/Othello vs. a minimax AI.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as R from '@/lib/games/reversi';
import { Banner, Btn, Panel, Pill, Record, Segmented, useDefer, useRecord } from './ui';

type LevelId = (typeof R.LEVELS)[number]['id'];

export default function ReversiGame() {
  const { rec, win, loss, draw } = useRecord('reversi');
  const defer = useDefer();
  const [level, setLevel] = useState<LevelId>('medium');
  const [board, setBoard] = useState<Int8Array>(() => R.newBoard());
  const [turn, setTurn] = useState<1 | -1>(1); // you = black (1)
  const [flipped, setFlipped] = useState<number[]>([]);
  const [last, setLast] = useState(-1);
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState('');
  const [hint, setHint] = useState(-1);
  const [stack, setStack] = useState<Array<{ board: Int8Array; turn: 1 | -1 }>>([]);
  const token = useRef(0);
  const counted = useRef(false);

  const mine = useMemo(() => R.legalMoves(board, 1), [board]);
  const theirs = useMemo(() => R.legalMoves(board, -1), [board]);
  const over = !mine.length && !theirs.length;
  const { black, white } = R.count(board);

  // pass handling
  useEffect(() => {
    if (over) return;
    const moves = turn === 1 ? mine : theirs;
    if (!moves.length) {
      setNotice(turn === 1 ? 'You have no legal move: passing.' : 'AI has no legal move: it passes.');
      const t = window.setTimeout(() => setTurn((x) => (x === 1 ? -1 : 1)), 900);
      return () => window.clearTimeout(t);
    }
    setNotice('');
  }, [turn, mine, theirs, over]);

  // AI move
  useEffect(() => {
    if (over || turn !== -1 || !theirs.length) return;
    const my = ++token.current;
    setThinking(true);
    const L = R.LEVELS.find((l) => l.id === level)!;
    defer(() => {
      const r = R.bestMove(board, -1, L.depth, { noise: L.noise });
      if (my !== token.current) return;
      setThinking(false);
      if (r.move !== null) { const a = R.apply(board, r.move, -1); setBoard(a.board); setFlipped(a.flipped); setLast(r.move); setTurn(1); setHint(-1); }
    }, 420);
    return () => { token.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, over, level, board]);

  useEffect(() => {
    if (!over || counted.current) return;
    counted.current = true;
    if (black > white) win(); else if (white > black) loss(); else draw();
  }, [over, black, white, win, loss, draw]);

  const click = (i: number) => {
    if (over || turn !== 1 || thinking || !mine.includes(i)) return;
    setStack((s) => [...s, { board, turn }]);
    const a = R.apply(board, i, 1);
    setBoard(a.board); setFlipped(a.flipped); setLast(i); setTurn(-1); setHint(-1);
  };
  const reset = () => { token.current++; setBoard(R.newBoard()); setTurn(1); setFlipped([]); setLast(-1); setStack([]); setThinking(false); setNotice(''); setHint(-1); counted.current = false; };
  const undo = () => {
    if (!stack.length || thinking) return;
    const s = stack[stack.length - 1];
    token.current++; setBoard(s.board); setTurn(s.turn); setStack(stack.slice(0, -1)); setFlipped([]); setLast(-1); counted.current = false; setHint(-1);
  };
  const askHint = () => {
    if (turn !== 1 || thinking || over) return;
    setThinking(true);
    defer(() => { const r = R.bestMove(board, 1, 5); setThinking(false); if (r.move !== null) setHint(r.move); }, 30);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,32rem)_1fr]">
      <div className="space-y-3">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="flex items-center gap-2 text-zinc-200"><span className="h-4 w-4 rounded-full bg-zinc-900 ring-1 ring-zinc-500" /> You {black}</span>
          <span className="flex items-center gap-2 text-zinc-200">AI {white} <span className="h-4 w-4 rounded-full bg-zinc-100" /></span>
        </div>
        <div className="aspect-square w-full overflow-hidden rounded-xl border-2 border-emerald-950 bg-emerald-900 p-1 shadow-xl" role="grid" aria-label="Reversi board">
          <div className="grid h-full w-full grid-cols-8 grid-rows-8 gap-[2px]">
            {Array.from({ length: 64 }, (_, i) => {
              const v = board[i];
              const legal = turn === 1 && !thinking && mine.includes(i);
              return (
                <button key={i} type="button" role="gridcell" onClick={() => click(i)} aria-label={`Row ${(i >> 3) + 1}, column ${(i & 7) + 1}${v ? (v === 1 ? ', your disc' : ', AI disc') : legal ? ', legal move' : ''}`}
                  className={`relative flex items-center justify-center bg-emerald-700 ${legal ? 'cursor-pointer hover:bg-emerald-600' : 'cursor-default'} ${i === last ? 'ring-2 ring-inset ring-accent' : ''} ${hint === i ? 'ring-2 ring-inset ring-amber-300' : ''}`}>
                  {v !== 0 && (
                    <span key={`${i}-${v}`} className={`${flipped.includes(i) || i === last ? 'g-pop' : ''} h-[78%] w-[78%] rounded-full shadow-md ${v === 1 ? 'bg-zinc-900 ring-1 ring-zinc-600' : 'bg-zinc-100'}`} />
                  )}
                  {v === 0 && legal && <span className="h-[22%] w-[22%] rounded-full bg-black/30" />}
                </button>
              );
            })}
          </div>
        </div>
        {over ? (
          <Banner tone={black > white ? 'win' : white > black ? 'lose' : 'draw'} title={black > white ? `You win ${black}–${white}!` : white > black ? `AI wins ${white}–${black}` : `Draw ${black}–${white}`} action={<Btn variant="solid" icon="play" onClick={reset}>Play again</Btn>} />
        ) : (
          <p className="min-h-6 font-mono text-xs text-zinc-400" role="status" aria-live="polite">{notice || (thinking ? <span className="text-accent">AI is thinking…</span> : turn === 1 ? 'Your move (black).' : '')}</p>
        )}
      </div>
      <Panel className="space-y-4">
        <Segmented label="AI level" value={level} onChange={setLevel} options={R.LEVELS.map((l) => ({ id: l.id, label: l.label }))} />
        <div className="flex flex-wrap gap-2">
          <Btn variant="solid" icon="refresh" onClick={reset}>New game</Btn>
          <Btn icon="lightbulb" onClick={askHint} disabled={turn !== 1 || thinking || over}>Hint</Btn>
          <Btn icon="undo" onClick={undo} disabled={!stack.length || thinking}>Undo</Btn>
        </div>
        <div className="flex flex-wrap gap-2"><Pill label="Your moves" value={mine.length} tone="accent" /><Pill label="AI moves" value={theirs.length} /></div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">Place a disc so it traps a line of the AI's discs between your new disc and another of yours; they all flip. Corners are gold. The AI weighs square value, mobility and corners, and solves the final moves exactly.</p>
      </Panel>
    </div>
  );
}
