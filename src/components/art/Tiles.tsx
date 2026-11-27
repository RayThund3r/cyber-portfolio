// src/components/art/Tiles.tsx — the grid of pieces, as a masonry (nothing cropped) or an even grid.
'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { colorOf, imgSrc, ratioOf, toneOf, type Art } from './types';

function Tile({ art, even, onOpen, priority }: { art: Art; even: boolean; onOpen: (id: string) => void; priority: boolean }) {
  const [ok, setOk] = useState(false);
  const c = colorOf(art);
  return (
    <button type="button" onClick={() => onOpen(art.id)} aria-label={`Open ${art.title}`}
      className={`group relative block w-full cursor-zoom-in overflow-hidden rounded-xl text-left outline-none ring-1 ring-white/10 transition duration-300 focus-visible:ring-2 focus-visible:ring-accent motion-safe:hover:-translate-y-1 ${even ? 'h-full' : ''}`}
      style={{ background: toneOf(art), aspectRatio: even ? undefined : ratioOf(art), ['--c' as string]: c }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc(art, true)} alt={art.title} loading={priority ? 'eager' : 'lazy'} decoding="async" draggable={false}
        ref={(el) => { if (el?.complete && el.naturalWidth) setOk(true); }} onLoad={() => setOk(true)}
        className={`h-full w-full transition duration-700 motion-reduce:transition-none ${even ? 'object-cover' : 'object-cover'} ${ok ? 'opacity-100' : 'opacity-0'} group-hover:scale-[1.04] motion-reduce:group-hover:scale-100`} />
      {/* the piece's own colour glows around it on hover */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" style={{ boxShadow: `0 0 0 1px ${c}99, 0 18px 50px -14px ${c}aa` }} />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-12 opacity-100 transition duration-300 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
        <span className="block truncate text-sm font-semibold text-white">{art.title}</span>
        <span className="block truncate text-[11px] text-zinc-300">{art.category}{art.year ? `, ${art.year}` : ''}</span>
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
            <Tile art={a} even onOpen={onOpen} priority={n < 4} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
      {items.map((a, n) => (
        <li key={a.id} className="mb-3 break-inside-avoid sm:mb-4"><Tile art={a} even={false} onOpen={onOpen} priority={n < 4} /></li>
      ))}
    </ul>
  );
}
