// src/components/art/Spotlight.tsx — the opening of the gallery: one piece at a time on a dark stage, lit by its own colour.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { commissionHref, colorOf, imgSrc, type Art } from './types';

export default function Spotlight({ picks, total, categories, since, onOpen }: { picks: Art[]; total: number; categories: number; since: string; onOpen: (id: string) => void }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const calm = useRef(false);
  useEffect(() => { calm.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }, []);
  useEffect(() => {
    if (picks.length < 2 || hold) return;
    const t = window.setInterval(() => { if (!calm.current && !document.hidden) setI((n) => (n + 1) % picks.length); }, 6500);
    return () => window.clearInterval(t);
  }, [picks.length, hold]);
  useEffect(() => { if (i >= picks.length) setI(0); }, [picks.length, i]);
  const cur = picks[i] ?? null;

  return (
    <section className="relative isolate overflow-hidden border-b border-white/5" aria-label="Featured work">
      {/* each piece tints the whole stage with its own colour; they cross-fade as the spotlight moves */}
      {picks.map((p, n) => (
        <div key={p.id} aria-hidden="true" className="absolute inset-0 -z-10 transition-opacity duration-1000 motion-reduce:transition-none"
          style={{ opacity: n === i ? 1 : 0, background: `radial-gradient(70% 80% at 78% 42%, ${colorOf(p)}55, transparent 70%), radial-gradient(50% 60% at 8% 100%, ${colorOf(p)}22, transparent 70%)` }} />
      ))}

      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-10 pt-10 sm:px-8 sm:pt-14 lg:min-h-[78vh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12 lg:pb-14">
        <div className="max-w-xl">
          <h1 className="text-[clamp(2.3rem,4.6vw,4.2rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-white">
            Logos, posters and brands people remember.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-zinc-300 sm:text-base">
            A selection of my graphic design work. Tap any piece to see it full size, then tell me what you need.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={commissionHref()} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent-strong px-6 text-sm font-semibold text-black transition hover:brightness-110 active:scale-[0.98]">
              Start a project
            </Link>
            <a href="#work" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-zinc-100 backdrop-blur transition hover:border-white/30 hover:bg-white/10">
              Browse the work
              <Icon name="arrowUp" size={15} className="rotate-180" />
            </a>
          </div>
          {total > 0 && (
            <dl className="mt-10 flex gap-8 text-zinc-400">
              <div><dt className="text-xs">Pieces</dt><dd className="text-2xl font-bold tabular-nums text-white">{total}</dd></div>
              <div><dt className="text-xs">Kinds of work</dt><dd className="text-2xl font-bold tabular-nums text-white">{categories}</dd></div>
              {since && <div><dt className="text-xs">Designing since</dt><dd className="text-2xl font-bold tabular-nums text-white">{since}</dd></div>}
            </dl>
          )}
        </div>

        <div className="relative" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
          {cur ? (
            <>
              <div className="relative mx-auto h-[52vh] max-h-[640px] min-h-[300px] w-full lg:h-[62vh]">
                {picks.map((p, n) => (
                  <button key={p.id} type="button" onClick={() => onOpen(p.id)} aria-label={`Open ${p.title} full size`} tabIndex={n === i ? 0 : -1} aria-hidden={n !== i}
                    className="absolute inset-0 flex cursor-zoom-in items-center justify-center outline-none transition-opacity duration-700 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                    style={{ opacity: n === i ? 1 : 0, pointerEvents: n === i ? 'auto' : 'none' }}>
                    {/* the same picture, blurred and enlarged, makes the glow behind it */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgSrc(p, true)} alt="" aria-hidden="true" className="absolute inset-[8%] h-[84%] w-[84%] object-contain opacity-70 blur-3xl saturate-150" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgSrc(p)} alt={p.title} loading={n === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false}
                      className="relative max-h-full max-w-full rounded-lg object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10" />
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{cur.title}</p>
                  <p className="truncate text-xs text-zinc-400">{cur.category}{cur.year ? `, ${cur.year}` : ''}</p>
                </div>
                {picks.length > 1 && (
                  <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Choose a featured piece">
                    {picks.map((p, n) => (
                      <button key={p.id} type="button" onClick={() => setI(n)} aria-label={`Show ${p.title}`} aria-current={n === i}
                        className="flex h-8 w-6 cursor-pointer items-center justify-center">
                        <span className={`block h-1.5 rounded-full transition-all duration-300 ${n === i ? 'w-6' : 'w-1.5 bg-white/30'}`} style={n === i ? { background: colorOf(p) } : undefined} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-[40vh] min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-zinc-500">
              <div><Icon name="palette" size={28} className="mx-auto mb-3 text-zinc-600" />New work is on the way.</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
