// src/components/games/MastermindGame.tsx — Mastermind: crack the AI's code, or watch the AI crack yours (Knuth minimax).
'use client';

import { useEffect, useRef, useState } from 'react';
import * as M from '@/lib/games/mastermind';
import { Banner, Btn, Panel, Pill, Record, Segmented, useDefer, useRecord } from './ui';

const CFG = M.CLASSIC;
const COL = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#6366f1', '#d946ef'];
const SYM = ['●', '■', '▲', '◆', '★', '✚'];
const NAMES = ['red', 'amber', 'green', 'cyan', 'indigo', 'magenta'];
type Row = { guess: M.Code; fb: M.Fb };

function Peg({ c, size = 'h-9 w-9', onClick, label }: { c: number; size?: string; onClick?: () => void; label?: string }) {
  const empty = c < 0;
  return (
    <button type="button" onClick={onClick} disabled={!onClick} aria-label={label ?? (empty ? 'empty slot' : NAMES[c])}
      className={`flex ${size} shrink-0 items-center justify-center rounded-full border text-sm font-bold text-zinc-950 transition ${onClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${empty ? 'border-dashed border-zinc-600 bg-zinc-900/60' : 'border-white/30'}`}
      style={empty ? undefined : { background: COL[c] }}>{empty ? '' : SYM[c]}</button>
  );
}
function Fb({ fb }: { fb: M.Fb }) {
  const pegs = [...Array(fb.black).fill('b'), ...Array(fb.white).fill('w'), ...Array(CFG.pegs - fb.black - fb.white).fill('n')];
  return (
    <div className="grid grid-cols-2 gap-1" aria-label={`${fb.black} right place, ${fb.white} right colour wrong place`}>
      {pegs.map((p, i) => <span key={i} className={`h-3 w-3 rounded-full border ${p === 'b' ? 'border-zinc-100 bg-zinc-100' : p === 'w' ? 'border-zinc-300 bg-transparent ring-2 ring-inset ring-zinc-300' : 'border-zinc-700 bg-zinc-900'}`} />)}
    </div>
  );
}

export default function MastermindGame() {
  const { rec, win, loss } = useRecord('mastermind');
  const defer = useDefer();
  const [mode, setMode] = useState<'break' | 'ai'>('break');
  const [level, setLevel] = useState<M.MmLevel>('medium');
  const rowsMax = M.LEVELS.find((l) => l.id === level)!.rows;
  const [secret, setSecret] = useState<M.Code>(() => Array(CFG.pegs).fill(0));
  const [rows, setRows] = useState<Row[]>([]);
  const [cur, setCur] = useState<number[]>(Array(CFG.pegs).fill(-1));
  const [phase, setPhase] = useState<'set' | 'play' | 'won' | 'lost'>('play');
  const [mine, setMine] = useState<M.Code>([0, 1, 2, 3]);
  const [cands, setCands] = useState<M.Code[]>([]);
  const [hint, setHint] = useState<{ guess: M.Code; remaining: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const counted = useRef(false);

  const start = (m: 'break' | 'ai' = mode) => {
    counted.current = false; setRows([]); setHint(null); setCur(Array(CFG.pegs).fill(-1)); setCands(m === 'ai' ? M.allCodes(CFG) : []);
    if (m === 'break') { setSecret(M.randomCode(CFG)); setPhase('play'); } else setPhase('set');
  };
  useEffect(() => { setMounted(true); start('break'); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // AI cracker: take its next guess automatically after a short pause.
  useEffect(() => {
    if (mode !== 'ai' || phase !== 'play') return;
    defer(() => {
      const g = M.nextGuess(CFG, cands, rows.length);
      const fb = M.score(mine, g, CFG.colors);
      setRows((r) => [...r, { guess: g, fb }]);
      if (fb.black === CFG.pegs) { setPhase('lost'); return; }
      if (rows.length + 1 >= rowsMax) { setPhase('won'); return; }
      setCands((c) => M.filterCandidates(c, g, fb, CFG.colors));
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase, rows.length]);

  useEffect(() => {
    if (mode !== 'break' || counted.current) return;
    if (phase === 'won') { counted.current = true; win(); } else if (phase === 'lost') { counted.current = true; loss(); }
  }, [phase, mode, win, loss]);

  const put = (c: number) => setCur((a) => { const i = a.indexOf(-1); if (i < 0) return a; const n = a.slice(); n[i] = c; return n; });
  const clear = (i: number) => setCur((a) => a.map((v, k) => (k === i ? -1 : v)));
  const submit = () => {
    if (cur.includes(-1) || phase !== 'play') return;
    const fb = M.score(secret, cur, CFG.colors);
    const next = [...rows, { guess: cur.slice(), fb }];
    setRows(next); setCur(Array(CFG.pegs).fill(-1)); setHint(null);
    if (fb.black === CFG.pegs) setPhase('won'); else if (next.length >= rowsMax) setPhase('lost');
  };
  const askHint = () => setHint(M.hintGuess(CFG, rows));

  if (!mounted) return <div className="h-64" aria-busy="true" />;
  const finished = phase === 'won' || phase === 'lost';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div className="space-y-3">
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3" aria-label="Guess history">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3"><span className="w-5 text-right font-mono text-[10px] text-zinc-500">{i + 1}</span>
              <div className="flex gap-2">{r.guess.map((c, k) => <Peg key={k} c={c} size="h-8 w-8" />)}</div><Fb fb={r.fb} /></div>
          ))}
          {mode === 'break' && phase === 'play' && (
            <div className="flex items-center gap-3"><span className="w-5 text-right font-mono text-[10px] text-accent">{rows.length + 1}</span>
              <div className="flex gap-2">{cur.map((c, k) => <Peg key={k} c={c} size="h-8 w-8" onClick={c >= 0 ? () => clear(k) : undefined} label={c >= 0 ? `${NAMES[c]}, tap to remove` : 'empty slot'} />)}</div></div>
          )}
          {mode === 'ai' && phase === 'play' && <p className="font-mono text-xs text-accent">AI is deducing… {cands.length.toLocaleString()} codes still possible</p>}
          {rows.length === 0 && phase !== 'set' && mode === 'break' && <p className="font-mono text-[11px] text-zinc-500">Pick four colours below, then press Guess. ● white = right colour, right place · ○ ring = right colour, wrong place.</p>}
        </div>
        {mode === 'break' && phase === 'play' && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Colour palette">
            {COL.map((_, c) => <Peg key={c} c={c} onClick={() => put(c)} label={`Add ${NAMES[c]}`} />)}
            <Btn variant="solid" onClick={submit} disabled={cur.includes(-1)} icon="check">Guess</Btn>
          </div>
        )}
        {phase === 'set' && (
          <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="font-mono text-xs text-zinc-400">Choose your secret code (tap a peg to change its colour). The AI can’t see it.</p>
            <div className="flex gap-2">{mine.map((c, k) => <Peg key={k} c={c} onClick={() => setMine((m) => m.map((v, i) => (i === k ? (v + 1) % CFG.colors : v)))} label={`Slot ${k + 1}: ${NAMES[c]}, tap to change`} />)}</div>
            <Btn variant="solid" icon="play" onClick={() => { setPhase('play'); setCands(M.allCodes(CFG)); setRows([]); }}>Lock in &amp; let the AI guess</Btn>
          </div>
        )}
        {finished && (
          mode === 'break'
            ? <Banner tone={phase === 'won' ? 'win' : 'lose'} title={phase === 'won' ? `Cracked in ${rows.length}!` : 'Out of guesses'} text={phase === 'lost' ? `The code was ${secret.map((c) => SYM[c]).join(' ')} (${secret.map((c) => NAMES[c]).join(', ')}).` : undefined} action={<Btn variant="solid" icon="play" onClick={() => start()}>Play again</Btn>} />
            : <Banner tone={phase === 'lost' ? 'info' : 'win'} title={phase === 'lost' ? `The AI cracked your code in ${rows.length}` : `Your code survived ${rowsMax} guesses!`} text={phase === 'won' ? 'The AI ran out of rows — a rare feat.' : 'Knuth’s algorithm never needs more than 5 guesses on this board.'} action={<Btn variant="solid" icon="play" onClick={() => start()}>Again</Btn>} />
        )}
      </div>
      <Panel className="space-y-4">
        <Segmented label="Mode" value={mode} onChange={(m) => { setMode(m); start(m); }} options={[{ id: 'break', label: 'I crack the code' }, { id: 'ai', label: 'AI cracks mine' }]} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Guess limit" value={level} onChange={setLevel} options={M.LEVELS.map((l) => ({ id: l.id, label: `${l.label} (${l.rows})` }))} disabled={rows.length > 0 && !finished} />
          <Btn variant="solid" icon="refresh" onClick={() => start()}>New game</Btn>
          {mode === 'break' && <Btn icon="lightbulb" onClick={askHint} disabled={phase !== 'play'}>Hint</Btn>}
        </div>
        {hint && <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/5 p-2"><span className="font-mono text-[11px] text-amber-300">Best next guess ({hint.remaining.toLocaleString()} codes left):</span>{hint.guess.map((c, k) => <Peg key={k} c={c} size="h-6 w-6" />)}</div>}
        <div className="flex gap-2"><Pill label="Guesses" value={`${rows.length}/${rowsMax}`} tone="accent" /><Pill label="Codes" value="1,296" /></div>
        {mode === 'break' && <Record rec={rec} />}
        <p className="text-[11px] leading-relaxed text-zinc-500">The AI picks every guess by minimax: it tries all 1,296 codes and keeps the one whose worst-case reply leaves the fewest candidates. That solves any code in at most five guesses (Knuth, 1977). Hints use the same engine on your own history.</p>
      </Panel>
    </div>
  );
}
