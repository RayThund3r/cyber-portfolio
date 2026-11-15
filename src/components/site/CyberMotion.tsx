// src/components/site/CyberMotion.tsx — the small, global bits of cyber motion. Mounted once in the layout.
//  1. Route sweep: a line of light races across the top of the screen when you move to another page.
//  2. Tap ping: a quick ring where you press a button or link.
//  3. Decode: "[SECTION // NAME]" labels decode themselves as they scroll into view (the real text is always in the page).
// All three do nothing for visitors who prefer reduced motion, and none of them touch layout.
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const GLYPHS = '01<>/_#$%&*+=?';
const LABEL = /^\[[A-Z0-9_ &/.\-:]{3,60}\]$/;

export default function CyberMotion() {
  const path = usePathname();
  const [sweep, setSweep] = useState(0);
  const [first, setFirst] = useState(true);

  // 1. route sweep (skipped on the very first load)
  useEffect(() => {
    if (first) { setFirst(false); return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setSweep((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // 2. tap ping
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let last = 0;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.('button, a[href], [role="button"], [role="tab"], summary')) return;
      if (t.closest('[data-no-press], canvas, [aria-disabled="true"], :disabled')) return;
      const now = performance.now(); if (now - last < 120) return; last = now;
      const d = document.createElement('span');
      d.className = 'cy-ping'; d.setAttribute('aria-hidden', 'true');
      d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
      document.body.appendChild(d);
      window.setTimeout(() => d.remove(), 560);
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  // 3. decode section labels as they appear
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const timers = new Set<number>();
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const el = en.target as HTMLElement;
        if (!en.isIntersecting || seen.has(el)) continue;
        seen.add(el); io.unobserve(el);
        const original = el.textContent || '';
        let frame = 0; const total = 16;
        const id = window.setInterval(() => {
          frame++;
          const keep = Math.floor((frame / total) * original.length);
          el.textContent = original.split('').map((c, i) => (i < keep || c === ' ' || '[]/&'.includes(c) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
          if (frame >= total) { el.textContent = original; window.clearInterval(id); timers.delete(id); }
        }, 38);
        timers.add(id);
      }
    }, { threshold: 0.6 });
    const t = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.font-mono').forEach((el) => {
        if (el.childElementCount === 0 && LABEL.test((el.textContent || '').trim()) && !el.closest('[data-scramble], input, textarea, button')) io.observe(el);
      });
    }, 450);
    return () => { window.clearTimeout(t); io.disconnect(); timers.forEach((id) => window.clearInterval(id)); };
  }, [path]);

  return sweep ? <div key={sweep} aria-hidden="true" className="cy-route" /> : null;
}
