// src/components/RepairShowcase.tsx
//
// "Hardware Restoration Lab" section for /services. Data lives in data/repairShowcaseData.ts.
// Self-contained: only depends on the chat bus and the optional WhatsApp helpers, so it cannot
// break the page if those are left empty.
'use client';

import Link from 'next/link';
import { openChat } from '@/lib/chatBus';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';
import { BRING_LIST, REPAIR_FACTS, REPAIR_NOTES, REPAIR_STEPS, REPAIR_TYPES } from '@/data/repairShowcaseData';
import Icon from '@/components/ui/Icon';

export default function RepairShowcase() {
  const wa = hasWhatsApp() ? whatsappLink('Hi, I need a repair. ') : '';

  return (
    <section aria-labelledby="repair-lab-title" data-reveal className="mt-14 sm:mt-20">
      <div className="mb-8 border-b border-zinc-800/80 pb-6">
        <div className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">[LAB // HARDWARE_RESTORATION]</div>
        <h2 id="repair-lab-title" className="text-2xl font-extrabold tracking-tight text-zinc-100 sm:text-3xl md:text-4xl">
          Repairs, done properly
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400 md:text-base">
          Diagnosis first, an honest plan second, repair third. Here is what gets fixed and how the process runs.
        </p>
      </div>

      {/* Quick facts */}
      <dl className="mb-8 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {REPAIR_FACTS.map((f) => (
          <div key={f.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-3">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{f.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-100">{f.value}</dd>
          </div>
        ))}
      </dl>

      {/* What gets fixed */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPAIR_TYPES.map((r) => (
          <button
            key={r.title}
            type="button"
            onClick={() => openChat({ send: r.ask })}
            className="group cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-zinc-900/70 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Icon name={r.icon} size={18} />
            </span>
            <h3 className="mt-3 text-sm font-bold text-zinc-100">{r.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{r.covers}</p>
            <span className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] text-accent">
              Ask the assistant <Icon name="arrow" size={12} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>

      {/* Process */}
      <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REPAIR_STEPS.map((s) => (
          <li key={s.n} className="relative rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <span className="font-mono text-xs text-accent">{s.n}</span>
            <h3 className="mt-1 text-sm font-bold text-zinc-100">{s.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{s.text}</p>
          </li>
        ))}
      </ol>

      {/* Bring list + CTA */}
      <div className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
            <Icon name="check" size={16} className="text-accent" /> What to bring
          </h3>
          <ul className="mt-3 space-y-2">
            {BRING_LIST.map((b) => (
              <li key={b} className="flex gap-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                <span className="mt-0.5 text-accent" aria-hidden="true">›</span>
                {b}
              </li>
            ))}
          </ul>
          <p className="mt-4 flex gap-2 border-t border-zinc-800 pt-3 text-[11px] leading-relaxed text-zinc-500">
            <Icon name="clock" size={14} className="mt-0.5" /> {REPAIR_NOTES}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-accent/30 bg-accent/[0.06] p-5">
          <div>
            <h3 className="text-base font-bold text-zinc-100">Not sure what is wrong?</h3>
            <p className="mt-1 text-sm text-zinc-400">Describe it in your own words. The assistant will narrow it down and tell you what to expect.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openChat({ send: 'My device has a problem' })}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent-strong px-4 py-2 font-mono text-xs font-bold text-zinc-950 transition hover:opacity-90"
            >
              <Icon name="chat" size={14} /> DIAGNOSE WITH AI
            </button>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-200 transition hover:border-accent/50 hover:text-accent"
            >
              BOOK A REPAIR
            </Link>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-200 transition hover:border-accent/50 hover:text-accent"
              >
                WHATSAPP
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
