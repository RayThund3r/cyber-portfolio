// src/components/site/BackToTop.tsx — small, semi-transparent "back to top" button for phones (hidden from md up).
'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';

export default function BackToTop() {
  const [show, setShow] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    const update = () => {
      raf.current = 0;
      setShow(window.scrollY > Math.max(480, window.innerHeight * 0.8));
    };
    const onScroll = () => { if (!raf.current) raf.current = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const go = () => {
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={go}
      aria-label="Back to top"
      tabIndex={show ? 0 : -1}
      className={`fixed left-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-zinc-900/50 text-accent shadow-lg backdrop-blur-sm transition-[opacity,transform] duration-300 active:scale-90 md:hidden ${show ? 'translate-y-0 opacity-60 hover:opacity-100 focus-visible:opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <Icon name="arrowUp" size={18} />
    </button>
  );
}
