// src/components/games/ChessGame.tsx — play chess against the engine in lib/games/chess.ts.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as C from '@/lib/games/chess';
import { Banner, Btn, Panel, Pill, Record, Segmented, useDefer, useRecord } from './ui';
import { copyText } from '@/components/chat/chatUtils';

const GLYPH: Record<number, string> = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
const TEXT = '︎'; // force text (not emoji) presentation for the pawn glyph
const START_VAL: Record<number, number> = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };

interface Hint { from: number; to: number }

export default function ChessGame() {
  const { rec, win, loss, draw } = useRecord('chess');
  const defer = useDefer();
  const [level, setLevel] = useState<C.LevelId>('medium');
  const [side, setSide] = useState<'w' | 'b' | 'r'>('w');
  const [you, setYou] = useState<C.Color>('w');
  const [states, setStates] = useState<C.State[]>(() => [C.fromFEN()]);
  const [moves, setMoves] = useState<C.Move[]>([]);
  const [sans, setSans] = useState<string[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<C.Move[] | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [evalCp, setEvalCp] = useState(0);
  const [resigned, setResigned] = useState(false);
  const [flip, setFlip] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = useRef(0);
  const counted = useRef(false);
  const listRef = useRef<HTMLOListElement>(null);

  const cur = states[states.length - 1];
  const legal = useMemo(() => C.legalMoves(cur), [cur]);
  const st = useMemo(() => C.status(cur), [cur]);
  const repetition = useMemo(() => {
    const k = C.positionKey(cur);
    return states.filter((s) => C.positionKey(s) === k).length >= 3;
  }, [cur, states]);
  const over = resigned || st !== 'playing' || repetition;
  const lastMove = moves[moves.length - 1];
  const myTurn = cur.turn === you && !over;
  const orient = flip ? (you === 'w' ? 'b' : 'w') : you; // whose side is at the bottom

  const outcome = useMemo(() => {
    if (resigned) return { tone: 'lose' as const, title: 'You resigned', text: 'Good game. Try a different level or colour.' };
    if (st === 'checkmate') return cur.turn === you ? { tone: 'lose' as const, title: 'Checkmate. You lost', text: 'Use the hint button next time, or drop a level.' } : { tone: 'win' as const, title: 'Checkmate. You win!', text: 'Well played.' };
    if (st === 'stalemate') return { tone: 'draw' as const, title: 'Stalemate', text: 'No legal moves but no check: a draw.' };
    if (st === 'insufficient') return { tone: 'draw' as const, title: 'Draw', text: 'Neither side has enough material to mate.' };
    if (st === 'draw50') return { tone: 'draw' as const, title: 'Draw by the 50-move rule', text: '' };
    if (repetition) return { tone: 'draw' as const, title: 'Draw by repetition', text: 'The same position occurred three times.' };
    return null;
  }, [st, repetition, resigned, cur.turn, you]);

  useEffect(() => {
    if (!outcome || counted.current) return;
    counted.current = true;
    if (outcome.tone === 'win') win();
    else if (outcome.tone === 'lose') loss();
    else draw();
  }, [outcome, win, loss, draw]);

  // Always read the latest game from a ref and keep the updaters pure (no setState inside an updater).
  const statesRef = useRef(states);
  statesRef.current = states;
  const play = useCallback((m: C.Move) => {
    const ss = statesRef.current;
    const s = ss[ss.length - 1];
    const san = C.toSAN(s, m);
    const next = [...ss, C.makeMove(s, m)];
    statesRef.current = next;
    setStates(next);
    setSans((x) => [...x, san]);
    setMoves((x) => [...x, m]);
    setSel(null);
    setHint(null);
    setPromo(null);
  }, []);

  /* ---- AI turn ---- */
  useEffect(() => {
    if (over || cur.turn === you) { setThinking(false); return; }
    const my = ++token.current;
    setThinking(true);
    const L = C.LEVELS.find((l) => l.id === level)!;
    defer(() => {
      const r = C.bestMove(cur, { maxDepth: L.depth, timeMs: L.timeMs, noise: L.noise, book: L.book, history: states.slice(0, -1).map(C.positionKey) });
      if (my !== token.current) return;
      setThinking(false);
      if (r.move) {
        setEvalCp(cur.turn === 'w' ? r.score : -r.score);
        play(r.move);
      }
    }, 280);
    return () => { token.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, you, over, level]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [sans.length]);

  const newGame = useCallback(() => {
    token.current++;
    const c: C.Color = side === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
    setYou(c);
    C.resetEngine(); setStates([C.fromFEN()]); setMoves([]); setSans([]); setSel(null); setPromo(null); setHint(null);
    setResigned(false); setEvalCp(0); setFlip(false); setThinking(false);
    counted.current = false;
  }, [side]);

  const undo = () => {
    if (thinking && !over) { token.current++; setThinking(false); }
    // take back to the last position where it was the player's turn
    let n = states.length - 1;
    if (n === 0) return;
    n -= states[n].turn === you ? 1 : 1;
    while (n > 0 && states[n].turn !== you) n--;
    setStates(states.slice(0, n + 1)); setMoves(moves.slice(0, n)); setSans(sans.slice(0, n));
    setSel(null); setHint(null); setResigned(false); counted.current = false;
  };

  const askHint = () => {
    if (!myTurn) return;
    setThinking(true);
    defer(() => {
      const r = C.bestMove(cur, { maxDepth: 12, timeMs: 1200, noise: 0, history: states.slice(0, -1).map(C.positionKey) });
      setThinking(false);
      if (r.move) { setHint({ from: r.move.from, to: r.move.to }); setEvalCp(cur.turn === 'w' ? r.score : -r.score); }
    }, 40);
  };

  const onSquare = (s: number) => {
    if (!myTurn) return;
    const p = cur.board[s];
    if (sel !== null) {
      const cand = legal.filter((m) => m.from === sel && m.to === s);
      if (cand.length) {
        if (cand[0].promo) setPromo(cand); else play(cand[0]);
        return;
      }
    }
    if (p && (p > 0) === (you === 'w')) setSel(s === sel ? null : s); else setSel(null);
  };

  /* ---- captured pieces + material ---- */
  const { capByYou, capByAi, diff } = useMemo(() => {
    const have: Record<string, number> = {};
    for (const p of cur.board) if (p) have[String(p)] = (have[String(p)] || 0) + 1;
    const full: Record<number, number> = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };
    const missing = (white: boolean) => {
      const out: number[] = [];
      for (const t of [5, 4, 3, 2, 1]) { const n = full[t] - (have[String(white ? t : -t)] || 0); for (let i = 0; i < Math.max(0, n); i++) out.push(t); }
      return out;
    };
    const missW = missing(true), missB = missing(false);
    const sum = (a: number[]) => a.reduce((x, t) => x + START_VAL[t], 0);
    const youWhite = you === 'w';
    return { capByYou: youWhite ? missB : missW, capByAi: youWhite ? missW : missB, diff: (youWhite ? sum(missB) - sum(missW) : sum(missW) - sum(missB)) };
  }, [cur, you]);


  const checkSq = !over && C.inCheck(cur) ? cur.board.indexOf(cur.turn === 'w' ? C.K : -C.K) : -1;

  const targets = useMemo(() => new Set(sel === null ? [] : legal.filter((m) => m.from === sel).map((m) => m.to)), [sel, legal]);

  const order = orient === 'w' ? [...Array(64).keys()] : [...Array(64).keys()].reverse();
  const pgn = sans.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + m).join(' ');

  // evaluation bar: sigmoid of centipawns, from White's side
  const whitePct = Math.round(100 / (1 + Math.exp(-evalCp / 400)));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,34rem)_1fr]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-zinc-400">
          <Captured pieces={capByAi} light={you === 'b'} label="AI took" />
          {diff < 0 && <span className="text-red-400">{diff}</span>}
        </div>

        <div className="flex gap-2">
          <div className="hidden w-3 shrink-0 flex-col overflow-hidden rounded-full border border-zinc-700 sm:flex" aria-hidden="true" title="Engine evaluation">
            <div className="transition-all duration-500" style={{ height: `${orient === 'w' ? 100 - whitePct : whitePct}%`, background: orient === 'w' ? '#18181b' : '#f4f4f5' }} />
            <div className="flex-1 transition-all duration-500" style={{ background: orient === 'w' ? '#f4f4f5' : '#18181b' }} />
          </div>
          <div className="relative aspect-square w-full select-none overflow-hidden rounded-lg border border-zinc-700 shadow-xl" role="grid" aria-label="Chess board">
            <div className="grid h-full w-full grid-cols-8 grid-rows-8">
              {order.map((s) => {
                const f = C.fileOf(s), r = C.rankOf(s), dark = (f + r) % 2 === 0;
                const p = cur.board[s];
                const isSel = sel === s, isT = targets.has(s);
                const isLast = lastMove && (lastMove.from === s || lastMove.to === s);
                const isHint = hint && (hint.from === s || hint.to === s);
                const isCheck = checkSq === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="gridcell"
                    aria-label={`${C.name(s)}${p ? ' ' + (p > 0 ? 'white' : 'black') + ' ' + ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'][Math.abs(p)] : ''}`}
                    onClick={() => onSquare(s)}
                    draggable={!!p && myTurn && (p > 0) === (you === 'w')}
                    onDragStart={(e) => { setSel(s); e.dataTransfer.setData('text/plain', String(s)); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); onSquare(s); }}
                    className={`relative flex items-center justify-center ${dark ? 'bg-[#4b5563]' : 'bg-[#cbd5e1]'} ${isLast ? 'after:absolute after:inset-0 after:bg-accent/30' : ''} ${isSel ? 'ring-2 ring-inset ring-accent' : ''} ${isHint ? 'ring-2 ring-inset ring-amber-400' : ''} ${isCheck ? 'bg-red-500/70' : ''}`}
                  >
                    {(orient === 'w' ? f === 0 : f === 7) && <span className={`pointer-events-none absolute left-0.5 top-0 font-mono text-[9px] ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>{r + 1}</span>}
                    {(orient === 'w' ? r === 0 : r === 7) && <span className={`pointer-events-none absolute bottom-0 right-0.5 font-mono text-[9px] ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>{'abcdefgh'[f]}</span>}
                    {p !== 0 && (
                      <span
                        key={`${s}-${p}`}
                        className="g-pop z-10 text-[clamp(1.6rem,8vw,3rem)] leading-none"
                        style={{
                          color: p > 0 ? '#fafafa' : '#18181b',
                          WebkitTextStroke: p > 0 ? '1.2px #18181b' : '1px #e4e4e7',
                          textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                        }}
                      >
                        {GLYPH[Math.abs(p)] + TEXT}
                      </span>
                    )}
                    {isT && (p ? <span className="absolute inset-1 rounded-full border-4 border-accent/70" /> : <span className="absolute h-1/4 w-1/4 rounded-full bg-accent/70" />)}
                  </button>
                );
              })}
            </div>
            {promo && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm" role="dialog" aria-label="Choose promotion">
                <div className="rounded-xl border border-accent/40 bg-zinc-900 p-4 text-center">
                  <p className="mb-2 font-mono text-xs text-zinc-300">Promote to</p>
                  <div className="flex gap-2">
                    {[C.Q, C.R, C.B, C.N].map((t) => (
                      <button key={t} type="button" onClick={() => play(promo.find((m) => m.promo === t)!)} className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-3xl hover:border-accent" style={{ color: you === 'w' ? '#fafafa' : '#a1a1aa' }} aria-label={['', '', 'knight', 'bishop', 'rook', 'queen'][t]}>
                        {GLYPH[t] + TEXT}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-zinc-400">
          <Captured pieces={capByYou} light={you === 'w'} label="You took" />
          {diff > 0 && <span className="text-emerald-400">+{diff}</span>}
        </div>

        {outcome ? (
          <Banner tone={outcome.tone} title={outcome.title} text={outcome.text} action={<Btn variant="solid" icon="play" onClick={newGame}>Play again</Btn>} />
        ) : (
          <p className="min-h-6 font-mono text-xs text-zinc-400" role="status" aria-live="polite">
            {thinking ? <span className="text-accent">AI is thinking…</span> : myTurn ? (C.inCheck(cur) ? <span className="text-red-400">Check! Your move.</span> : 'Your move.') : ''}
          </p>
        )}
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="AI level" value={level} onChange={setLevel} options={C.LEVELS.map((l) => ({ id: l.id, label: l.label }))} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Your colour" value={side} onChange={setSide} options={[{ id: 'w', label: 'White' }, { id: 'r', label: 'Random' }, { id: 'b', label: 'Black' }]} />
          <Btn variant="solid" icon="refresh" onClick={newGame}>New game</Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn icon="lightbulb" onClick={askHint} disabled={!myTurn || thinking} title="Show the engine's suggestion">Hint</Btn>
          <Btn icon="undo" onClick={undo} disabled={states.length < 2} title="Take back your last move">Undo</Btn>
          <Btn onClick={() => setFlip((f) => !f)} title="Flip the board">Flip</Btn>
          <Btn onClick={() => setResigned(true)} disabled={over || states.length < 2}>Resign</Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill label="Move" value={cur.full} />
          <Pill label="Turn" value={cur.turn === 'w' ? 'White' : 'Black'} tone="accent" />
          <Pill label="Eval" value={`${evalCp >= 0 ? '+' : ''}${(evalCp / 100).toFixed(1)}`} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <span>Moves</span>
            <button type="button" className="cursor-pointer text-accent hover:underline" onClick={async () => { setCopied(await copyText(pgn)); window.setTimeout(() => setCopied(false), 1500); }} disabled={!sans.length}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <ol ref={listRef} className="grid max-h-44 grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-0.5 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 font-mono text-xs text-zinc-300">
            {sans.length === 0 && <li className="col-span-3 text-zinc-600">No moves yet.</li>}
            {Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => (
              <li key={i} className="contents">
                <span className="text-zinc-600">{i + 1}.</span>
                <span>{sans[i * 2]}</span>
                <span>{sans[i * 2 + 1] ?? ''}</span>
              </li>
            ))}
          </ol>
        </div>
        <Record rec={rec} />
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Click a piece, then a highlighted square (or drag it). Full rules: castling, en passant, promotion, check, checkmate, stalemate, repetition and the 50-move rule. The engine searches with alpha-beta pruning and gets stronger at each level.
        </p>
      </Panel>
    </div>
  );
}

function Captured({ pieces, light, label }: { pieces: number[]; light: boolean; label: string }) {
  return (
    <div className="flex min-h-6 items-center gap-0.5" aria-label={`${label}: ${pieces.length} pieces`}>
      {pieces.length === 0 ? <span className="text-zinc-700">{label}: none</span> : pieces.map((t, i) => (
        <span key={i} className="text-base leading-none" style={{ color: light ? '#fafafa' : '#71717a' }}>{GLYPH[t] + TEXT}</span>
      ))}
    </div>
  );
}
