// src/components/games/NimGame.tsx — Nim (normal or misère) against an AI that knows the XOR strategy.
'use client';

import { useEffect, useRef, useState } from 'react';
import * as N from '@/lib/games/nim';
import { Banner, Btn, Panel, Pill, Record, Segmented, useDefer, useRecord } from './ui';

export default function NimGame() {
  const { rec, win, loss } = useRecord('nim');
  const defer = useDefer();
  const [level, setLevel] = useState<N.NimLevel>('medium');
  const [misere, setMisere] = useState(false);
  const [piles, setPiles] = useState<number[] | null>(null);
  const [turn, setTurn] = useState<'me' | 'ai'>('me');
  const [pick, setPick] = useState<{ pile: number; take: number } | null>(null);
  const [log, setLog] = useState('');
  const [hint, setHint] = useState<N.NimMove | null>(null);
  const [winner, setWinner] = useState<'me' | 'ai' | null>(null);
  const counted = useRef(false);

  const fresh = (first: 'me' | 'ai' = 'me') => { setPiles(N.randomPiles()); setTurn(first); setPick(null); setLog(''); setHint(null); setWinner(null); counted.current = false; };
  useEffect(() => { fresh(); }, []);

  const finish = (after: number[], mover: 'me' | 'ai') => {
    if (N.total(after) > 0) return false;
    // normal play: taking the last stone wins; misère: taking the last stone loses
    setWinner(misere ? (mover === 'me' ? 'ai' : 'me') : mover); return true;
  };
  useEffect(() => {
    if (!piles || turn !== 'ai' || winner) return;
    defer(() => {
      const L = N.LEVELS.find((l) => l.id === level)!;
      const m = N.aiMove(piles, misere, L.accuracy);
      const after = N.apply(piles, m);
      setPiles(after); setLog(`AI took ${m.take} from pile ${m.pile + 1}.`);
      if (!finish(after, 'ai')) setTurn('me');
    }, 650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, piles, winner]);
  useEffect(() => { if (winner && !counted.current) { counted.current = true; if (winner === 'me') win(); else loss(); } }, [winner, win, loss]);

  if (!piles) return <div className="h-48" aria-busy="true" />;
  const take = () => { if (!pick || turn !== 'me' || winner) return; const after = N.apply(piles, pick); setPiles(after); setLog(`You took ${pick.take} from pile ${pick.pile + 1}.`); setPick(null); setHint(null); if (!finish(after, 'me')) setTurn('ai'); };
  const x = N.nimSum(piles);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,30rem)_1fr]">
      <div className="space-y-3">
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          {piles.map((p, i) => (
            <div key={i} className="flex items-center gap-3"><span className="w-14 font-mono text-[11px] text-zinc-500">Pile {i + 1}</span>
              <div className="flex flex-wrap gap-1.5">
                {p === 0 && <span className="font-mono text-[11px] text-zinc-600">empty</span>}
                {Array.from({ length: p }, (_, k) => {
                  const sel = pick?.pile === i && k >= p - pick.take;
                  return <button key={k} type="button" aria-label={`Take ${p - k} from pile ${i + 1}`} disabled={turn !== 'me' || !!winner}
                    onClick={() => setPick({ pile: i, take: p - k })} className={`h-8 w-8 cursor-pointer rounded-full border transition disabled:cursor-default ${sel ? 'border-amber-400 bg-amber-400/30 scale-90' : hint?.pile === i && k >= p - hint.take ? 'border-accent bg-accent/30' : 'border-zinc-500 bg-zinc-200/90 hover:border-accent'}`} />;
                })}
              </div></div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="solid" icon="check" onClick={take} disabled={!pick || turn !== 'me' || !!winner}>{pick ? `Take ${pick.take} from pile ${pick.pile + 1}` : 'Tap a stone to choose'}</Btn>
          <Btn icon="lightbulb" onClick={() => setHint(N.perfectMove(piles, misere))} disabled={turn !== 'me' || !!winner}>Hint</Btn>
        </div>
        <p className="min-h-5 font-mono text-xs text-zinc-400" role="status" aria-live="polite">{turn === 'ai' && !winner ? <span className="text-accent">AI is thinking…</span> : log}{hint === null && false}</p>
        {hint !== null && !winner && <p className="font-mono text-[11px] text-accent">Hint: take {hint.take} from pile {hint.pile + 1}.</p>}
        {winner && <Banner tone={winner === 'me' ? 'win' : 'lose'} title={winner === 'me' ? 'You win!' : 'The AI wins'} action={<Btn variant="solid" icon="play" onClick={() => fresh()}>Play again</Btn>} />}
      </div>
      <Panel className="space-y-4">
        <Segmented label="AI level" value={level} onChange={setLevel} options={N.LEVELS.map((l) => ({ id: l.id, label: l.label }))} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Rule" value={misere ? 'misere' : 'normal'} onChange={(v) => { setMisere(v === 'misere'); setTimeout(() => fresh(), 0); }} options={[{ id: 'normal', label: 'Last stone wins' }, { id: 'misere', label: 'Last stone loses' }]} />
          <Btn variant="solid" icon="refresh" onClick={() => fresh()}>New game</Btn>
          <Btn icon="arrow" onClick={() => fresh('ai')}>AI starts</Btn>
        </div>
        <div className="flex gap-2"><Pill label="Stones" value={N.total(piles)} tone="accent" /><Pill label="Nim-sum" value={x} tone={x === 0 ? 'warn' : 'default'} /></div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">On your turn take any number of stones from one pile. Bouton’s theorem: XOR the pile sizes — if the result (the nim-sum) is zero the player to move loses against perfect play. The starting position is always winnable for the first player, so on Perfect you must find the exact moves; on Casual the AI often blunders.</p>
      </Panel>
    </div>
  );
}
