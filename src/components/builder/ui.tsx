// src/components/builder/ui.tsx — tiny shared UI bits for the builder: skeletons, tooltips, key hints, keyboard-safe focus.
'use client';

import type { ReactNode } from 'react';

/** Shimmering placeholder (static when the visitor prefers reduced motion — see the builder layout CSS). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`bld-skel rounded ${className}`} />;
}

/** Skeleton shaped like a gallery card. */
export function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40" aria-hidden="true">
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <div className="flex items-center justify-between pt-2"><Skeleton className="h-6 w-20" /><Skeleton className="h-11 w-28 rounded-lg" /></div>
      </div>
    </div>
  );
}

/** Keyboard shortcut chip. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ml-1.5 px-1.5 py-0.5 rounded border border-zinc-600 bg-zinc-900 text-[10px] font-mono text-zinc-300">{children}</kbd>;
}

/** CSS-only tooltip for hover and keyboard focus. Hidden on touch layouts (where there is no hover). */
export function Tip({ label, keys, children, side = 'bottom' }: { label: string; keys?: string; children: ReactNode; side?: 'bottom' | 'right' }) {
  const pos = side === 'right' ? 'left-full ml-2 top-1/2 -translate-y-1/2' : 'top-full mt-1.5 left-1/2 -translate-x-1/2';
  return (
    <span className="relative inline-flex group/tip">
      {children}
      <span role="tooltip" className={`pointer-events-none absolute ${pos} z-[90] hidden lg:flex items-center whitespace-nowrap rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 shadow-xl opacity-0 transition-opacity duration-150 delay-300 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100`}>
        {label}{keys && <Kbd>{keys}</Kbd>}
      </span>
    </span>
  );
}

/** Keeps a focused input visible above the on-screen keyboard. */
export const kbFocus = (e: React.FocusEvent<HTMLElement>) => {
  const el = e.currentTarget;
  setTimeout(() => { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* ignore */ } }, 280);
};

/** ≥44px, 16px text (no iOS zoom-on-focus) form control look shared by the builder's dialogs. */
export const field = 'w-full min-h-11 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-base sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500/60 disabled:opacity-50';
/** Common button looks. */
export const btnPrimary = 'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-cyan-500 text-black text-sm font-mono font-semibold hover:bg-cyan-400 active:scale-[.98] transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap';
export const btnGhost = 'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-zinc-700 text-sm font-mono text-zinc-200 hover:border-zinc-400 active:scale-[.98] transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap';
export const btnGreen = 'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-emerald-500 text-black text-sm font-mono font-semibold hover:bg-emerald-400 active:scale-[.98] transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap';
