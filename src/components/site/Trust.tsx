// src/components/site/Trust.tsx — public trust sections (headline numbers, reviews, price list, repair promise, map, extra FAQ).
// All text comes from Admin → Content; every section hides itself when it has nothing to show.
'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useCountUp, useStaggerIn } from '@/lib/useGsapEffects';
import { useSiteContent } from '@/context/SiteContentContext';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { formatUGX } from '@/lib/shared';
import Icon from '@/components/ui/Icon';

const label = 'mb-2 font-mono text-[10px] uppercase tracking-widest text-accent sm:text-xs';
const SRC: Record<string, string> = { google: 'Google', whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', other: '' };
const Stars = ({ n }: { n: number }) => <span className="flex gap-0.5 text-base leading-none text-amber-400" role="img" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden="true" className={i <= n ? '' : 'opacity-25'}>★</span>)}</span>;

export function StatsStrip() {
  const { stats } = useSiteContent();
  const ref = useRef<HTMLElement>(null);
  useCountUp(ref, [stats.length]);
  useStaggerIn(ref, [stats.length]);
  if (!stats.length) return null;
  return (
    <section ref={ref} className="mx-auto max-w-7xl border-t border-zinc-900 px-4 py-8 sm:px-8" aria-label="At a glance">
      <dl data-stagger className={`grid gap-3 ${stats.length >= 4 ? 'grid-cols-2 md:grid-cols-4' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {stats.map((s) => <div key={s.label} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 text-center"><dd data-count className="text-2xl font-extrabold tabular-nums tracking-tight text-accent sm:text-3xl">{s.value}</dd><dt className="mt-1 text-xs text-zinc-400">{s.label}</dt></div>)}
      </dl>
    </section>
  );
}

export function ReviewsSection({ limit = 6, bare = false }: { limit?: number; bare?: boolean }) {
  const { reviews, local } = useSiteContent();
  const shown = reviews.filter((r) => r.shown).slice(0, limit);
  const ref = useRef<HTMLDivElement>(null);
  useStaggerIn(ref, [shown.length]);
  if (!shown.length) return null;
  const body = (
    <>
      <div className={label}>[SECTION // CLIENT_FEEDBACK]</div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-zinc-100 sm:text-3xl">What customers say</h2>
        {local.reviewUrl && <a href={local.reviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 transition hover:border-accent hover:text-accent"><Icon name="star" size={13} />Leave a Google review</a>}
      </div>
      <ul data-stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
            <Stars n={r.rating} />
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-zinc-300">“{r.text}”</blockquote>
            <footer className="mt-4 flex items-center gap-3 border-t border-zinc-800/80 pt-3 text-xs">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent/15 font-bold text-accent">{r.name.charAt(0).toUpperCase()}</span>
              <span className="min-w-0"><span className="block truncate font-semibold text-zinc-100">{r.name}</span><span className="block truncate text-zinc-500">{[r.detail, SRC[r.source] && `via ${SRC[r.source]}`].filter(Boolean).join(' · ')}</span></span>
            </footer>
          </li>
        ))}
      </ul>
    </>
  );
  return bare ? <div ref={ref}>{body}</div> : <section ref={ref as React.RefObject<HTMLElement>} className="mx-auto max-w-7xl border-t border-zinc-900 px-4 py-10 sm:px-8 sm:py-14" aria-label="Customer reviews">{body}</section>;
}

export function PriceList() {
  const { prices } = useSiteContent();
  const shown = prices.filter((p) => p.shown);
  const ref = useRef<HTMLElement>(null);
  useStaggerIn(ref, [shown.length]);
  if (!shown.length) return null;
  const groups = [...new Set(shown.map((p) => p.group))];
  return (
    <section ref={ref} className="mt-12 sm:mt-16" aria-labelledby="prices-heading">
      <div className={label}>[SECTION // PRICING]</div>
      <h2 id="prices-heading" className="mb-2 text-2xl font-bold text-zinc-100 sm:text-3xl">Starting prices</h2>
      <p className="mb-6 max-w-2xl text-sm text-zinc-400">Typical prices in UGX. The final amount depends on your device and the parts needed, and we always quote before any work starts.</p>
      <div data-stagger className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g} className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40">
            <h3 className="border-b border-zinc-800/80 bg-zinc-900/60 px-5 py-3 font-mono text-xs uppercase tracking-wider text-accent">{g}</h3>
            <ul className="divide-y divide-zinc-800/60">
              {shown.filter((p) => p.group === g).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                  <span className="min-w-0"><span className="block font-medium text-zinc-100">{p.name}</span>{p.note && <span className="block text-xs text-zinc-500">{p.note}</span>}</span>
                  <span className="flex-none text-right font-semibold tabular-nums text-zinc-100">{p.from ? <>{p.to ? '' : <span className="mr-1 text-xs font-normal text-zinc-500">from</span>}{formatUGX(p.from)}{p.to ? <span className="block text-xs font-normal text-zinc-500">to {formatUGX(p.to)}</span> : null}</> : <span className="text-xs font-normal text-zinc-500">Ask for a quote</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-5"><Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent-strong px-5 font-mono text-xs font-semibold text-black transition hover:bg-accent">GET_AN_EXACT_QUOTE <Icon name="arrow" size={13} /></Link></div>
    </section>
  );
}

export function PromiseCard({ className = '' }: { className?: string }) {
  const { promise } = useSiteContent();
  const ref = useRef<HTMLElement>(null);
  useStaggerIn(ref, [promise.points.length, promise.enabled]);
  if (!promise.enabled || (!promise.intro && !promise.points.length)) return null;
  return (
    <section ref={ref} className={`rounded-2xl border border-accent/30 bg-accent/[0.05] p-5 sm:p-6 ${className}`} aria-label={promise.title}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent/15 text-accent"><Icon name="shield" size={20} /></span>
        <div className="min-w-0"><h2 className="text-lg font-bold text-zinc-100">{promise.title}</h2>{promise.intro && <p className="mt-1 text-sm leading-relaxed text-zinc-400">{promise.intro}</p>}</div>
      </div>
      {promise.points.length > 0 && <ul data-stagger className="mt-4 grid gap-2 sm:grid-cols-2">{promise.points.map((p) => <li key={p} className="flex items-start gap-2 text-sm text-zinc-300"><Icon name="check" size={15} className="mt-0.5 flex-none text-accent" />{p}</li>)}</ul>}
    </section>
  );
}

/** Extra FAQ items the owner added; the services page appends these to its built-in questions. */
export function useExtraFaqs() { return useSiteContent().faqs.filter((f) => f.shown); }

export function FaqJsonLd({ items }: { items: { q: string; a: string }[] }) {
  if (!items.length) return null;
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />;
}

export function MapCard() {
  const { local } = useSiteContent();
  const { business } = useSiteSettings();
  if (!local.showMap) return null;
  const place = business.address || 'Ndejje, Makindye Ssabagabo, Uganda';
  const open = local.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  return (
    <section data-reveal className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40" aria-label="Where to find us">
      <iframe title={`Map: ${place}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-56 w-full border-0 sm:h-64" src={`https://maps.google.com/maps?q=${encodeURIComponent(place)}&output=embed`} />
      <div className="space-y-2 p-5 text-sm">
        <div className="flex items-start gap-2 text-zinc-200"><Icon name="pin" size={16} className="mt-0.5 flex-none text-accent" /><span>{place}</span></div>
        {business.hours && <div className="flex items-start gap-2 text-zinc-400"><Icon name="clock" size={16} className="mt-0.5 flex-none text-accent" /><span>{business.hours}</span></div>}
        {local.areas && <p className="text-xs leading-relaxed text-zinc-500">We serve: {local.areas}</p>}
        {local.directions && <p className="text-xs leading-relaxed text-zinc-400">{local.directions}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <a href={open} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 transition hover:border-accent hover:text-accent"><Icon name="compass" size={13} />Open in Google Maps</a>
          {local.reviewUrl && <a href={local.reviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 transition hover:border-accent hover:text-accent"><Icon name="star" size={13} />Review us on Google</a>}
        </div>
      </div>
    </section>
  );
}
