// src/app/remote/page.tsx — remote support: what can be fixed without a visit, how a session works, and how to stay safe.
// The intro and the packages come from Admin → Content → Packages.
'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { PackagesSection } from '@/components/site/Packages';
import { useSiteContent } from '@/context/SiteContentContext';
import { useStaggerIn } from '@/lib/useGsapEffects';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';

const FIXES: Array<[string, string]> = [
  ['Slow computer', 'Startup clean-up, junk removal and settings that make it fast again.'],
  ['Viruses and pop-ups', 'Scan, remove and lock down so it does not come back.'],
  ['Software and Windows problems', 'Errors, crashes, updates that fail, programs that will not install.'],
  ['Setup help', 'Email, printers, Wi-Fi, a new laptop or phone, moving your files.'],
  ['Accounts and security', 'Recover access, set up two-step sign-in, tidy up your passwords.'],
  ['Learn as we fix', 'We explain each step so you can do it yourself next time.'],
];
const STEPS: Array<[string, string]> = [
  ['Tell us the problem', 'Send the request form or a WhatsApp message with a short description.'],
  ['Agree the price', 'We confirm the price and a time before anything starts.'],
  ['Connect for the session', 'You install a free remote tool and give us a one-time code. You watch everything on your screen.'],
  ['Fixed, then disconnected', 'We end the session, you test it, and you pay by mobile money.'],
];

export default function RemotePage() {
  const { remote } = useSiteContent();
  const ref = useRef<HTMLDivElement>(null);
  useStaggerIn(ref);
  const wa = hasWhatsApp() ? whatsappLink('Hello, I need remote help with my computer. ') : '';
  const cta = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold transition active:scale-[0.98]';

  if (!remote.enabled) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-8">
        <h1 className="text-2xl font-bold text-zinc-100">Remote support is not available right now</h1>
        <p className="mt-3 text-sm text-zinc-400">You can still send a repair request and we will tell you the best way to help.</p>
        <Link href="/contact?type=repair" className={`${cta} mt-6 bg-accent-strong text-black hover:bg-accent`}>Request a repair</Link>
      </div>
    );
  }
  return (
    <div ref={ref} className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-16">
      <div className="mb-10 border-b border-zinc-800/80 pb-8 sm:mb-12">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent sm:text-xs">[SECTION // REMOTE_SUPPORT]</div>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl md:text-5xl">Fix your computer without leaving home</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
          {remote.intro || 'Many problems can be fixed over the internet while you watch. No travel, no waiting in a queue, and you only pay once it works.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/contact?type=repair&pkg=Remote%20support" className={`${cta} bg-accent-strong text-black hover:bg-accent`}><Icon name="wifi" size={16} />Book remote help</Link>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${cta} border border-zinc-700 text-zinc-100 hover:border-zinc-400`}><Icon name="chat" size={16} />WhatsApp us</a>}
        </div>
      </div>

      <section aria-labelledby="fix-heading">
        <h2 id="fix-heading" className="mb-5 text-2xl font-bold text-zinc-100 sm:text-3xl">What we can fix remotely</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIXES.map(([t, d]) => (
            <li key={t} data-stagger className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-accent"><Icon name="check" size={16} /></span>
              <h3 className="mt-3 text-base font-semibold text-zinc-100">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{d}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-zinc-500">Broken screens, dead batteries and hardware faults need a visit. <Link href="/contact?type=repair" className="text-accent hover:underline">Book a repair</Link> for those.</p>
      </section>

      <PackagesSection kinds={['remote']} title="Remote support packages" intro="Fixed prices for the most common remote jobs." />

      <section className="mt-12 sm:mt-16" aria-labelledby="how-heading">
        <h2 id="how-heading" className="mb-5 text-2xl font-bold text-zinc-100 sm:text-3xl">How a session works</h2>
        <ol className="grid gap-4 md:grid-cols-2">
          {STEPS.map(([t, d], i) => (
            <li key={t} data-stagger className="flex gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-accent/40 font-mono text-sm text-accent">{i + 1}</span>
              <span><span className="block text-base font-semibold text-zinc-100">{t}</span><span className="mt-1 block text-sm leading-relaxed text-zinc-400">{d}</span></span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 rounded-2xl border border-accent/30 bg-accent/[0.05] p-5 sm:mt-16 sm:p-6" aria-labelledby="safe-heading">
        <h2 id="safe-heading" className="flex items-center gap-2 text-lg font-bold text-zinc-100"><Icon name="shield" size={18} className="text-accent" />Staying safe</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
          <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 flex-none text-accent" />You can see everything we do, and you can end the session at any time.</li>
          <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 flex-none text-accent" />We never ask for your bank or mobile money PIN. Do not share it with anyone.</li>
          <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 flex-none text-accent" />Only accept a connection from us after you have agreed a time on this website or on our WhatsApp.</li>
          <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 flex-none text-accent" />Remote access is removed when we finish.</li>
        </ul>
      </section>
    </div>
  );
}
