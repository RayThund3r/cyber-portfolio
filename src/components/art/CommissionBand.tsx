// src/components/art/CommissionBand.tsx — the closing call to action: what can be made, and how to ask.
'use client';

import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';

const KINDS = [
  { icon: 'palette' as const, title: 'Logos and brand identity', text: 'A mark, colours and fonts that work on a signboard and on a phone screen.' },
  { icon: 'layout' as const, title: 'Posters, flyers and social media', text: 'Ready to print or post, sized for where it will be seen.' },
  { icon: 'gift' as const, title: 'Packaging and illustration', text: 'Labels, covers and custom artwork made to your brief.' },
];

export default function CommissionBand() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-8" aria-labelledby="art-cta">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 p-6 sm:p-10 lg:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <h2 id="art-cta" className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">Have something in mind?</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-300 sm:text-base">Tell me what you need and when you need it. I reply with a clear price and a timeline before any work starts.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/contact?type=design" className="inline-flex min-h-12 items-center rounded-full bg-accent-strong px-6 text-sm font-semibold text-black transition hover:brightness-110">Start a project</Link>
              {hasWhatsApp() && (
                <a href={whatsappLink('Hello, I saw your art gallery and I would like a design. ')} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-6 text-sm font-medium text-zinc-100 transition hover:border-white/30 hover:bg-white/5">
                  <Icon name="chat" size={16} /> Chat on WhatsApp
                </a>
              )}
            </div>
          </div>
          <ul className="grid gap-3">
            {KINDS.map((k) => (
              <li key={k.title} className="flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><Icon name={k.icon} size={18} /></span>
                <span><span className="block text-sm font-semibold text-white">{k.title}</span><span className="mt-0.5 block text-[13px] leading-snug text-zinc-400">{k.text}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
