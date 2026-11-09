// src/lib/useGsapEffects.ts
//
// Reusable GSAP behaviours. All of them:
//   - load GSAP lazily (never blocks first paint),
//   - do nothing under prefers-reduced-motion or if GSAP fails to load (content simply stays visible),
//   - clean up completely on unmount / route change.
'use client';

import { RefObject, useEffect } from 'react';
import { isCoarsePointer, scrambleTo, withGsap } from './motion';

/**
 * Fade/slide elements marked `data-reveal` into view as they scroll on screen.
 * Elements already on screen when the page loads are left alone (no hide-then-show flash).
 */
export function useReveal(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    return withGsap(scope.current, ({ gsap, ScrollTrigger }) => {
      if (!ScrollTrigger) return;
      const all = gsap.utils.toArray('[data-reveal]') as HTMLElement[];
      const below = all.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9);
      if (below.length === 0) return;

      gsap.set(below, { opacity: 0, y: 28 });
      ScrollTrigger.batch(below, {
        start: 'top 92%',
        once: true,
        onEnter: (batch: HTMLElement[]) =>
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out', overwrite: true }),
      });
      // Images/fonts change page height after load; keep trigger positions honest.
      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener('load', refresh, { once: true });
      return () => window.removeEventListener('load', refresh);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Subtle 3D tilt on elements marked `data-tilt` (mouse/trackpad only — skipped on touch). */
export function useTilt(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    if (isCoarsePointer()) return;
    return withGsap(scope.current, ({ gsap }) => {
      const cleanups: Array<() => void> = [];
      (gsap.utils.toArray('[data-tilt]') as HTMLElement[]).forEach((el) => {
        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(el, { rotationY: x * 7, rotationX: -y * 7, transformPerspective: 900, duration: 0.4, ease: 'power2.out' });
        };
        const onLeave = () => gsap.to(el, { rotationX: 0, rotationY: 0, duration: 0.6, ease: 'power3.out' });
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        cleanups.push(() => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerleave', onLeave);
        });
      });
      return () => cleanups.forEach((fn) => fn());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Scramble-in for text marked `data-scramble` (runs once, shortly after the page appears).
 * The real text is in the HTML from the start (SEO, no-JS, screen readers); the effect only plays
 * over it and always puts the original text back on cleanup.
 */
export function useScramble(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const els = Array.from(scope.current?.querySelectorAll<HTMLElement>('[data-scramble]') || []);
    const originals = els.map((el) => el.textContent || '');
    const stop = withGsap(scope.current, (g) => {
      els.forEach((el, i) => scrambleTo(g, el, originals[i], { duration: 1.1, delay: 0.25 + i * 0.12 }));
    });
    return () => {
      stop();
      els.forEach((el, i) => {
        el.textContent = originals[i];
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Elements marked `data-magnetic` lean slightly toward the pointer (mouse/trackpad only). */
export function useMagnetic(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    if (isCoarsePointer()) return;
    return withGsap(scope.current, ({ gsap }) => {
      const cleanups: Array<() => void> = [];
      (gsap.utils.toArray('[data-magnetic]') as HTMLElement[]).forEach((el) => {
        const toX = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
        const toY = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          toX((e.clientX - (r.left + r.width / 2)) * 0.18);
          toY((e.clientY - (r.top + r.height / 2)) * 0.28);
        };
        const onLeave = () => {
          toX(0);
          toY(0);
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        cleanups.push(() => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerleave', onLeave);
        });
      });
      return () => cleanups.forEach((fn) => fn());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
