// src/components/games/TicTacToeGame.tsx — Tic-Tac-Toe vs. a minimax AI (unbeatable on "Perfect").
'use client';

import { useEffect, useRef, useState } from 'react';
import * as T from '@/lib/games/tictactoe';
import { Banner, Btn, Panel, Pill, Record, Segmented, useDefer, useRecord } from './ui';

export default function TicTacToeGame() {
  const { rec, win, loss, draw } = useRecord('tictactoe');
  const defer = useDefer();
  const [level, setLevel] = useState<T.TttLevel>('medium');
  const [mark, setMark] = useState<'X' | 'O'>('X');
  const [board, setBoard] = useState<T.Mark[]>(() => Array(9).fill('') as T.Mark[]);
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState(-1);
  const counted = useRef(false);
  const ai = mark === 'X' ? 'O' : 'X';
  const w = T.winner(board);
  const over = !!w || T.full(board);

  useEffect(() => {
    if (over || turn !== ai) return;
    setThinking(true);
    defer(() => {
      const m = T.aiMove(board.slice(), ai, level);
      setBoard((b) => b.map((v, i) => (i === m ? ai : v)) as T.Mark[]);
      setTurn(mark); setThinking(false); setHint(-1);
    }, 420);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, over, ai]);

  useEffect(() => {
    if (!over || counted.current) return;
    counted.current = true;
    if (!w) draw(); else if (w.mark === mark) win(); else loss();
  }, [over, w, mark, win, loss, draw]);

  const reset = (m: 'X' | 'O' = mark) => { setBoard(Array(9).fill('') as T.Mark[]); setTurn('X'); setThinking(false); setHint(-1); counted.current = false; setMark(m); };
  const click = (i: number) => { if (over || thinking || turn !== mark || board[i]) return; setBoard((b) => b.map((v, k) => (k === i ? mark : v)) as T.Mark[]); setTurn(ai); setHint(-1); };
  const askHint = () => { if (over || turn !== mark) return; const sc = T.moveScores(board.slice(), mark); const best = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]; if (best) setHint(Number(best[0])); };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div className="space-y-3">
        <div className="grid aspect-square w-full grid-cols-3 gap-2" role="grid" aria-label="Tic-tac-toe board">
          {board.map((v, i) => (
            <button key={i} type="button" role="gridcell" onClick={() => click(i)} aria-label={`Square ${i + 1}${v ? ', ' + v : ''}`} disabled={!!v || over}
              className={`flex cursor-pointer items-center justify-center rounded-xl border bg-zinc-900/70 font-mono text-[clamp(2.5rem,16vw,5rem)] font-bold leading-none transition disabled:cursor-default ${w?.line.includes(i) ? 'g-flash border-accent bg-accent/15' : hint === i ? 'border-amber-400' : 'border-zinc-700 enabled:hover:border-accent/60'} ${v === 'X' ? 'text-accent' : 'text-amber-300'}`}>
              {v && <span key={v + i} className="g-pop">{v}</span>}
            </button>
          ))}
        </div>
        {over ? (
          <Banner tone={!w ? 'draw' : w.mark === mark ? 'win' : 'lose'} title={!w ? 'Draw' : w.mark === mark ? 'You win!' : 'The AI wins'} text={!w && level === 'perfect' ? 'A draw is the best anyone can get against perfect play.' : undefined} action={<Btn variant="solid" icon="play" onClick={() => reset()}>Play again</Btn>} />
        ) : (
          <p className="min-h-6 font-mono text-xs text-zinc-400" role="status" aria-live="polite">{thinking ? <span className="text-accent">AI is thinking…</span> : turn === mark ? `Your move (${mark}).` : ''}</p>
        )}
      </div>
      <Panel className="space-y-4">
        <Segmented label="AI level" value={level} onChange={setLevel} options={[{ id: 'easy', label: 'Easy' }, { id: 'medium', label: 'Medium' }, { id: 'perfect', label: 'Perfect' }]} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Your mark" value={mark} onChange={(m) => reset(m)} options={[{ id: 'X', label: 'X (first)' }, { id: 'O', label: 'O (second)' }]} />
          <Btn variant="solid" icon="refresh" onClick={() => reset()}>New game</Btn>
          <Btn icon="lightbulb" onClick={askHint} disabled={over || turn !== mark}>Hint</Btn>
        </div>
        <div className="flex gap-2"><Pill label="You" value={mark} tone="accent" /><Pill label="AI" value={ai} /></div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">On "Perfect" the AI searches the entire game tree: the best you can do is draw. Medium and Easy make human-looking mistakes.</p>
      </Panel>
    </div>
  );
}
