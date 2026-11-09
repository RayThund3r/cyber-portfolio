// src/components/games/SudokuGame.tsx — Sudoku with a unique-solution generator, notes, undo, hints that
// explain themselves, live conflict checking and a saved game.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as S from '@/lib/games/sudoku';
import { safeLocal } from '@/lib/safeStorage';
import { Banner, Btn, Panel, Pill, Segmented, fmt, useRecord, useStopwatch } from './ui';

interface Saved { puzzle: number[]; solution: number[]; grid: number[]; notes: number[][]; diff: S.Difficulty; secs: number }
const KEY = 'sys_sudoku_save';

export default function SudokuGame() {
  const { rec, win, time } = useRecord('sudoku');
  const [diff, setDiff] = useState<S.Difficulty>('medium');
  const [puzzle, setPuzzle] = useState<number[]>(Array(81).fill(0));
  const [solution, setSolution] = useState<number[]>(Array(81).fill(0));
  const [grid, setGrid] = useState<number[]>(Array(81).fill(0));
  const [notes, setNotes] = useState<number[][]>(() => Array.from({ length: 81 }, () => []));
  const [sel, setSel] = useState(40);
  const [noteMode, setNoteMode] = useState(false);
  const [undoStack, setUndo] = useState<Array<{ grid: number[]; notes: number[][] }>>([]);
  const [hintText, setHintText] = useState('');
  const [hint, setHint] = useState<S.Hint | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const counted = useRef(false);

  const solved = !loading && grid.every((v, i) => v === solution[i]) && grid.every(Boolean);
  const secs = useStopwatch(!loading && !solved && !paused, puzzle);
  const bad = useMemo(() => S.conflicts(grid), [grid]);
  const secsRef = useRef(0); secsRef.current = secs;

  const start = useCallback((d: S.Difficulty) => {
    setLoading(true);
    window.setTimeout(() => {
      const g = S.generate(d);
      setPuzzle(g.puzzle); setSolution(g.solution); setGrid(g.puzzle.slice());
      setNotes(Array.from({ length: 81 }, () => [])); setUndo([]); setHintText(''); setHint(null); setMistakes(0); setDone(false); setPaused(false);
      counted.current = false; setLoading(false);
    }, 30);
  }, []);

  useEffect(() => {
    const sv = safeLocal.getJSON<Saved | null>(KEY, null);
    if (sv && sv.puzzle?.length === 81 && sv.grid?.length === 81) {
      setPuzzle(sv.puzzle); setSolution(sv.solution); setGrid(sv.grid); setNotes(sv.notes || Array.from({ length: 81 }, () => [])); setDiff(sv.diff); setLoading(false);
    } else start('medium');
  }, [start]);

  useEffect(() => {
    if (loading) return;
    if (solved) { safeLocal.remove(KEY); return; }
    safeLocal.setJSON(KEY, { puzzle, solution, grid, notes, diff, secs: secsRef.current } satisfies Saved);
  }, [grid, notes, puzzle, solution, diff, loading, solved]);

  useEffect(() => {
    if (!solved || counted.current) return;
    counted.current = true; setDone(true); win(); time(diff, secsRef.current);
  }, [solved, diff, win, time]);

  const push = () => setUndo((u) => [...u.slice(-60), { grid: grid.slice(), notes: notes.map((n) => n.slice()) }]);

  const put = useCallback((n: number) => {
    if (loading || solved || puzzle[sel]) return;
    push();
    if (noteMode && n) {
      setNotes((all) => all.map((a, i) => (i === sel ? (a.includes(n) ? a.filter((x) => x !== n) : [...a, n].sort()) : a)));
      return;
    }
    setGrid((g) => g.map((v, i) => (i === sel ? (v === n ? 0 : n) : v)));
    setNotes((all) => all.map((a, i) => (i === sel ? [] : S.peers[sel].includes(i) && n ? a.filter((x) => x !== n) : a)));
    if (n && solution[sel] !== n) setMistakes((m) => m + 1);
    setHintText(''); setHint(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, loading, solved, puzzle, noteMode, solution, grid, notes]);

  const undo = () => { const u = undoStack[undoStack.length - 1]; if (!u) return; setGrid(u.grid); setNotes(u.notes); setUndo(undoStack.slice(0, -1)); setHint(null); setHintText(''); };
  // Hints are two steps: explain first (highlighting the cells involved), then "Apply" does it.
  const giveHint = () => {
    const h = S.hint(grid, solution, puzzle);
    if (!h) return;
    setHint(h); setHintText(`${h.technique}: ${h.why}`); setSel(h.index);
  };
  const applyHint = () => {
    if (!hint) return;
    push();
    if (hint.kind === 'mistake') setGrid((g) => g.map((v, i) => (i === hint.index ? 0 : v)));
    else if (hint.kind === 'eliminate' && hint.elim) {
      const el = hint.elim;
      setNotes((all) => all.map((a, i) => {
        const rm = el.filter((e) => e.index === i).map((e) => e.value);
        if (!rm.length) return a;
        const base = a.length ? a : S.candidates(grid, i);
        return base.filter((x) => !rm.includes(x));
      }));
    } else {
      setGrid((g) => g.map((v, i) => (i === hint.index ? hint.value : v)));
      setNotes((all) => all.map((a, i) => (i === hint.index ? [] : S.peers[hint.index].includes(i) ? a.filter((x) => x !== hint.value) : a)));
    }
    setHint(null); setHintText('');
  };
  const autoNotes = () => { push(); setNotes(grid.map((v, i) => (v ? [] : S.candidates(grid, i)))); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) { put(Number(e.key)); }
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') put(0);
      else if (e.key.toLowerCase() === 'n') setNoteMode((m) => !m);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        setSel((s) => { const r = Math.floor(s / 9), c = s % 9; return e.key === 'ArrowUp' ? Math.max(0, r - 1) * 9 + c : e.key === 'ArrowDown' ? Math.min(8, r + 1) * 9 + c : e.key === 'ArrowLeft' ? r * 9 + Math.max(0, c - 1) : r * 9 + Math.min(8, c + 1); });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [put]);

  const selVal = grid[sel];
  const counts = useMemo(() => { const c = Array(10).fill(0); grid.forEach((v) => v && c[v]++); return c; }, [grid]);
  const filled = grid.filter(Boolean).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,32rem)_1fr]">
      <div className="space-y-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border-2 border-zinc-500 bg-zinc-900" role="grid" aria-label="Sudoku grid">
          {loading && <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/80 font-mono text-sm text-accent">Generating a unique puzzle…</div>}
          {paused && !loading && <button type="button" onClick={() => setPaused(false)} className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-zinc-950 font-mono text-sm text-accent">Paused. Tap to resume</button>}
          <div className="grid h-full w-full grid-cols-9 grid-rows-9">
            {grid.map((v, i) => {
              const r = Math.floor(i / 9), c = i % 9;
              const given = !!puzzle[i];
              const isSel = i === sel;
              const peer = S.peers[sel].includes(i);
              const same = selVal && v === selVal;
              const err = bad.has(i);
              const hl = hint?.cells?.includes(i);
              return (
                <button key={i} type="button" role="gridcell" onClick={() => setSel(i)} aria-label={`Row ${r + 1} column ${c + 1}${v ? ' value ' + v : ' empty'}${given ? ' given' : ''}`}
                  className={`relative flex cursor-pointer items-center justify-center border-zinc-700 font-mono text-[clamp(1rem,5.2vw,1.7rem)] leading-none ${c % 3 === 2 && c < 8 ? 'border-r-2 border-r-zinc-500' : 'border-r'} ${r % 3 === 2 && r < 8 ? 'border-b-2 border-b-zinc-500' : 'border-b'} ${hl ? 'ring-2 ring-inset ring-amber-400' : ''} ${isSel ? 'bg-accent/30' : same ? 'bg-accent/20' : peer ? 'bg-zinc-800/80' : ''} ${given ? 'font-bold text-zinc-100' : err ? 'text-red-400' : 'text-accent'}`}>
                  {v ? v : notes[i].length ? (
                    <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[2px] text-[clamp(0.4rem,1.9vw,0.62rem)] text-zinc-400">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <span key={n} className="flex items-center justify-center">{notes[i].includes(n) ? n : ''}</span>)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-9 gap-1" role="group" aria-label="Number pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" onClick={() => put(n)} disabled={counts[n] >= 9} className={`min-h-11 cursor-pointer rounded-lg border font-mono text-lg transition active:scale-95 disabled:opacity-25 ${noteMode ? 'border-amber-400/50 text-amber-300' : 'border-zinc-700 text-accent hover:border-accent'}`}>
              {n}
            </button>
          ))}
        </div>

        {done ? (
          <Banner tone="win" title={`Solved in ${fmt(secs)}!`} text={`${mistakes} mistake${mistakes === 1 ? '' : 's'} on ${diff}.`} action={<Btn variant="solid" icon="play" onClick={() => start(diff)}>New puzzle</Btn>} />
        ) : (
          <p className="min-h-6 font-mono text-xs text-zinc-400" role="status" aria-live="polite">{hintText || (bad.size ? <span className="text-red-400">Some numbers clash with their row, column or box.</span> : 'Pick a cell, then a number. N toggles notes.')}</p>
        )}
      </div>

      <Panel className="space-y-4">
        <Segmented label="Difficulty" value={diff} onChange={(d) => { setDiff(d); start(d); }} options={[{ id: 'easy', label: 'Easy' }, { id: 'medium', label: 'Medium' }, { id: 'hard', label: 'Hard' }, { id: 'expert', label: 'Expert' }]} />
        <div className="flex flex-wrap gap-2">
          <Pill label="Time" value={fmt(secs)} tone="accent" />
          <Pill label="Filled" value={`${filled}/81`} />
          <Pill label="Mistakes" value={mistakes} tone={mistakes ? 'warn' : 'default'} />
          {rec.times?.[diff] !== undefined && <Pill label={`Best ${diff}`} value={fmt(rec.times[diff])} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="solid" icon="refresh" onClick={() => start(diff)}>New puzzle</Btn>
          <Btn icon="lightbulb" onClick={giveHint} disabled={solved || loading}>Hint</Btn>
          {hint && <Btn variant="solid" icon="check" onClick={applyHint}>{hint.kind === 'eliminate' ? 'Apply to notes' : hint.kind === 'mistake' ? 'Clear it' : 'Fill it in'}</Btn>}
          <Btn icon="undo" onClick={undo} disabled={!undoStack.length}>Undo</Btn>
          <Btn active={noteMode} onClick={() => setNoteMode((m) => !m)}>Notes {noteMode ? 'on' : 'off'}</Btn>
          <Btn onClick={autoNotes} disabled={solved || loading}>Auto-notes</Btn>
          <Btn onClick={() => setPaused((p) => !p)} disabled={solved || loading}>{paused ? 'Resume' : 'Pause'}</Btn>
        </div>
        <p className="font-mono text-[11px] text-zinc-500">Solved: <span className="text-emerald-400">{rec.w}</span></p>
        <p className="text-[11px] leading-relaxed text-zinc-500">Every puzzle is generated fresh and checked to have exactly one solution. Hints name the technique (singles, locked candidates, pairs, triples, X-Wing), highlight the cells involved and explain why; press Apply to let it do the step. Harder levels need harder techniques, not just fewer clues. Your game is saved in this browser, so you can come back to it. Keys: 1–9, Backspace, arrows, N.</p>
      </Panel>
    </div>
  );
}
