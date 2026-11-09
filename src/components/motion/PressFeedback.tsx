// src/components/motion/PressFeedback.tsx
//
// iOS-style touch feedback for every button, link and tab on the site, without touching any component:
//   - pressing shrinks the control slightly (smaller controls shrink more, big cards barely move)
//   - letting go springs back with a small overshoot, like a native iOS control
//   - elements marked data-haptic give a tiny vibration on devices that support it (Android)
//
// It animates the CSS `scale` property with the Web Animations API, so it never fights existing
// Tailwind transitions, hover scales or GSAP transforms. Skipped for visitors who prefer reduced motion.
// Opt out with data-no-press on an element (or any parent).
'use client';

import { useEffect } from 'react';

const TARGET = 'button, a[href], [role="button"], [role="tab"], summary, [data-press]';
const SPRING_DOWN = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SPRING_UP = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // overshoots slightly, then settles

export default function PressFeedback() {
  useEffect(() => {
    if (typeof Element === 'undefined' || !('animate' in Element.prototype)) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;

    let active: { el: HTMLElement; anim: Animation; base: number } | null = null;

    const currentScale = (el: HTMLElement) => {
      const n = parseFloat(getComputedStyle(el).scale);
      return Number.isFinite(n) ? n : 1;
    };
    const pressScale = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      return area < 24000 ? 0.94 : area < 100000 ? 0.972 : 0.988;
    };

    const release = (instant = false) => {
      if (!active) return;
      const { el, anim, base } = active;
      active = null;
      const now = currentScale(el);
      anim.cancel();
      if (instant || Math.abs(now - base) < 0.001) return;
      el.animate([{ scale: now }, { scale: base }], { duration: 420, easing: SPRING_UP });
    };

    const onDown = (e: PointerEvent) => {
      if (reduce.matches || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const el = (e.target as Element | null)?.closest?.(TARGET) as HTMLElement | null;
      if (!el || el.matches(':disabled, [aria-disabled="true"]') || el.closest('[data-no-press]')) return;
      release(true);
      const base = currentScale(el);
      const anim = el.animate([{ scale: base }, { scale: base * pressScale(el) }], { duration: 150, easing: SPRING_DOWN, fill: 'forwards' });
      active = { el, anim, base };
      if (el.hasAttribute('data-haptic')) {
        try {
          navigator.vibrate?.(6);
        } catch {
          /* not supported */
        }
      }
    };
    const onUp = () => release();

    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    document.addEventListener('dragstart', onUp, true);
    window.addEventListener('blur', onUp);
    return () => {
      release(true);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
      document.removeEventListener('dragstart', onUp, true);
      window.removeEventListener('blur', onUp);
    };
  }, []);

  return null;
}
