// src/components/fx/BackgroundFX.tsx
//
// Ambient effects shared by every page: a soft accent glow that trails the mouse, and a thin
// scroll-progress line under the nav. Both are decorative (aria-hidden, pointer-events none), skipped on
// touch devices and under prefers-reduced-motion, and they cost nothing until GSAP has loaded.
'use client';

import { useEffect, useRef } from 'react';
import { isCoarsePointer, loadGsap, prefersReducedMotion } from '@/lib/motion';

export default function BackgroundFX() {
  const glow = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let off: Array<() => void> = [];
    let cancelled = false;

    loadGsap().then((g) => {
      if (cancelled || !g) return;
      const { gsap } = g;
      const glowEl = glow.current;
      const barEl = bar.current;

      if (barEl) {
        const update = () => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          gsap.set(barEl, { scaleX: max > 0 ? Math.min(1, window.scrollY / max) : 0 });
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        off.push(() => {
          window.removeEventListener('scroll', update);
          window.removeEventListener('resize', update);
        });
        gsap.set(barEl, { opacity: 1 });
      }

      if (glowEl && !isCoarsePointer()) {
        const x = gsap.quickTo(glowEl, 'x', { duration: 0.6, ease: 'power3.out' });
        const y = gsap.quickTo(glowEl, 'y', { duration: 0.6, ease: 'power3.out' });
        const onMove = (e: PointerEvent) => {
          x(e.clientX - 200);
          y(e.clientY - 200);
          if (glowEl.dataset.on !== '1') {
            glowEl.dataset.on = '1';
            gsap.to(glowEl, { opacity: 1, duration: 0.8 });
          }
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        off.push(() => window.removeEventListener('pointermove', onMove));
      }
    });

    return () => {
      cancelled = true;
      off.forEach((fn) => fn());
      off = [];
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none">
      <div
        ref={bar}
        className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-accent opacity-0"
        style={{ top: 'env(safe-area-inset-top)', transform: 'scaleX(0)' }}
      />
      <div
        ref={glow}
        className="fixed left-0 top-0 z-0 h-[400px] w-[400px] rounded-full opacity-0 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(var(--accent-rgb) / 0.10), transparent 65%)' }}
      />
    </div>
  );
}
