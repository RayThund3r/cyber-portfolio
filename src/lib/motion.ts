// src/lib/motion.ts
//
// GSAP loader + helpers.
//   - GSAP is imported dynamically, only in the browser, only when something animates. It never
//     blocks first paint, and if the import fails the site simply stays un-animated.
//   - Everything respects `prefers-reduced-motion`.
//   - Types are deliberately loose (`any`) so a different GSAP version can't break `next build`.

export interface GsapBundle {
  gsap: any;
  ScrollTrigger: any;
}

let bundlePromise: Promise<GsapBundle | null> | null = null;

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** True on phones/tablets (no hover) — skip pointer-driven effects there. */
export function isCoarsePointer(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function loadGsap(): Promise<GsapBundle | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!bundlePromise) {
    bundlePromise = (async () => {
      try {
        const core: any = await import('gsap');
        const gsap = core.gsap || core.default;
        let ScrollTrigger: any = null;
        try {
          const st: any = await import('gsap/ScrollTrigger');
          ScrollTrigger = st.ScrollTrigger || st.default;
          if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
        } catch {
          ScrollTrigger = null; // scroll effects degrade to plain on-load reveals
        }
        return { gsap, ScrollTrigger };
      } catch (err) {
        console.warn('GSAP unavailable, animations disabled:', err);
        return null;
      }
    })();
  }
  return bundlePromise;
}

/**
 * Run `setup` with GSAP inside a gsap.context scoped to `scope`, and return a cleanup that reverts
 * everything (safe under React Strict Mode's double-invoked effects and on route changes).
 * Resolves nothing if reduced motion is on or GSAP is missing.
 */
export function withGsap(
  scope: HTMLElement | null,
  setup: (g: GsapBundle) => void | (() => void)
): () => void {
  let ctx: any = null;
  let extraCleanup: void | (() => void);
  let cancelled = false;

  if (!scope || prefersReducedMotion()) return () => {};

  loadGsap().then((g) => {
    if (cancelled || !g) return;
    ctx = g.gsap.context(() => {
      extraCleanup = setup(g);
    }, scope);
  });

  return () => {
    cancelled = true;
    try {
      if (typeof extraCleanup === 'function') extraCleanup();
    } catch {
      /* ignore */
    }
    try {
      ctx?.revert();
    } catch {
      /* ignore */
    }
  };
}

/** Scramble text into place (core GSAP only — no paid/optional plugins required). */
const GLYPHS = '01<>/\\_[]{}#$%&*+=-';
export function scrambleTo(
  g: GsapBundle,
  el: HTMLElement,
  finalText: string,
  opts: { duration?: number; delay?: number } = {}
) {
  const state = { p: 0 };
  const chars = finalText.split('');
  el.textContent = chars.map((c) => (c === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('');
  g.gsap.to(state, {
    p: 1,
    duration: opts.duration ?? 0.9,
    delay: opts.delay ?? 0,
    ease: 'power2.out',
    onUpdate: () => {
      const reveal = Math.floor(state.p * chars.length);
      el.textContent = chars
        .map((c, i) => (c === ' ' || i < reveal ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
        .join('');
    },
    onComplete: () => {
      el.textContent = finalText;
    },
  });
}
