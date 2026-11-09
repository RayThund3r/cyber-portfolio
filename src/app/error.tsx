// src/app/error.tsx
//
// Route-level error boundary: a crash on one page shows this instead of a blank screen, and the
// navigation + chat (which live in the layout) keep working.
'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { reportError } from '@/utils/analytics';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Route error:', error);
    reportError(error, 'route-error-boundary'); // anonymous, so you can see crashes in your dashboard
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20 text-center font-mono" role="alert">
      <span className="text-[10px] uppercase tracking-widest text-red-400 sm:text-xs">SYS_FAULT // PAGE_CRASHED</span>
      <h1 className="mt-3 text-2xl font-extrabold text-zinc-100 sm:text-4xl">Something went wrong on this page.</h1>
      <p className="mt-4 text-sm text-zinc-400">You can retry, or head somewhere else. If it keeps happening, please contact us.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs">
        <button
          type="button"
          onClick={reset}
          className="touch-target rounded bg-accent-strong px-5 font-semibold text-black transition-colors hover:bg-accent"
        >
          RETRY
        </button>
        <Link href="/" className="touch-target inline-flex items-center rounded border border-zinc-800 px-5 text-zinc-300 hover:border-accent/40 hover:text-accent">
          GO_HOME
        </Link>
        <Link href="/contact" className="touch-target inline-flex items-center rounded border border-zinc-800 px-5 text-zinc-300 hover:border-accent/40 hover:text-accent">
          CONTACT
        </Link>
      </div>
    </div>
  );
}
