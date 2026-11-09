// src/app/not-found.tsx
'use client';

import Link from 'next/link';
import { ROUTES } from '@/lib/siteMap';
import { openChat } from '@/lib/chatBus';

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20 text-center font-mono">
      <span className="rise text-[10px] uppercase tracking-widest text-accent sm:text-xs">ERR_404 // MODULE_NOT_FOUND</span>
      <h1 className="rise mt-3 text-3xl font-extrabold text-zinc-100 sm:text-5xl" style={{ '--d': '80ms' } as React.CSSProperties}>
        That page isn&apos;t in the system.
      </h1>
      <p className="rise mt-4 text-sm text-zinc-400" style={{ '--d': '160ms' } as React.CSSProperties}>
        The link may be old or mistyped. Pick a destination, or ask the assistant to take you there.
      </p>
      <div className="rise mt-8 flex flex-wrap justify-center gap-3 text-xs" style={{ '--d': '240ms' } as React.CSSProperties}>
        {ROUTES.map((r) => (
          <Link
            key={r.path}
            href={r.path}
            className="touch-target inline-flex items-center rounded border border-zinc-800 bg-zinc-900/60 px-4 text-zinc-300 transition-colors hover:border-accent/40 hover:text-accent"
          >
            {r.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => openChat({ prefill: 'Take me to ' })}
          className="touch-target inline-flex items-center rounded border border-accent/40 bg-accent/10 px-4 font-semibold text-accent"
        >
          ASK_AI
        </button>
      </div>
    </div>
  );
}
