// src/app/services/page.tsx
//
// Service data now lives in data/servicesData.ts (the chat assistant reads the same facts).
// The page-level header/footer were removed in favour of the shared SiteNav / SiteFooter.
'use client';

import { useRef } from 'react';
import Link from 'next/link';
import RepairShowcase from '@/components/RepairShowcase';
import { PROCESS_STEPS, SERVICES } from '@/data/servicesData';
import { contactUrl, portfolioUrl } from '@/lib/siteUrls';
import { openChat } from '@/lib/chatBus';
import { useTilt } from '@/lib/useGsapEffects';

/** Which contact form best fits each service (so DEPLOY_REQUEST opens the right one). */
const CONTACT_KIND: Record<string, 'design' | 'repair'> = { '01': 'repair', '02': 'design', '03': 'design', '04': 'design' };

/** Services that have matching work in the portfolio archive (04 has no matching category). */
const RELATED_CATEGORY: Record<string, string> = { '01': 'HARDWARE', '02': 'BRANDING', '03': 'UI/UX' };

/** FAQ built from the service data above, so answers can't drift from the cards. */
const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How long will it take?',
    a: (
      <ul className="mt-2 space-y-1 font-mono text-xs">
        {SERVICES.map((s) => (
          <li key={s.id}>
            <span className="text-zinc-300">{s.title}:</span> <span className="text-accent">{s.timeline}</span>
          </li>
        ))}
      </ul>
    ),
  },
  { q: 'How do I request a service?', a: 'Use DEPLOY_REQUEST on any service above. It opens the right form (repair or design) so you only fill in what is relevant.' },
  { q: 'How much does it cost?', a: 'It depends on the job. Describe what you need in a request, or ask the assistant, and you will get a scope and estimate before work begins.' },
  { q: 'I am not sure which service I need.', a: 'No problem. Describe the problem or goal in the chat assistant or the contact form and it will point you to the right one.' },
];

export default function ServicesPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  useTilt(pageRef);

  return (
    <div ref={pageRef} className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-16">
      {/* Header */}
      <div className="mb-10 border-b border-zinc-800/80 pb-8 sm:mb-12">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent sm:text-xs">[SECTION // CAPABILITIES &amp; PROTOCOLS]</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl md:text-5xl">Technical &amp; Creative Services</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
          Precision engineering for physical hardware, digital brand architecture, and user interface design. Built for high performance and reliability.
        </p>
        <button
          type="button"
          onClick={() => openChat({ prefill: 'How much does ' })}
          className="mt-5 inline-flex min-h-10 items-center rounded border border-zinc-800 px-4 font-mono text-xs text-zinc-300 transition-colors hover:border-accent/40 hover:text-accent"
        >
          NOT SURE WHICH ONE? ASK_AI →
        </button>

        {/* Jump links: handy on a phone where the four cards stack into a long scroll */}
        <nav
          aria-label="Jump to a service"
          className="mt-6 flex gap-2 font-mono text-xs max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 sm:flex-wrap"
        >
          {SERVICES.map((service) => (
            <a
              key={service.id}
              href={`#service-${service.id}`}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-3.5 text-zinc-400 transition-colors hover:border-accent/40 hover:text-accent"
            >
              <span className="text-zinc-600">{service.id}</span>
              {service.tag}
            </a>
          ))}
        </nav>
      </div>

      {/* Services grid */}
      <div className="grid grid-cols-1 gap-5 sm:gap-8 md:grid-cols-2">
        {SERVICES.map((service) => (
          <div
            key={service.id}
            id={`service-${service.id}`}
            data-reveal
            data-tilt
            className="group flex scroll-mt-24 flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 transition-colors duration-300 hover:border-accent/40 sm:p-8"
          >
            <div>
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 font-mono text-xs text-accent">{service.tag}</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  {service.status}
                </span>
              </div>

              <h2 className="mb-3 text-xl font-bold text-zinc-100 transition-colors group-hover:text-accent sm:text-2xl">{service.title}</h2>
              <p className="mb-6 text-sm leading-relaxed text-zinc-400">{service.description}</p>

              <div className="mb-6">
                <div className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-500">Included Deliverables:</div>
                <ul className="space-y-2">
                  {service.deliverables.map((item) => (
                    <li key={item} className="flex items-start gap-2 font-mono text-xs text-zinc-300">
                      <span className="text-accent" aria-hidden="true">›</span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-6 flex flex-wrap gap-x-5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => openChat({ prefill: `Tell me about ${service.title}` })}
                  className="py-2 text-zinc-400 transition-colors hover:text-accent"
                >
                  ASK ABOUT THIS
                </button>
                {RELATED_CATEGORY[service.id] && (
                  <Link href={portfolioUrl({ category: RELATED_CATEGORY[service.id] })} className="py-2 text-zinc-400 transition-colors hover:text-accent">
                    SEE RELATED WORK →
                  </Link>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-800/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-mono text-xs text-zinc-400">
                EST_TIMELINE: <span className="text-zinc-200">{service.timeline}</span>
              </div>
              <Link
                href={contactUrl(CONTACT_KIND[service.id])}
                className="touch-target inline-flex items-center justify-center rounded bg-accent-strong px-4 py-2 font-mono text-xs font-semibold text-black transition-colors hover:bg-accent"
              >
                DEPLOY_REQUEST →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Pricing: no invented numbers. Add real "from UGX ..." lines here once you've decided them. */}
      <p data-reveal className="mt-10 text-center font-mono text-xs text-zinc-400">
        PRICING // Cost depends on the device, the fault and the parts needed. Send the model and a short
        description (or a photo on WhatsApp) and we&apos;ll quote before any work starts.
      </p>

      {/* Real hardware restoration showcase (component lives in your repo; import left as it was) */}
      <RepairShowcase />

      {/* How it works */}
      <section data-reveal className="mt-12 sm:mt-16" aria-labelledby="process-heading">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent sm:text-xs">[SECTION // WORKFLOW]</div>
        <h2 id="process-heading" className="mb-6 text-2xl font-bold text-zinc-100 sm:text-3xl">How it works</h2>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.map((step) => (
            <li key={step.id} className="relative rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <span className="font-mono text-xs text-accent">STEP_{step.id}</span>
              <h3 className="mt-1 text-lg font-bold text-zinc-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ: native <details>, so it needs no JavaScript and works with the keyboard out of the box */}
      <section data-reveal className="mt-12 sm:mt-16" aria-labelledby="faq-heading">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent sm:text-xs">[SECTION // QUERY_LOG]</div>
        <h2 id="faq-heading" className="mb-6 text-2xl font-bold text-zinc-100 sm:text-3xl">Common questions</h2>
        <div className="divide-y divide-zinc-800/80 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40">
          {FAQS.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="font-mono text-lg text-accent transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <div className="px-5 pb-5 text-sm leading-relaxed text-zinc-400">{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* Bottom call to action */}
      <div
        data-reveal
        className="relative mt-12 overflow-hidden rounded-2xl border border-accent/40 bg-zinc-900/40 p-6 text-center sm:mt-16 sm:p-8 md:p-12"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(var(--accent-rgb)/0.12),transparent_50%)]" />
        <h2 className="relative z-10 mb-4 text-xl font-bold text-zinc-100 sm:text-2xl md:text-3xl">Have a Custom Project or Emergency Repair?</h2>
        <p className="relative z-10 mx-auto mb-8 max-w-xl text-sm text-zinc-400 md:text-base">
          Whether your rig needs a hardware overhaul or your brand needs a fresh visual identity, let&apos;s establish a secure connection and discuss the requirements.
        </p>
        <Link
          href="/contact"
          className="touch-target relative z-10 inline-flex items-center justify-center rounded bg-accent-strong px-6 py-3 font-mono text-sm font-semibold text-black transition-colors hover:bg-accent sm:px-8"
        >
          INITIALIZE_SECURE_COMMUNICATION
        </Link>
      </div>
    </div>
  );
}
