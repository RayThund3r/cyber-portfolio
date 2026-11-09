// src/components/games/CheckersGame.tsx — Checkers (English draughts) vs. an alpha-beta AI.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as K from '@/lib/games/checkers';
import { Banner, Btn, Panel, Pill, Record, Segmented, useDefer, useRecord } from './ui';

export default function CheckersGame() {
  const { rec, win, loss, draw } = useRecord('checkers');
  const defer = useDefer();
  const [level, setLevel] = useState<K.CLevel>('medium');
  const [mine, setMine] = useState<K.Side>(1);
  const [state, setState] = useState<K.CState>(() => K.initial());
  const [sel, setSel] = useState(-1);
  const [last, setLast] = useState<K.CMove | null>(null);
  const [thinking, setThinking] = useState(false);
  const [info, setInfo] = useState('');
  const [hint, setHint] = useState<K.CMove | null>(null);
  const counted = useRef(false);

  const moves = useMemo(() => K.legalMoves(state), [state]);
  const res = K.result(state, moves);
  const over = res !== 'ongoing';
  const myTurn = state.turn === mine && !over;
  const cnt = K.count(state);
  const mustJump = moves.length > 0 && moves[0].captured.length > 0;
  const movable = useMemo(() => new Set(moves.map((m) => m.from)), [moves]);
  const targets = useMemo(() => moves.filter((m) => m.from === sel), [moves, sel]);

  useEffect(() => {
    if (over || state.turn === mine) return;
    setThinking(true);
    const L = K.LEVELS.find((l) => l.id === level)!;
    defer(() => {
      const r = K.bestMove(state, { maxDepth: L.depth, timeMs: L.timeMs, noise: L.noise });
      setThinking(false);
      if (r.move) {
        setLast(r.move); setState(K.apply(state, r.move));
        setInfo(`AI ${K.moveText(r.move)} · depth ${r.depth} · ${r.nodes.toLocaleString()} nodes`);
      }
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, over, mine]);

  useEffect(() => {
    if (!over || counted.current) return;
    counted.current = true;
    if (res === 'draw') draw();
    else if ((res === 'red') === (mine === 1)) win();
    else loss();
  }, [over, res, mine, win, loss, draw]);

  const reset = (side: K.Side = mine) => { setState(K.initial()); setSel(-1); setLast(null); setThinking(false); setInfo(''); setHint(null); counted.current = false; setMine(side); };
  const click = (i: number) => {
    if (!myTurn || thinking) return;
    const t = targets.find((m) => m.to === i);
    if (t) { setLast(t); setState(K.apply(state, t)); setSel(-1); setHint(null); return; }
    setSel(movable.has(i) ? i : -1);
  };
  const askHint = () => {
    if (!myTurn) return;
    const r = K.bestMove(state, { maxDepth: 10, timeMs: 900, noise: 0 });
    if (r.move) { setHint(r.move); setSel(r.move.from); }
  };

  const rows = mine === 1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = mine === 1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const winner = res === 'draw' ? 'draw' : (res === 'red') === (mine === 1) ? 'me' : 'ai';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,34rem)_1fr]">
      <div className="space-y-3">
        <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl border border-zinc-700" role="grid" aria-label="Checkers board">
          {rows.flatMap((r) => cols.map((c) => {
            const i = r * 8 + c, p = state.board[i], dark = K.isDark(i);
            const isTarget = targets.some((m) => m.to === i);
            const isHint = hint && (hint.from === i || hint.to === i);
            const isLast = last && (last.from === i || last.to === i);
            return (
              <button key={i} type="button" role="gridcell" disabled={!dark} onClick={() => click(i)}
                aria-label={`${K.sqName(i)}${p ? (p > 0 ? ' red' : ' black') + (Math.abs(p) === 2 ? ' king' : ' man') : ''}${isTarget ? ', can move here' : ''}`}
                className={`relative flex items-center justify-center ${dark ? 'bg-zinc-800' : 'bg-zinc-900/60'} ${isLast ? 'ring-1 ring-inset ring-accent/50' : ''} ${isHint ? 'ring-2 ring-inset ring-amber-400' : ''} ${dark && myTurn ? 'cursor-pointer' : 'cursor-default'}`}>
                {isTarget && <span className="absolute h-1/4 w-1/4 rounded-full bg-accent/70" />}
                {p !== 0 && (
                  <span className={`g-pop flex h-[78%] w-[78%] items-center justify-center rounded-full border-2 text-[clamp(0.6rem,3vw,1.1rem)] font-bold shadow-lg transition ${p > 0 ? 'border-red-300 bg-red-600 text-red-100' : 'border-zinc-400 bg-zinc-950 text-zinc-300'} ${sel === i ? 'scale-110 ring-2 ring-accent' : movable.has(i) && myTurn && state.turn === Math.sign(p) ? 'ring-1 ring-accent/40' : ''}`}>
                    {Math.abs(p) === 2 ? '♛' : ''}
                  </span>
                )}
              </button>
            );
          }))}
        </div>
        {over ? (
          <Banner tone={winner === 'draw' ? 'draw' : winner === 'me' ? 'win' : 'lose'} title={winner === 'draw' ? 'Draw' : winner === 'me' ? 'You win!' : 'The AI wins'} action={<Btn variant="solid" icon="play" onClick={() => reset()}>Play again</Btn>} />
        ) : (
          <p className="min-h-6 font-mono text-xs text-zinc-400" role="status" aria-live="polite">
            {thinking ? <span className="text-accent">AI is thinking…</span> : myTurn ? (mustJump ? 'You must capture — jumps are compulsory.' : 'Your move.') : ''} {info && !thinking ? <span className="text-zinc-500">{info}</span> : null}
          </p>
        )}
      </div>
      <Panel className="space-y-4">
        <Segmented label="AI level" value={level} onChange={setLevel} options={K.LEVELS.map((l) => ({ id: l.id, label: l.label }))} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Your colour" value={mine === 1 ? 'red' : 'black'} onChange={(v) => reset(v === 'red' ? 1 : -1)} options={[{ id: 'red', label: 'Red (first)' }, { id: 'black', label: 'Black' }]} />
          <Btn variant="solid" icon="refresh" onClick={() => reset()}>New game</Btn>
          <Btn icon="lightbulb" onClick={askHint} disabled={!myTurn}>Hint</Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill label="Red" value={`${cnt.red}${cnt.redK ? ` (${cnt.redK}♛)` : ''}`} tone={mine === 1 ? 'accent' : 'default'} />
          <Pill label="Black" value={`${cnt.black}${cnt.blackK ? ` (${cnt.blackK}♛)` : ''}`} tone={mine === -1 ? 'accent' : 'default'} />
        </div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">Captures are compulsory and multi-jumps are chosen for you by tapping the final square. Reach the far row to crown a king. Eighty quiet half-moves is a draw. Master searches ~10 plies with alpha-beta, a transposition table and quiescence.</p>
      </Panel>
    </div>
  );
}
