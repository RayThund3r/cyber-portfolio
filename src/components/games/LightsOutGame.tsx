// src/components/games/LightsOutGame.tsx — Lights Out with an exact GF(2) solver for hints and "solve for me".
'use client';

import { useEffect, useState } from 'react';
import * as L from '@/lib/games/lightsout';
import { Banner, Btn, Panel, Pill, Record, Segmented, useRecord, useStopwatch, fmt } from './ui';

export default function LightsOutGame() {
  const { rec, win, time } = useRecord('lightsout');
  const [size, setSize] = useState<(typeof L.SIZES)[number]['id']>('5');
  const cfg = L.SIZES.find((s) => s.id === size)!;
  const n = cfg.n;
  const [grid, setGrid] = useState<L.Grid | null>(null);
  const [moves, setMoves] = useState(0);
  const [hint, setHint] = useState<number[]>([]);
  const [auto, setAuto] = useState(false);
  const [seed, setSeed] = useState(0);
  const [used, setUsed] = useState(false);
  const solved = !!grid && L.isSolved(grid) && moves > 0;
  const secs = useStopwatch(!!grid && !solved, seed);
  const optimal = grid && !solved ? L.solve(grid, n)?.length ?? 0 : 0;

  const fresh = (s = size) => { const c = L.SIZES.find((x) => x.id === s)!; setGrid(L.scramble(c.n, c.presses)); setMoves(0); setHint([]); setAuto(false); setUsed(false); setSeed((x) => x + 1); };
  useEffect(() => { fresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => { // record the win once
    if (!solved) return;
    if (!used) { win(); time(size, secs); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  useEffect(() => { // "solve for me" animation: press the solution cells one by one
    if (!auto || !grid) return;
    const sol = L.solve(grid, n);
    if (!sol || !sol.length) { setAuto(false); return; }
    const id = window.setTimeout(() => { setGrid((g) => (g ? L.press(g, n, sol[0]) : g)); setMoves((m) => m + 1); setHint(sol.slice(1)); }, 450);
    return () => window.clearTimeout(id);
  }, [auto, grid, n]);

  if (!grid) return <div className="h-64" aria-busy="true" />;
  const click = (i: number) => { if (solved || auto) return; setGrid(L.press(grid, n, i)); setMoves((m) => m + 1); setHint([]); };
  const showHint = () => { const s = L.solve(grid, n); if (s) { setHint(s); setUsed(true); } };
  const hintSet = new Set(hint);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <div className="space-y-3">
        <div className="grid aspect-square w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} role="grid" aria-label="Lights Out board">
          {Array.from(grid).map((v, i) => (
            <button key={i} type="button" role="gridcell" onClick={() => click(i)} aria-label={`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, ${v ? 'lit' : 'dark'}${hintSet.has(i) ? ', press this' : ''}`}
              className={`cursor-pointer rounded-lg border transition duration-200 ${v ? 'border-accent bg-accent shadow-[0_0_18px_-2px] shadow-accent/70' : 'border-zinc-700 bg-zinc-900'} ${hintSet.has(i) ? 'ring-2 ring-amber-400' : ''} ${solved ? 'g-flash' : ''}`} />
          ))}
        </div>
        {solved ? <Banner tone="win" title={used ? `Solved in ${moves} presses` : `Solved in ${moves} presses · ${fmt(secs)}`} text={used ? 'You used a hint, so this one doesn’t count towards your record.' : undefined} action={<Btn variant="solid" icon="play" onClick={() => fresh()}>Next puzzle</Btn>} />
          : <p className="min-h-6 font-mono text-xs text-zinc-400" role="status">Press a cell: it and its four neighbours flip. Turn every light off.</p>}
      </div>
      <Panel className="space-y-4">
        <Segmented label="Board size" value={size} onChange={(s) => { setSize(s); fresh(s); }} options={L.SIZES.map((s) => ({ id: s.id, label: s.label }))} />
        <div className="flex flex-wrap gap-2">
          <Btn variant="solid" icon="refresh" onClick={() => fresh()}>New puzzle</Btn>
          <Btn icon="lightbulb" onClick={showHint} disabled={solved}>Show solution</Btn>
          <Btn icon="play" onClick={() => { setUsed(true); setAuto((a) => !a); }} disabled={solved} active={auto}>{auto ? 'Stop' : 'Solve for me'}</Btn>
        </div>
        <div className="flex flex-wrap gap-2"><Pill label="Presses" value={moves} tone="accent" /><Pill label="Lit" value={L.lit(grid)} /><Pill label="Optimal" value={solved ? '–' : optimal} /><Pill label="Time" value={fmt(secs)} />{rec.times?.[size] !== undefined && <Pill label={`Best ${cfg.label}`} value={fmt(rec.times[size])} />}</div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">Behind the curtain this is linear algebra over GF(2): the solver eliminates a 25×25 matrix of presses and picks the fewest-press answer among all equivalent ones, so “Optimal” is exact. Press order doesn’t matter, and pressing a cell twice cancels out.</p>
      </Panel>
    </div>
  );
}
