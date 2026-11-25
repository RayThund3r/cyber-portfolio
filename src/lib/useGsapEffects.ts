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

/**
 * Children of anything marked `data-stagger` slide up one after another as it scrolls into view (once).
 * Items already on screen at load are left alone (no hide-then-show flash). Inline styles are cleared afterwards so hover effects keep working.
 */
export function useStaggerIn(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    return withGsap(scope.current, ({ gsap, ScrollTrigger }) => {
      const root = scope.current; if (!root || !ScrollTrigger) return;
      const boxes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('[data-stagger]'))].filter((el) => el.hasAttribute('data-stagger'));
      boxes.forEach((box) => {
        const kids = Array.from(box.children) as HTMLElement[];
        if (!kids.length || box.getBoundingClientRect().top < window.innerHeight * 0.85) return;
        gsap.set(kids, { opacity: 0, y: 26 });
        ScrollTrigger.create({
          trigger: box, start: 'top 88%', once: true,
          onEnter: () => gsap.to(kids, { opacity: 1, y: 0, duration: 0.7, stagger: 0.09, ease: 'power3.out', clearProps: 'opacity,transform' }),
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Numbers in `data-count` (like "250+", "4.9", "1,200 jobs") count up from zero when they scroll into view. */
export function useCountUp(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const els = Array.from(scope.current?.querySelectorAll<HTMLElement>('[data-count]') || []);
    const originals = els.map((el) => el.textContent || '');
    const stop = withGsap(scope.current, ({ gsap, ScrollTrigger }) => {
      els.forEach((el, i) => {
        const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(originals[i].trim());
        if (!m) return;
        const target = parseFloat(m[2].replace(/,/g, '')); if (!Number.isFinite(target)) return;
        const dec = (m[2].split('.')[1] || '').length, grouped = m[2].includes(',');
        const fmt = (v: number) => `${m[1]}${grouped ? Math.round(v).toLocaleString('en-US') : v.toFixed(dec)}${m[3]}`;
        const state = { v: 0 };
        const play = () => gsap.to(state, { v: target, duration: 1.4, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(state.v); }, onComplete: () => { el.textContent = originals[i]; } });
        el.textContent = fmt(0);
        if (ScrollTrigger) ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: play }); else play();
      });
    });
    return () => { stop(); els.forEach((el, i) => { el.textContent = originals[i]; }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Elements marked `data-parallax="0.15"` drift slower than the page while their section scrolls past (mouse/trackpad devices only). */
export function useParallax(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    if (isCoarsePointer()) return;
    return withGsap(scope.current, ({ gsap, ScrollTrigger }) => {
      if (!ScrollTrigger) return;
      (gsap.utils.toArray('[data-parallax]') as HTMLElement[]).forEach((el) => {
        const speed = Number(el.getAttribute('data-parallax')) || 0.15;
        gsap.fromTo(el, { y: 0 }, { y: () => speed * 260, ease: 'none', scrollTrigger: { trigger: el.parentElement || el, start: 'top top', end: 'bottom top', scrub: 0.6 } });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
