// src/components/fx/ScrollScene.tsx
//
// A quiet, scroll-driven background behind every public page: two soft accent orbs that drift in slow loops, and thin "data stream"
// lines at the edges whose dashes flow with the page (down when you scroll down, back up when you scroll up).
// It brightens while you are scrolling fast and settles back when you stop. Only transform/opacity change, one rAF loop that
// sleeps when the page is still, no GSAP needed, nothing at all under prefers-reduced-motion. Decorative: aria-hidden, no pointer events.
'use client';

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

const STREAM = 160; // px between dashes; the layer is moved by (offset % STREAM) so it loops seamlessly

export default function ScrollScene() {
  const root = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => { setOn(!prefersReducedMotion()); }, []);

  useEffect(() => {
    const el = root.current;
    if (!on || !el) return;
    const a = el.querySelector<HTMLElement>('[data-o="a"]'), b = el.querySelector<HTMLElement>('[data-o="b"]'), s = el.querySelector<HTMLElement>('[data-streams]');
    if (!a || !b || !s) return;
    let last = window.scrollY, y = last, vel = 0, raf = 0;

    const tick = () => {
      raf = 0;
      const sy = window.scrollY;
      vel = vel * 0.88 + (sy - last) * 0.12; last = sy;
      y += (sy - y) * 0.14;                                   // eased follow, so the scene trails the page slightly
      const boost = Math.min(Math.abs(vel) / 28, 1);
      a.style.transform = `translate3d(${Math.cos(y / 1100) * 16}vw, ${Math.sin(y / 800) * 18}vh, 0)`;
      b.style.transform = `translate3d(${Math.sin(y / 1500) * -18}vw, ${Math.cos(y / 950) * 16}vh, 0)`;
      s.style.transform = `translate3d(0, ${-(((y * 0.4) % STREAM) + STREAM) % STREAM}px, 0)`;
      el.style.setProperty('--boost', boost.toFixed(3));
      if (Math.abs(sy - y) > 0.4 || boost > 0.01) raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', kick, { passive: true });
    kick();
    return () => { window.removeEventListener('scroll', kick); if (raf) cancelAnimationFrame(raf); };
  }, [on]);

  if (!on) return null;
  const dash = 'repeating-linear-gradient(to bottom, rgb(var(--accent-rgb) / 0.55) 0 22px, transparent 22px 160px)';
  return (
    <div ref={root} aria-hidden="true" className="scroll-scene pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ ['--boost' as string]: 0 }}>
      <div data-o="a" className="absolute -left-[10vw] top-[8vh] h-[55vmax] w-[55vmax] rounded-full will-change-transform" style={{ background: 'radial-gradient(circle, rgb(var(--accent-rgb) / calc(0.07 + var(--boost) * 0.07)), transparent 62%)' }} />
      <div data-o="b" className="absolute -right-[15vw] bottom-[-10vh] h-[45vmax] w-[45vmax] rounded-full will-change-transform" style={{ background: 'radial-gradient(circle, rgb(var(--accent-rgb) / calc(0.05 + var(--boost) * 0.06)), transparent 62%)' }} />
      <div data-streams className="absolute inset-x-0 will-change-transform" style={{ top: -STREAM, height: `calc(100% + ${STREAM * 2}px)`, opacity: 'calc(0.10 + var(--boost) * 0.30)' }}>
        <span className="absolute left-[3%] top-0 h-full w-px" style={{ background: dash }} />
        <span className="absolute right-[3%] top-0 h-full w-px" style={{ background: dash, backgroundPosition: '0 80px' }} />
        <span className="absolute left-[9%] top-0 hidden h-full w-px lg:block" style={{ background: dash, backgroundPosition: '0 40px', opacity: 0.6 }} />
        <span className="absolute right-[9%] top-0 hidden h-full w-px lg:block" style={{ background: dash, backgroundPosition: '0 120px', opacity: 0.6 }} />
      </div>
    </div>
  );
}
