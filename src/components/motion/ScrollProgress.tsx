// src/components/motion/ScrollProgress.tsx — thin reading-progress bar driven by ScrollTrigger.
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTheme } from '@/context/ThemeContext';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

const BAR = { cyan: 'bg-cyan-400', amber: 'bg-amber-400', emerald: 'bg-emerald-400' } as const;

export default function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { theme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.set(el, { scaleX: 0, opacity: 1 });
      gsap.to(el, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.25, invalidateOnRefresh: true } });
      const t = setTimeout(() => ScrollTrigger.refresh(), 600); // page content has mounted by now
      return () => clearTimeout(t);
    });
    return () => mm.revert();
  }, [pathname]);

  return <div ref={ref} aria-hidden="true" className={`fixed top-0 left-0 z-[60] h-0.5 w-full origin-left pointer-events-none opacity-0 ${BAR[theme]}`} />;
}
