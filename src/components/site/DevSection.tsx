// src/components/site/DevSection.tsx — "About the developer". Content lives in src/data/devProfile.ts.
import Icon, { type IconName } from '@/components/ui/Icon';
import { DEV } from '@/data/devProfile';
import { openChatLink } from './openChatLink';

export default function DevSection() {
  const initials = DEV.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'DV';
  return (
    <section id="dev" className="mx-auto max-w-7xl scroll-mt-20 border-t border-zinc-900 px-4 py-12 sm:px-8">
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5" data-reveal>
          <span className="font-mono text-[10px] uppercase tracking-wider text-accent sm:text-xs">OPERATOR_PROFILE // WHO BUILT THIS</span>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-accent/40 bg-zinc-900 font-mono text-2xl font-bold text-accent shadow-[0_0_30px_-8px_var(--color-accent,#22d3ee)]" aria-hidden="true">
              {initials}
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-zinc-950 bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">{DEV.name}</h2>
              <p className="mt-0.5 text-xs text-zinc-400">{DEV.role}</p>
            </div>
          </div>
          {DEV.blurb && <p className="mt-5 text-sm leading-relaxed text-zinc-400">{DEV.blurb}</p>}
          <div className="mt-5 flex flex-wrap gap-2 font-mono text-xs">
            <a href="/contact" className="touch-target inline-flex items-center gap-1.5 rounded bg-accent-strong px-4 py-2.5 font-semibold text-black transition-transform hover:scale-105 active:scale-95"><Icon name="mail" size={14} />WORK_WITH_ME</a>
            <button type="button" onClick={openChatLink} className="touch-target inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-300 transition-colors hover:border-accent/50 hover:text-accent"><Icon name="chat" size={14} />ASK_ABOUT_ME</button>
            {DEV.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="touch-target inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-300 transition-colors hover:border-accent/50 hover:text-accent">{l.label}<Icon name="external" size={12} /></a>
            ))}
          </div>
        </div>
        <div className="space-y-4 lg:col-span-7" data-reveal>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DEV.facts.map((f) => (
              <div key={f.title} className="cy-card rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
                <Icon name={f.icon as IconName} size={20} className="text-accent" />
                <h3 className="mt-3 text-sm font-bold text-zinc-100">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[11px]">
            {DEV.skills.map((s) => <span key={s} className="rounded border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-zinc-400">{s}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
