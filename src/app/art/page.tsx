// src/app/art/page.tsx — the graphic design showcase: a spotlight on the featured work, a filterable gallery,
// a full-screen viewer, and a clear way to ask for something similar.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import CommissionBand from '@/components/art/CommissionBand';
import Spotlight from '@/components/art/Spotlight';
import Tiles from '@/components/art/Tiles';
import Viewer from '@/components/art/Viewer';
import type { Art } from '@/components/art/types';

type Sort = 'mine' | 'new' | 'old';
const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };

export default function ArtPage() {
  const [items, setItems] = useState<Art[] | null>(null);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('mine');
  const [layout, setLayout] = useState<'masonry' | 'grid'>('masonry');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/art', { cache: 'no-store' }).then((r) => r.json()).then((d) => setItems(Array.isArray(d.items) ? d.items : [])).catch(() => setItems((x) => x ?? []));
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('site:updated', load); // the owner just saved something
    setLayout(safe(() => (localStorage.getItem('art_layout') === 'grid' ? 'grid' : 'masonry'), 'masonry'));
    const p = new URLSearchParams(location.search);
    if (p.get('piece')) setOpen(p.get('piece'));
    if (p.get('cat')) setCat(p.get('cat') as string);
    return () => window.removeEventListener('site:updated', load);
  }, [load]);

  const pickLayout = (l: 'masonry' | 'grid') => { setLayout(l); safe(() => localStorage.setItem('art_layout', l), undefined); };

  // keep the address bar in step so a piece can be shared: /art?piece=<id>
  useEffect(() => {
    const u = new URL(location.href);
    if (open) u.searchParams.set('piece', open); else u.searchParams.delete('piece');
    if (cat !== 'All') u.searchParams.set('cat', cat); else u.searchParams.delete('cat');
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
  }, [open, cat]);

  const all = useMemo(() => items || [], [items]);
  const counts = useMemo(() => all.reduce<Record<string, number>>((m, a) => ({ ...m, [a.category]: (m[a.category] || 0) + 1 }), {}), [all]);
  const cats = useMemo(() => Object.keys(counts), [counts]);
  useEffect(() => { if (items && cat !== 'All' && !counts[cat]) setCat('All'); }, [items, cat, counts]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let l = all.filter((a) => (cat === 'All' || a.category === cat) && (!needle || `${a.title} ${a.category} ${a.description} ${a.tools.join(' ')}`.toLowerCase().includes(needle)));
    if (sort === 'new') l = [...l].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    if (sort === 'old') l = [...l].sort((a, b) => Number(a.year || 9999) - Number(b.year || 9999));
    return l;
  }, [all, cat, q, sort]);

  const picks = useMemo(() => {
    const f = all.filter((a) => a.featured);
    return (f.length ? f : all).slice(0, 5);
  }, [all]);
  const since = useMemo(() => { const ys = all.map((a) => Number(a.year)).filter((y) => y > 1990); return ys.length ? String(Math.min(...ys)) : ''; }, [all]);

  // the viewer walks through whatever is currently shown; a shared link may point at a piece outside the filter
  const viewList = useMemo(() => (open && !shown.some((a) => a.id === open) ? all : shown), [open, shown, all]);
  const vIndex = open ? viewList.findIndex((a) => a.id === open) : -1;
  const openId = useCallback((id: string) => setOpen(id), []);
  const close = useCallback(() => setOpen(null), []);
  useEffect(() => { if (open && items && !items.some((a) => a.id === open)) setOpen(null); }, [open, items]);

  const chip = (on: boolean) => `min-h-10 shrink-0 cursor-pointer rounded-full border px-4 text-[13px] transition-colors ${on ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-zinc-100'}`;
  const seg = (on: boolean) => `flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors ${on ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-zinc-200'}`;

  return (
    <main className="flex-1 bg-zinc-950 text-zinc-100">
      <Spotlight picks={picks} total={all.length} categories={cats.length} since={since} onOpen={openId} />

      <section id="work" className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-12 sm:px-8" aria-label="Gallery">
        {all.length > 0 && (
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0" role="group" aria-label="Filter by kind of work">
              <button type="button" aria-pressed={cat === 'All'} onClick={() => setCat('All')} className={chip(cat === 'All')}>All <span className="ml-1 text-zinc-500">{all.length}</span></button>
              {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={chip(cat === c)}>{c} <span className="ml-1 text-zinc-500">{counts[c]}</span></button>)}
            </div>
            <div className="flex items-center gap-2">
              <label className="relative min-w-0 flex-1 lg:w-56 lg:flex-none">
                <span className="sr-only">Search the gallery</span>
                <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={40} placeholder="Search" className="h-10 w-full rounded-full border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-accent" />
              </label>
              <label className="shrink-0">
                <span className="sr-only">Order</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 cursor-pointer rounded-full border border-white/10 bg-zinc-950 px-3 text-[13px] text-zinc-300 outline-none focus:border-accent">
                  <option value="mine">My order</option><option value="new">Newest first</option><option value="old">Oldest first</option>
                </select>
              </label>
              <div className="flex shrink-0 rounded-xl border border-white/10 p-0.5" role="group" aria-label="Layout">
                <button type="button" className={seg(layout === 'masonry')} onClick={() => pickLayout('masonry')} aria-pressed={layout === 'masonry'} aria-label="Masonry layout" title="Masonry"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="9" rx="1.5" /><rect x="13" y="4" width="7" height="5" rx="1.5" /><rect x="13" y="11" width="7" height="9" rx="1.5" /><rect x="4" y="15" width="7" height="5" rx="1.5" /></svg></button>
                <button type="button" className={seg(layout === 'grid')} onClick={() => pickLayout('grid')} aria-pressed={layout === 'grid'} aria-label="Even grid" title="Even grid"><Icon name="grid" size={16} /></button>
              </div>
            </div>
          </div>
        )}

        {items === null ? (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4" aria-busy="true" aria-label="Loading the gallery">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="mb-3 animate-pulse rounded-xl bg-zinc-900 motion-reduce:animate-none" style={{ height: 150 + ((i * 59) % 150) }} />)}
          </div>
        ) : all.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
            <Icon name="palette" size={28} className="mx-auto text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-300">The gallery is being set up.</p>
            <p className="mt-1 text-xs text-zinc-500">New work will appear here soon. You can already ask for a design.</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <p className="text-sm text-zinc-300">Nothing matches “{q}”.</p>
            <button type="button" onClick={() => { setQ(''); setCat('All'); }} className="mt-3 cursor-pointer text-sm text-accent hover:underline">Show everything</button>
          </div>
        ) : (
          <Tiles items={shown} layout={layout} onOpen={openId} />
        )}
      </section>

      <CommissionBand />

      {open && vIndex >= 0 && <Viewer items={viewList} index={vIndex} onIndex={(i) => setOpen(viewList[i].id)} onClose={close} />}
    </main>
  );
}
