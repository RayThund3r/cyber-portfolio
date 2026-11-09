// src/components/games/MemoryGame.tsx — memory match with four sizes, moves, timer and personal bests.
'use client';

import { useEffect, useRef, useState } from 'react';
import Icon, { IconName } from '@/components/ui/Icon';
import { Banner, Btn, Panel, Pill, Segmented, fmt, useRecord, useStopwatch } from './ui';

const ICONS: IconName[] = ['chat', 'home', 'wrench', 'search', 'shield', 'clock', 'cpu', 'battery', 'phone', 'bolt', 'droplet', 'disk', 'star', 'heart', 'key', 'globe', 'lock', 'bell'];
const COLORS = ['text-cyan-300', 'text-amber-300', 'text-emerald-300', 'text-rose-300', 'text-violet-300', 'text-sky-300'];
const SIZES = { easy: { pairs: 6, cols: 4 }, medium: { pairs: 8, cols: 4 }, hard: { pairs: 12, cols: 6 }, insane: { pairs: 18, cols: 6 } } as const;
type Size = keyof typeof SIZES;

interface Card { id: number; icon: IconName; color: string; open: boolean; done: boolean }

function deal(size: Size): Card[] {
  const picks = [...ICONS].sort(() => Math.random() - 0.5).slice(0, SIZES[size].pairs);
  const cards = picks.flatMap((icon, k) => [0, 1].map(() => ({ icon, color: COLORS[k % COLORS.length] })));
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards.map((c, i) => ({ id: i, ...c, open: false, done: false }));
}

export default function MemoryGame() {
  const { rec, win, time } = useRecord('memory');
  const [size, setSize] = useState<Size>('medium');
  const [cards, setCards] = useState<Card[]>([]);
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState(false);
  const [game, setGame] = useState(0);
  const lock = useRef(false);
  const counted = useRef(false);
  const won = cards.length > 0 && cards.every((c) => c.done);
  const secs = useStopwatch(started && !won, game);

  const reset = (s: Size = size) => { setCards(deal(s)); setMoves(0); setStarted(false); setGame((g) => g + 1); counted.current = false; lock.current = false; };
  useEffect(() => reset('medium'), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!won || counted.current) return;
    counted.current = true; win(); time(`${size}`, secs);
  }, [won, win, time, size, secs]);

  const flip = (id: number) => {
    if (lock.current) return;
    const c = cards.find((x) => x.id === id)!;
    if (c.open || c.done) return;
    setStarted(true);
    const next = cards.map((x) => (x.id === id ? { ...x, open: true } : x));
    const open = next.filter((x) => x.open && !x.done);
    setCards(next);
    if (open.length === 2) {
      setMoves((m) => m + 1);
      lock.current = true;
      if (open[0].icon === open[1].icon) {
        window.setTimeout(() => { setCards((cs) => cs.map((x) => (x.open ? { ...x, open: false, done: true } : x))); lock.current = false; }, 350);
      } else {
        window.setTimeout(() => { setCards((cs) => cs.map((x) => (x.done ? x : { ...x, open: false }))); lock.current = false; }, 800);
      }
    }
  };

  const perfect = SIZES[size].pairs;
  const stars = moves <= perfect * 1.5 ? 3 : moves <= perfect * 2.2 ? 2 : 1;
  const cols = SIZES[size].cols;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,34rem)_1fr]">
      <div className="space-y-3">
        <div className="mx-auto grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 6}rem` }} role="grid" aria-label="Memory cards">
          {cards.map((c) => (
            <button key={c.id} type="button" role="gridcell" onClick={() => flip(c.id)} aria-label={c.open || c.done ? c.icon : 'hidden card'}
              className={`flex aspect-square cursor-pointer items-center justify-center rounded-xl border transition duration-300 ${c.done ? 'border-emerald-500/40 bg-emerald-500/10 opacity-70' : c.open ? 'border-accent bg-zinc-800' : 'border-zinc-700 bg-zinc-900 hover:border-accent/60'}`}>
              {(c.open || c.done) ? <span key={String(c.open)} className={`g-pop ${c.color}`}><Icon name={c.icon} size={size === 'insane' || size === 'hard' ? 24 : 32} /></span> : <span className="font-mono text-lg text-zinc-700">?</span>}
            </button>
          ))}
        </div>
        {won && <Banner tone="win" title={`All pairs found in ${moves} moves, ${fmt(secs)}`} text={`${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  (a perfect game is ${perfect} moves)`} action={<Btn variant="solid" icon="play" onClick={() => reset()}>Play again</Btn>} />}
      </div>
      <Panel className="space-y-4">
        <Segmented label="Size" value={size} onChange={(s) => { setSize(s); reset(s); }} options={[{ id: 'easy', label: '12' }, { id: 'medium', label: '16' }, { id: 'hard', label: '24' }, { id: 'insane', label: '36' }]} />
        <div className="flex flex-wrap gap-2"><Pill label="Moves" value={moves} tone="accent" /><Pill label="Time" value={fmt(secs)} /><Pill label="Pairs" value={`${cards.filter((c) => c.done).length / 2}/${perfect}`} />{rec.times?.[size] !== undefined && <Pill label="Best time" value={fmt(rec.times[size])} />}</div>
        <Btn variant="solid" icon="refresh" onClick={() => reset()}>Shuffle / new game</Btn>
        <p className="font-mono text-[11px] text-zinc-500">Games cleared: <span className="text-emerald-400">{rec.w}</span></p>
        <p className="text-[11px] leading-relaxed text-zinc-500">Flip two cards at a time and match the pairs. Fewer moves earn more stars. Good for working memory: try to remember positions instead of re-flipping.</p>
      </Panel>
    </div>
  );
}
