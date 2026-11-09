// src/components/motion/PageMotion.tsx
//
// Site-wide motion driven by data attributes, so pages stay declarative:
//   data-hero / data-hero-title / data-hero-item   → intro on page load
//   data-reveal                                    → below-the-fold items fade/slide in when scrolled to (also items added later)
//   data-magnetic                                  → button gently follows the pointer (fine pointers only)
// Reveal and intro use the Web Animations API (lib/reveal.ts), which cannot cause React hydration mismatches.
// Everything is skipped when the visitor prefers reduced motion (content then simply shows).
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { createRevealer, playHeroIntro } from '@/lib/reveal';

export default function PageMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = (document.querySelector('main') as HTMLElement) || document.body;
    const html = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Failsafe: the hero is hidden by CSS only until its intro plays; never leave it hidden.
    const failsafe = setTimeout(() => html.classList.remove('motion-ready'), 3000);
    if (reduce.matches) { html.classList.remove('motion-ready'); return () => clearTimeout(failsafe); }

    const rev = createRevealer();
    const collect = (node: ParentNode | Element) => {
      const out: Element[] = [];
      if (node instanceof Element && node.hasAttribute('data-reveal')) out.push(node);
      node.querySelectorAll?.('[data-reveal]').forEach((n) => out.push(n));
      return out;
    };

    playHeroIntro(root);
    const raf = requestAnimationFrame(() => rev.reveal(collect(root)));

    // content added later (filters, fetched lists) is revealed the same way
    const mo = new MutationObserver((records) => {
      const added: Element[] = [];
      records.forEach((r) => r.addedNodes.forEach((n) => n.nodeType === 1 && added.push(...collect(n as Element))));
      if (added.length) rev.reveal(added);
    });
    mo.observe(root, { childList: true, subtree: true });

    // ── magnetic buttons (pointer-driven, so only ever runs after the page is interactive) ──
    const fine = window.matchMedia('(pointer: fine)').matches;
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest('[data-magnetic]') as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * 0.18, y: (e.clientY - (r.top + r.height / 2)) * 0.28, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    };
    const onLeave = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest('[data-magnetic]') as HTMLElement | null;
      if (el) gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
    };
    if (fine) {
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerout', onLeave);
    }

    return () => {
      clearTimeout(failsafe);
      cancelAnimationFrame(raf);
      mo.disconnect();
      rev.destroy();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onLeave);
    };
  }, [pathname]);

  return null;
}
