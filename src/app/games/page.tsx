// src/app/games/page.tsx
//
// The games hub: a catalogue of brain games (several with a real search-based AI opponent) plus the
// stage where the chosen game runs. Every game is lazy-loaded, so the hub itself stays light.
// `?g=chess` opens a game directly (the chat and terminal use that).
'use client';

import { Component, lazy, ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { GAME_IDS, GAMES, GROUP_LABEL, GameGroup, GameInfo } from '@/data/gamesData';
import { openChat } from '@/lib/chatBus';
import { readAll } from '@/components/games/ui';
import { useReveal } from '@/lib/useGsapEffects';

const LOADERS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  chess: lazy(() => import('@/components/games/ChessGame')),
  connect4: lazy(() => import('@/components/games/Connect4Game')),
  reversi: lazy(() => import('@/components/games/ReversiGame')),
  tictactoe: lazy(() => import('@/components/games/TicTacToeGame')),
  sudoku: lazy(() => import('@/components/games/SudokuGame')),
  minesweeper: lazy(() => import('@/components/games/MinesweeperGame')),
  '2048': lazy(() => import('@/components/games/Game2048')),
  memory: lazy(() => import('@/components/games/MemoryGame')),
  simon: lazy(() => import('@/components/games/SimonGame')),
  math: lazy(() => import('@/components/games/MathSprintGame')),
  checkers: lazy(() => import('@/components/games/CheckersGame')),
  gomoku: lazy(() => import('@/components/games/GomokuGame')),
  mastermind: lazy(() => import('@/components/games/MastermindGame')),
  lightsout: lazy(() => import('@/components/games/LightsOutGame')),
  sliding: lazy(() => import('@/components/games/SlidingGame')),
  twentyfour: lazy(() => import('@/components/games/TwentyFourGame')),
  nim: lazy(() => import('@/components/games/NimGame')),
};

type Filter = 'all' | GameGroup;
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'ai', label: GROUP_LABEL.ai },
  { id: 'puzzle', label: GROUP_LABEL.puzzle },
  { id: 'memory', label: GROUP_LABEL.memory },
  { id: 'speed', label: GROUP_LABEL.speed },
];

/** A broken game must never take the whole page down. */
class GameBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center">
        <p className="font-mono text-sm font-bold text-red-300">This game hit a problem.</p>
        <p className="mt-1 text-xs text-zinc-400">Nothing else is affected. Go back and try again or pick another game.</p>
        <button type="button" onClick={this.props.onBack} className="mt-4 cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-200 hover:border-accent/50">
          BACK TO GAMES
        </button>
      </div>
    );
  }
}

function Skeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6" aria-busy="true" aria-label="Loading game">
      <div className="h-5 w-40 rounded bg-zinc-800" />
      <div className="mt-4 aspect-square max-w-md rounded-xl bg-zinc-800/60" />
    </div>
  );
}

function summary(id: string): string | null {
  const r = readAll()[id];
  if (!r) return null;
  const parts: string[] = [];
  if (r.w || r.l || r.d) parts.push(`${r.w}W ${r.l}L ${r.d}D`);
  if (r.best) parts.push(`best ${r.best}`);
  return parts.length ? parts.join(' · ') : null;
}

function GamesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const pageRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useReveal(pageRef);

  const fromUrl = (params?.get('g') || '').toLowerCase();
  const [active, setActive] = useState<string | null>(GAME_IDS.includes(fromUrl) ? fromUrl : null);
  const [filter, setFilter] = useState<Filter>('all');
  const [records, setRecords] = useState<Record<string, string | null>>({});
  // Games read localStorage and use Math.random for their first board, so they only render on the client
  // (avoids a server/client hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Follow the URL (chat / terminal / back button) but never fight local selection.
  const lastUrl = useRef(fromUrl);
  useEffect(() => {
    if (fromUrl === lastUrl.current) return;
    lastUrl.current = fromUrl;
    setActive(GAME_IDS.includes(fromUrl) ? fromUrl : null);
  }, [fromUrl]);

  useEffect(() => {
    setRecords(Object.fromEntries(GAMES.map((g) => [g.id, summary(g.id)])));
  }, [active]);

  const open = useCallback(
    (id: string | null) => {
      setActive(id);
      lastUrl.current = id || '';
      router.replace(id ? `/games?g=${id}` : '/games', { scroll: false });
      window.setTimeout(() => (id ? stageRef.current : pageRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    },
    [router]
  );

  const shown = useMemo(() => GAMES.filter((g) => filter === 'all' || g.group === filter), [filter]);
  const game: GameInfo | undefined = GAMES.find((g) => g.id === active);
  const Active = active ? LOADERS[active] : null;
  const surprise = () => open(GAME_IDS[Math.floor(Math.random() * GAME_IDS.length)]);

  return (
    <div ref={pageRef} className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
      <header data-reveal className="mb-8 border-b border-zinc-800/80 pb-8">
        <div className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">[SECTION // ARCADE_&amp;_BRAIN_LAB]</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-5xl">Brain games</h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
          {GAMES.length} games that run entirely in your browser. No sign-up, nothing is sent anywhere, and the AI opponents are real search engines, not scripted bots.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={surprise} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent-strong px-4 py-2 font-mono text-xs font-bold text-zinc-950 transition hover:opacity-90 active:scale-95">
            <Icon name="spark" size={14} /> SURPRISE ME
          </button>
          <button type="button" onClick={() => openChat({ send: 'Which game should I play?' })} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-200 transition hover:border-accent/50 hover:text-accent active:scale-95">
            <Icon name="chat" size={14} /> ASK THE ASSISTANT
          </button>
        </div>
      </header>

      {/* Stage */}
      {mounted && game && Active && (
        <section ref={stageRef} aria-labelledby="game-title" className="mb-10 scroll-mt-20">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                <Icon name={game.icon} size={18} />
              </span>
              <div>
                <h2 id="game-title" className="text-xl font-bold text-zinc-100 sm:text-2xl">{game.title}</h2>
                <p className="font-mono text-[11px] text-zinc-500">{game.skills}</p>
              </div>
            </div>
            <button type="button" onClick={() => open(null)} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-3 font-mono text-[11px] text-zinc-300 transition hover:border-accent/50 hover:text-accent">
              <span aria-hidden="true">←</span> ALL GAMES
            </button>
          </div>
          <GameBoundary key={active} onBack={() => open(null)}>
            <Suspense fallback={<Skeleton />}>
              <Active />
            </Suspense>
          </GameBoundary>
        </section>
      )}

      {/* Catalogue */}
      <section aria-label="Game catalogue">
        <div className="mb-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Filter games">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-9 cursor-pointer rounded-full border px-3.5 font-mono text-[11px] transition ${
                filter === f.id ? 'border-accent bg-accent/15 text-accent' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => {
            const on = g.id === active;
            const rec = records[g.id];
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => open(g.id)}
                aria-current={on ? 'true' : undefined}
                data-reveal
                className={`group cursor-pointer rounded-xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-accent ${
                  on ? 'border-accent bg-accent/[0.07]' : 'border-zinc-800 bg-zinc-900/40 hover:border-accent/50 hover:bg-zinc-900/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                    <Icon name={g.icon} size={20} />
                  </span>
                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-[10px] text-zinc-400">{GROUP_LABEL[g.group]}</span>
                </div>
                <h3 className="mt-3 text-base font-bold text-zinc-100">{g.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{g.tagline}</p>
                <p className="mt-2 flex gap-1.5 text-[11px] leading-snug text-zinc-500">
                  <Icon name="cpu" size={13} className="mt-0.5 text-accent/80" />
                  {g.ai}
                </p>
                <div className="mt-3 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-zinc-600">{rec || g.skills}</span>
                  <span className="inline-flex items-center gap-1 text-accent">
                    {on ? 'PLAYING' : 'PLAY'} <Icon name="arrow" size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** useSearchParams needs a Suspense boundary for the static build (same pattern as the contact page). */
export default function GamesPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-14 sm:px-8"><Skeleton /></div>}>
      <GamesInner />
    </Suspense>
  );
}
