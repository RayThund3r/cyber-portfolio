// src/components/games/SlidingGame.tsx — 8- and 15-puzzle with an IDA* solver (Manhattan + linear conflict).
'use client';

import { useEffect, useRef, useState } from 'react';
import * as S from '@/lib/games/sliding';
import { Banner, Btn, Panel, Pill, Record, Segmented, useDefer, useRecord, useStopwatch, fmt } from './ui';

export default function SlidingGame() {
  const { rec, win, time } = useRecord('sliding');
  const defer = useDefer();
  const [size, setSize] = useState<(typeof S.SIZES)[number]['id']>('3');
  const cfg = S.SIZES.find((s) => s.id === size)!;
  const n = cfg.n;
  const [t, setT] = useState<S.Tiles | null>(null);
  const [moves, setMoves] = useState(0);
  const [seed, setSeed] = useState(0);
  const [hint, setHint] = useState<number | null>(null);
  const [plan, setPlan] = useState<{ len: number; optimal: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [used, setUsed] = useState(false);
  const solved = !!t && S.isSolved(t) && moves > 0;
  const secs = useStopwatch(!!t && !solved, seed);
  const counted = useRef(false);

  const fresh = (s = size) => { const c = S.SIZES.find((x) => x.id === s)!; setT(S.shuffle(c.n, Math.random, c.walk)); setMoves(0); setHint(null); setPlan(null); setAuto(false); setUsed(false); counted.current = false; setSeed((x) => x + 1); };
  useEffect(() => { fresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (solved && !counted.current) { counted.current = true; if (!used) { win(); time(size, secs); } } }, [solved, used, size, secs, win, time]);

  const doHint = () => {
    if (!t) return; setBusy(true); setUsed(true);
    defer(() => { const r = S.solve(t, n, 1500); setBusy(false); if (r && r.moves.length) { setHint(r.moves[0]); setPlan({ len: r.moves.length, optimal: r.optimal }); } }, 30);
  };
  useEffect(() => {
    if (!auto || !t || solved) { if (solved) setAuto(false); return; }
    const id = window.setTimeout(() => { const r = S.solve(t, n, 1500); if (!r || !r.moves.length) { setAuto(false); return; } const nx = S.slide(t, n, r.moves[0]); if (nx) { setT(nx); setMoves((m) => m + 1); setHint(null); } else setAuto(false); }, 300);
    return () => window.clearTimeout(id);
  }, [auto, t, n, solved]);

  if (!t) return <div className="h-64" aria-busy="true" />;
  const click = (tile: number) => { if (solved || auto) return; const nx = S.slide(t, n, tile); if (!nx) return; setT(nx); setMoves((m) => m + 1); setHint(null); setPlan(null); };
  const blank = t.indexOf(0);
  // let arrow keys slide the neighbouring tile into the gap
  const onKey = (e: React.KeyboardEvent) => {
    const r = Math.floor(blank / n), c = blank % n; let from = -1;
    if (e.key === 'ArrowUp' && r < n - 1) from = blank + n; else if (e.key === 'ArrowDown' && r > 0) from = blank - n; else if (e.key === 'ArrowLeft' && c < n - 1) from = blank + 1; else if (e.key === 'ArrowRight' && c > 0) from = blank - 1;
    if (from >= 0) { e.preventDefault(); click(t[from]); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <div className="space-y-3">
        <div tabIndex={0} onKeyDown={onKey} className="grid aspect-square w-full gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/60" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} role="grid" aria-label="Sliding puzzle. Use arrow keys to slide a tile into the gap.">
          {Array.from(t).map((v, i) => v === 0 ? <div key={i} className="rounded-lg border border-dashed border-zinc-800" /> : (
            <button key={i} type="button" role="gridcell" onClick={() => click(v)} aria-label={`Tile ${v}`}
              className={`cursor-pointer rounded-lg border font-mono text-[clamp(1.2rem,7vw,2.4rem)] font-bold transition active:scale-95 ${v === hint ? 'border-amber-400 bg-amber-400/15 text-amber-300' : (v === i + 1 ? 'border-accent/50 bg-accent/10 text-accent' : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-accent/60')} ${solved ? 'g-flash' : ''}`}>{v}</button>
          ))}
        </div>
        {solved ? <Banner tone="win" title={`Solved in ${moves} moves · ${fmt(secs)}`} text={used ? 'You used the solver, so this one doesn’t count towards your record.' : undefined} action={<Btn variant="solid" icon="play" onClick={() => fresh()}>Next puzzle</Btn>} />
          : <p className="min-h-6 font-mono text-xs text-zinc-400" role="status">{busy ? <span className="text-accent">Searching for the shortest solution…</span> : plan ? `Solver: ${plan.len} moves ${plan.optimal ? '(provably optimal)' : '(best effort)'} — start with ${hint}.` : 'Slide tiles into the gap to put 1…N in order.'}</p>}
      </div>
      <Panel className="space-y-4">
        <Segmented label="Size" value={size} onChange={(s) => { setSize(s); fresh(s); }} options={S.SIZES.map((s) => ({ id: s.id, label: s.label }))} />
        <div className="flex flex-wrap gap-2">
          <Btn variant="solid" icon="refresh" onClick={() => fresh()}>Shuffle</Btn>
          <Btn icon="lightbulb" onClick={doHint} disabled={solved || busy}>Hint</Btn>
          <Btn icon="play" onClick={() => { setUsed(true); setAuto((a) => !a); }} disabled={solved} active={auto}>{auto ? 'Stop' : 'Solve for me'}</Btn>
        </div>
        <div className="flex flex-wrap gap-2"><Pill label="Moves" value={moves} tone="accent" /><Pill label="Time" value={fmt(secs)} />{rec.times?.[size] !== undefined && <Pill label={`Best ${cfg.label}`} value={fmt(rec.times[size])} />}</div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">The solver is IDA*: iterative-deepening depth-first search guided by Manhattan distance plus a linear-conflict bonus. It never overestimates, so the first solution it finds is the shortest possible. Half of all random 15-puzzle shuffles are unsolvable; this board only deals solvable ones.</p>
      </Panel>
    </div>
  );
}
