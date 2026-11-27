// src/components/art/Tiles.tsx — the grid of pieces, as a masonry (nothing cropped) or an even grid.
'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { colorOf, imgSrc, ratioOf, toneOf, type Art } from './types';

function Tile({ art, even, onOpen, priority, n }: { art: Art; even: boolean; onOpen: (id: string) => void; priority: boolean; n: number }) {
  const [ok, setOk] = useState(false);
  const [seen, setSeen] = useState(priority);
  const [settled, setSettled] = useState(priority);
  useEffect(() => { if (!seen || settled) return; const t = window.setTimeout(() => setSettled(true), 900); return () => window.clearTimeout(t); }, [seen, settled]); // the stagger delay must not slow later hovers
  const box = useRef<HTMLButtonElement>(null);
  // tiles rise into place as they scroll into view (instantly if the browser cannot observe, or motion is reduced)
  useEffect(() => {
    const el = box.current;
    if (seen || !el) return;
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const c = colorOf(art);
  return (
    <button ref={box} type="button" onClick={() => onOpen(art.id)} aria-label={`Open ${art.title}`}
      className={`group relative block w-full cursor-zoom-in overflow-hidden rounded-xl text-left outline-none ring-1 ring-white/10 transition-[transform,opacity,box-shadow] duration-500 ease-out focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] motion-safe:hover:-translate-y-1 ${even ? 'h-full' : ''} ${seen ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
      style={{ background: toneOf(art), aspectRatio: even ? undefined : ratioOf(art), transitionDelay: seen && !settled ? `${(n % 4) * 70}ms` : undefined, ['--c' as string]: c }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc(art, true)} alt={art.title} loading={priority ? 'eager' : 'lazy'} decoding="async" draggable={false}
        ref={(el) => { if (el?.complete && el.naturalWidth) setOk(true); }} onLoad={() => setOk(true)}
        className={`h-full w-full transition duration-700 motion-reduce:transition-none ${even ? 'object-cover' : 'object-cover'} ${ok ? 'opacity-100' : 'opacity-0'} group-hover:scale-[1.04] motion-reduce:group-hover:scale-100`} />
      {/* the piece's own colour glows around it on hover */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" style={{ boxShadow: `0 0 0 1px ${c}99, 0 18px 50px -14px ${c}aa` }} />
      {/* the caption sits on its own soft shade, so the words never blend into the picture. The shade eases in first, the words follow. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 max-h-28 sm:h-2/3 sm:max-h-56 bg-gradient-to-t from-black/95 via-black/65 to-transparent opacity-100 transition-opacity duration-500 ease-in-out sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3 opacity-100 transition-[opacity,transform] duration-500 ease-out sm:translate-y-2 sm:opacity-0 sm:delay-75 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-visible:translate-y-0 sm:group-focus-visible:opacity-100 motion-reduce:transition-none">
        <span className="block truncate text-sm font-semibold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{art.title}</span>
        <span className="block truncate text-[11px] text-zinc-200 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">{art.category}{art.year ? `, ${art.year}` : ''}</span>
      </span>
      {art.featured && <span className="pointer-events-none absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-amber-300 backdrop-blur" title="Featured"><Icon name="star" size={13} /></span>}
    </button>
  );
}

export default function Tiles({ items, layout, onOpen }: { items: Art[]; layout: 'masonry' | 'grid'; onOpen: (id: string) => void }) {
  if (layout === 'grid') {
    return (
      <ul className="grid grid-flow-dense auto-rows-[minmax(0,1fr)] grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {items.map((a, n) => (
          <li key={a.id} className={`${a.featured ? 'col-span-2 row-span-2' : ''} aspect-square`}>
            <Tile art={a} even onOpen={onOpen} priority={n < 4} n={n} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
      {items.map((a, n) => (
        <li key={a.id} className="mb-3 break-inside-avoid sm:mb-4"><Tile art={a} even={false} onOpen={onOpen} priority={n < 4} n={n} /></li>
      ))}
    </ul>
  );
}
