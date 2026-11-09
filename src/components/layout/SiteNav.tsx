// src/components/layout/SiteNav.tsx
//
// The ONE navigation bar for every page (previously each page carried its own copy, and the
// mobile links were permanently hidden because the `xs:` breakpoint did not exist).
//   - desktop: inline links, theme dots, light/dark toggle, ASK_AI, contact button
//   - phones/tablets: hamburger that opens a full-width panel with big tap targets
//   - closes on route change, Escape, tapping outside, or resizing to desktop

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ROUTES, isActivePath } from '@/lib/siteMap';
import { openChat } from '@/lib/chatBus';
import { withGsap } from '@/lib/motion';
import { lockScroll } from '@/lib/scrollLock';
import ThemeDots from './ThemeDots';
import ModeToggle from './ModeToggle';

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  // Close whenever the page changes (link tap, chat navigation, back button).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes; leaving the mobile breakpoint closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    const mq = window.matchMedia('(min-width: 768px)');
    const onMq = () => mq.matches && setOpen(false);
    window.addEventListener('keydown', onKey);
    mq.addEventListener?.('change', onMq);

    const unlock = lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener?.('change', onMq);
      unlock();
    };
  }, [open, close]);

  // GSAP: stagger the menu items in. If GSAP is missing or the visitor prefers reduced motion,
  // withGsap does nothing and the items are simply shown.
  useEffect(() => {
    if (!open) return;
    return withGsap(panelRef.current, ({ gsap }) => {
      gsap.from('[data-nav-item]', { opacity: 0, x: -14, duration: 0.35, stagger: 0.06, ease: 'power3.out' });
    });
  }, [open]);

  // Thin scroll-progress line under the bar (cheap: one transform, passive listener, rAF-throttled).
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname]);

  const desktopLinks = ROUTES.filter((r) => r.path !== '/contact');

  return (
    // NOTE: backdrop-filter makes the header the containing block of `fixed` children, which would
    // collapse the tap-to-close backdrop to the header's height. So the blur is dropped (and the bar
    // made opaque) while the mobile menu is open.
    <header
      className={`sticky top-0 z-50 border-b border-zinc-800/80 safe-top ${
        open ? 'bg-zinc-950' : 'bg-zinc-950/85 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-2" aria-label="System Portfolio home">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          <span className="truncate font-mono text-xs font-bold tracking-widest text-accent transition-opacity group-hover:opacity-80 sm:text-sm">
            SYS_PORTFOLIO.v1
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 font-mono text-xs md:flex">
          {desktopLinks.map((r) => {
            const active = isActivePath(pathname, r.path);
            return (
              <Link
                key={r.path}
                href={r.path}
                aria-current={active ? 'page' : undefined}
                className={`rounded px-3 py-2 transition-colors duration-200 ${
                  active ? 'text-accent' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                [{r.label}]
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeDots className="hidden md:flex" />
          {/* From 640px up the toggle sits in the bar. Below that the bar is full (logo + CONTACT +
              hamburger), so on phones it lives in the menu instead. */}
          <ModeToggle className="hidden sm:inline-flex" />
          <button
            type="button"
            onClick={() => openChat()}
            className="hidden rounded border border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300 transition-colors hover:border-accent/40 hover:text-accent md:inline-flex"
            title="Ask the assistant (Ctrl/⌘ + K)"
          >
            ASK_AI
          </button>
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            aria-current={isActivePath(pathname, '/contact') ? 'page' : undefined}
            className="inline-flex touch-target items-center justify-center rounded border border-accent/30 bg-accent/10 px-3 font-mono text-xs font-semibold text-accent transition-all duration-300 hover:scale-105 active:scale-95 glow-accent sm:px-3.5"
          >
            <span className="xs:hidden">CONTACT</span>
            <span className="hidden xs:inline">INITIATE_CONTACT →</span>
          </Link>

          <button
            ref={toggleRef}
            type="button"
            className="touch-target inline-flex items-center justify-center rounded border border-zinc-800 text-zinc-300 transition-colors hover:border-accent/40 hover:text-accent md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            data-haptic
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>

      {/* scroll progress */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden" aria-hidden="true">
        <div ref={barRef} className="h-full origin-left bg-accent" style={{ transform: 'scaleX(0)' }} />
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => close()}
            className="fixed inset-x-0 bottom-0 top-[calc(3.5rem+env(safe-area-inset-top))] bg-black/60 backdrop-blur-sm md:hidden"
          />
          <div
            id="mobile-menu"
            ref={panelRef}
            className="absolute inset-x-0 top-full max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain border-b border-zinc-800 bg-zinc-950 px-4 pb-5 pt-2 shadow-2xl md:hidden"
          >
            <nav aria-label="Mobile">
              <ul className="font-mono text-sm">
                {ROUTES.map((r, i) => {
                  const active = isActivePath(pathname, r.path);
                  return (
                    <li key={r.path} data-nav-item>
                      <Link
                        href={r.path}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-12 items-center justify-between border-b border-zinc-900 py-3 ${
                          active ? 'text-accent' : 'text-zinc-200'
                        }`}
                      >
                        <span>
                          <span className="mr-3 text-zinc-600">0{i + 1}</span>
                          {r.label}
                        </span>
                        <span aria-hidden="true">{active ? '●' : '→'}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div data-nav-item className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ThemeDots className="flex" />
                <ModeToggle className="inline-flex sm:hidden" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openChat();
                }}
                className="touch-target rounded border border-accent/40 px-4 font-mono text-xs font-semibold text-accent"
              >
                ASK_AI
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
