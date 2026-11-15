// src/components/games/ExternalGames.tsx — "Community / Owner games": web games added in Admin → Games. Embedded in a sandboxed frame or opened in a tab.
'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { ratioCss, type ExtGame } from '@/lib/games/ext';
import { say } from './arcade';

export function useExternalGames(): ExtGame[] {
  const [games, setGames] = useState<ExtGame[]>([]);
  useEffect(() => {
    let alive = true;
    fetch('/api/games', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { games: [] })).then((d) => { if (alive && Array.isArray(d.games)) setGames(d.games); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return games;
}

function Player({ g, onClose }: { g: ExtGame; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { say('ext', 'open'); return () => say('ext', 'leave'); }, []);
  const full = () => { try { void box.current?.requestFullscreen?.(); } catch { /* not allowed */ } };
  return (
    <section aria-label={g.title} className="mb-10 scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><h2 className="truncate text-xl font-bold text-zinc-100 sm:text-2xl">{g.title}</h2><p className="font-mono text-[11px] text-zinc-500">{g.category}{g.tags.length ? ' · ' + g.tags.join(', ') : ''}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={full} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-3 font-mono text-[11px] text-zinc-300 hover:border-accent/50 hover:text-accent"><Icon name="layout" size={13} />FULLSCREEN</button>
          <a href={g.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 font-mono text-[11px] text-zinc-300 hover:border-accent/50 hover:text-accent"><Icon name="external" size={13} />NEW TAB</a>
          <button type="button" onClick={onClose} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-3 font-mono text-[11px] text-zinc-300 hover:border-accent/50 hover:text-accent"><Icon name="close" size={13} />CLOSE</button>
        </div>
      </div>
      <div ref={box} className="relative mx-auto w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black" style={{ aspectRatio: ratioCss(g.ratio), maxHeight: '78vh', maxWidth: g.ratio === '9:16' ? 420 : '100%' }}>
        {!loaded && <div className="absolute inset-0 flex animate-pulse items-center justify-center font-mono text-xs text-zinc-500">LOADING {g.title.toUpperCase()}…</div>}
        {/* The game runs in its own sandbox: its scripts and storage belong to its own address, never to this site. */}
        <iframe title={g.title} src={g.url} loading="lazy" onLoad={() => setLoaded(true)} sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms" allow="fullscreen; gamepad; autoplay" referrerPolicy="no-referrer" className="h-full w-full border-0 bg-black" />
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-500">Blank? This game may not allow embedding. <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Open it in a new tab</a>.</p>
    </section>
  );
}

export default function ExternalGames({ games }: { games: ExtGame[] }) {
  const [open, setOpen] = useState<ExtGame | null>(null);
  if (!games.length) return null;
  const play = (g: ExtGame) => {
    if (g.mode === 'tab') { window.open(g.url, '_blank', 'noopener,noreferrer'); return; }
    setOpen(g);
    window.setTimeout(() => document.getElementById('ext-games')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  return (
    <section id="ext-games" aria-label="Community and owner games" className="mt-12 scroll-mt-20">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><span className="font-mono text-[10px] uppercase tracking-wider text-accent">[COMMUNITY // OWNER_BUILT]</span><h2 className="text-xl font-bold text-zinc-100 sm:text-2xl">Games made by the dev</h2></div>
      </div>
      {open && <Player g={open} onClose={() => setOpen(null)} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <button key={g.id} type="button" onClick={() => play(g)} className="cy-card group cursor-pointer overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-accent">
            <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950">
              {g.cover
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={g.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                : <span className="flex h-full w-full items-center justify-center text-accent/70"><Icon name="gamepad" size={44} /></span>}
              <span className="absolute left-2 top-2 rounded-full border border-zinc-700 bg-black/60 px-2 py-0.5 font-mono text-[10px] text-zinc-300 backdrop-blur">{g.category}</span>
            </div>
            <div className="p-4">
              <h3 className="text-base font-bold text-zinc-100">{g.title}</h3>
              {g.desc && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">{g.desc}</p>}
              <div className="mt-3 flex items-center justify-between font-mono text-[11px]"><span className="text-zinc-600">{g.mode === 'tab' ? 'opens in a new tab' : 'plays here'}</span><span className="inline-flex items-center gap-1 text-accent">PLAY <Icon name={g.mode === 'tab' ? 'external' : 'arrow'} size={12} /></span></div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
