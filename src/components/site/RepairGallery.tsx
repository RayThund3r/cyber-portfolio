// src/components/site/RepairGallery.tsx — "Recent work": drag-to-compare before / after pairs. Managed in Admin → Build → Repairs.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';

interface Job { id: string; title: string; note: string; kind: 'repair' | 'design'; w: number; h: number; v: number }

/** A picture you can drag across: the "before" is revealed from the left, the "after" is underneath. It sweeps once when it scrolls into view. */
export function BeforeAfter({ job }: { job: Job }) {
  const [pos, setPos] = useState(50);
  const [easing, setEasing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver((es) => {
      if (played.current || !es.some((e) => e.isIntersecting && e.intersectionRatio > 0.5)) return;
      played.current = true; io.disconnect();
      setEasing(true); setPos(16);
      timers.push(window.setTimeout(() => setPos(84), 700), window.setTimeout(() => setPos(50), 1500), window.setTimeout(() => setEasing(false), 2200));
    }, { threshold: [0.5] });
    io.observe(el);
    return () => { io.disconnect(); timers.forEach(window.clearTimeout); };
  }, []);
  const ratio = job.w > 0 && job.h > 0 ? job.w / job.h : 4 / 3;
  const src = (s: 'before' | 'after') => `/api/repairs/${job.id}?s=${s}&v=${job.v}`;
  return (
    <div ref={ref} className="relative isolate select-none overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900" style={{ aspectRatio: ratio }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src('after')} alt={`${job.title}, after`} loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)`, transition: easing ? 'clip-path 700ms cubic-bezier(.65,0,.35,1)' : 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src('before')} alt={`${job.title}, before`} loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur" style={{ opacity: pos > 14 ? 1 : 0, transition: 'opacity 200ms' }}>Before</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-accent-strong px-2.5 py-1 text-[11px] font-semibold text-black" style={{ opacity: pos < 86 ? 1 : 0, transition: 'opacity 200ms' }}>After</span>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,0.6)]" style={{ left: `${pos}%`, transition: easing ? 'left 700ms cubic-bezier(.65,0,.35,1)' : 'none' }}>
        <span className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/55 text-white backdrop-blur">
          <Icon name="chevron-left" size={13} /><Icon name="chevron-right" size={13} />
        </span>
      </div>
      <input type="range" min={0} max={100} step={1} value={pos} aria-label={`Compare before and after: ${job.title}`} onChange={(e) => { setEasing(false); setPos(Number(e.target.value)); }}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" style={{ touchAction: 'pan-y' }} />
    </div>
  );
}

export default function RepairGallery() {
  const [items, setItems] = useState<Job[]>([]);
  const load = useCallback(() => { fetch('/api/repairs', { cache: 'no-store' }).then((r) => r.json()).then((d) => setItems(Array.isArray(d.items) ? d.items : [])).catch(() => undefined); }, []);
  useEffect(() => { load(); window.addEventListener('site:updated', load); return () => window.removeEventListener('site:updated', load); }, [load]);
  if (!items.length) return null;
  return (
    <section id="recent-work" className="mt-12 scroll-mt-24 sm:mt-16" aria-labelledby="recent-heading">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent sm:text-xs">[SECTION // RECENT_WORK]</div>
      <h2 id="recent-heading" className="mb-2 text-2xl font-bold text-zinc-100 sm:text-3xl">Recent work</h2>
      <p className="mb-6 max-w-2xl text-sm text-zinc-400">Drag across each picture to see the difference between how it arrived and how it left.</p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((j) => (
          <figure key={j.id}>
            <BeforeAfter job={j} />
            <figcaption className="mt-3">
              <span className="block text-sm font-semibold text-zinc-100">{j.title}</span>
              {j.note && <span className="block text-xs leading-relaxed text-zinc-400">{j.note}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
