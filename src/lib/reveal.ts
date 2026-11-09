// src/lib/reveal.ts
//
// Scroll-reveal and hero-intro animations that NEVER touch the page's HTML attributes.
// They use the Web Animations API (animations are not part of the DOM), so they can safely start before React
// has finished hydrating the page. (The earlier GSAP version wrote inline `style="opacity:0..."` onto
// server-rendered elements, which React reports as a hydration mismatch.)
//
//   data-reveal       → below-the-fold items fade/slide up as they scroll into view
//   data-hero-title / data-hero-item (inside [data-hero]) → intro on page load
//
// Nothing is ever left hidden: no IntersectionObserver / Web Animations support = content simply shows,
// and the `motion-ready` class that hides the hero until it animates is removed after a short failsafe.

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const canAnimate = () => typeof Element !== 'undefined' && 'animate' in Element.prototype && typeof IntersectionObserver !== 'undefined';

export interface Revealer { reveal(els: Element[]): void; destroy(): void }

export function createRevealer(): Revealer {
  const seen = new WeakSet<Element>();
  const pending = new Map<Element, Animation>();
  let io: IntersectionObserver | null = null;

  if (canAnimate()) {
    io = new IntersectionObserver(
      (entries) => {
        entries.filter((e) => e.isIntersecting).forEach((e, i) => {
          const anim = pending.get(e.target);
          io!.unobserve(e.target);
          pending.delete(e.target);
          if (!anim) return;
          anim.effect?.updateTiming({ delay: i * 70 }); // items entering together cascade
          anim.onfinish = () => anim.cancel();          // finished: remove the animation entirely
          anim.play();
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 }
    );
  }

  return {
    reveal(els) {
      if (!io) return;
      for (const el of els) {
        if (seen.has(el)) continue;
        seen.add(el);
        // only content that is below the fold is held back; what is already visible is left alone
        if (el.getBoundingClientRect().top <= window.innerHeight * 0.9) continue;
        const anim = el.animate([{ opacity: 0, translate: '0 32px' }, { opacity: 1, translate: '0 0' }], { duration: 900, easing: EASE, fill: 'both' });
        anim.pause();
        pending.set(el, anim);
        io.observe(el);
      }
    },
    destroy() {
      io?.disconnect();
      pending.forEach((a) => a.cancel()); // anything still waiting becomes visible
      pending.clear();
    },
  };
}

/** Plays the intro for [data-hero]. Starts from the CSS `html.motion-ready` hidden state; holds the final state. */
export function playHeroIntro(root: ParentNode): void {
  if (!canAnimate()) return;
  const hero = root.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return;
  const parts = [...hero.querySelectorAll<HTMLElement>('[data-hero-title], [data-hero-item]')];
  parts.forEach((el, i) => {
    // `translate` (not `transform`) so it never fights hover/press/magnetic transforms
    el.animate([{ opacity: 0, translate: '0 22px' }, { opacity: 1, translate: '0 0' }], { duration: 700, delay: i * 110, easing: EASE, fill: 'both' });
  });
}
