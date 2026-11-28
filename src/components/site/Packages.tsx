// src/components/site/Packages.tsx — fixed-scope offers (logo pack, laptop tune-up, remote clean-up…) with a price, a turnaround
// and what is included. Everything comes from Admin → Content → Packages; the section hides itself when there is nothing to show.
'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useStaggerIn } from '@/lib/useGsapEffects';
import { useSiteContent } from '@/context/SiteContentContext';
import { formatUGX } from '@/lib/shared';
import Icon from '@/components/ui/Icon';
import type { Package } from '@/lib/siteContent';

const KIND: Record<Package['kind'], { label: string; icon: 'palette' | 'wrench' | 'wifi'; type: 'design' | 'repair' }> = {
  design: { label: 'Design', icon: 'palette', type: 'design' },
  repair: { label: 'Repairs', icon: 'wrench', type: 'repair' },
  remote: { label: 'Remote', icon: 'wifi', type: 'repair' },
};
export const packageHref = (k: Package) => `/contact?type=${KIND[k.kind].type}&pkg=${encodeURIComponent(k.name.slice(0, 60))}`;

export function PackageCard({ k }: { k: Package }) {
  const meta = KIND[k.kind];
  return (
    <article data-stagger className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-zinc-900/50 p-5 transition duration-300 motion-safe:hover:-translate-y-1 ${k.popular ? 'border-accent/50 shadow-[0_18px_50px_-24px_var(--color-accent)]' : 'border-zinc-800/80 hover:border-zinc-600'}`}>
      {k.popular && <span className="absolute right-4 top-4 rounded-full bg-accent-strong px-2.5 py-1 text-[11px] font-semibold text-black">Most popular</span>}
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-accent"><Icon name={meta.icon} size={18} /></span>
      <h3 className="mt-4 text-lg font-bold text-zinc-100">{k.name}</h3>
      {k.blurb && <p className="mt-1 text-sm leading-relaxed text-zinc-400">{k.blurb}</p>}
      <p className="mt-4 text-2xl font-extrabold tabular-nums text-white">{k.from ? <><span className="mr-1.5 text-xs font-normal text-zinc-500">from</span>{formatUGX(k.from)}</> : <span className="text-base font-semibold text-zinc-300">Ask for a quote</span>}</p>
      {k.turnaround && <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-zinc-400"><Icon name="clock" size={12} />{k.turnaround}</p>}
      {k.includes.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-zinc-800/80 pt-4 text-sm text-zinc-300">
          {k.includes.map((x) => <li key={x} className="flex items-start gap-2"><Icon name="check" size={14} className="mt-0.5 flex-none text-accent" />{x}</li>)}
        </ul>
      )}
      <Link href={packageHref(k)} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-strong px-4 text-sm font-semibold text-black transition hover:bg-accent active:scale-[0.98] sm:mt-auto sm:pt-0">
        Start this package <Icon name="arrow" size={14} />
      </Link>
    </article>
  );
}

export function PackagesSection({ kinds, title = 'Packages', intro, className = 'mt-12 sm:mt-16' }: { kinds?: Package['kind'][]; title?: string; intro?: string; className?: string }) {
  const { packages, remote } = useSiteContent();
  const list = useMemo(() => packages.filter((k) => k.shown && (!kinds || kinds.includes(k.kind))), [packages, kinds]);
  const kindsHere = [...new Set(list.map((k) => k.kind))];
  const [tab, setTab] = useState<'all' | Package['kind']>('all');
  const ref = useRef<HTMLElement>(null);
  const view = tab === 'all' ? list : list.filter((k) => k.kind === tab);
  useStaggerIn(ref, [view.length, tab]);
  if (!list.length) return null;
  const chip = (on: boolean) => `min-h-10 cursor-pointer rounded-full border px-4 text-[13px] transition-colors ${on ? 'border-accent bg-accent/15 text-accent' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100'}`;
  return (
    <section ref={ref} className={className} aria-labelledby="packages-heading">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent sm:text-xs">[SECTION // PACKAGES]</div>
      <h2 id="packages-heading" className="mb-2 text-2xl font-bold text-zinc-100 sm:text-3xl">{title}</h2>
      <p className="mb-6 max-w-2xl text-sm text-zinc-400">{intro || 'Clear scope, a starting price and a turnaround. We confirm the final amount with you before any work starts.'}</p>
      {kindsHere.length > 1 && !kinds && (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter packages">
          <button type="button" aria-pressed={tab === 'all'} className={chip(tab === 'all')} onClick={() => setTab('all')}>All</button>
          {kindsHere.map((x) => <button key={x} type="button" aria-pressed={tab === x} className={chip(tab === x)} onClick={() => setTab(x)}>{KIND[x].label}</button>)}
        </div>
      )}
      <div key={tab} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{view.map((k) => <PackageCard key={k.id} k={k} />)}</div>
      {!kinds && list.some((k) => k.kind === 'remote') && remote.enabled && <p className="mt-4 text-sm text-zinc-400">Remote packages are done over the internet while you watch. <Link href="/remote" className="text-accent hover:underline">See how remote support works</Link>.</p>}
    </section>
  );
}
