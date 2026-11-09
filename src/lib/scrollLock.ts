// src/lib/scrollLock.ts
//
// One shared, ref-counted body scroll lock. The mobile menu, the full-screen chat and the project
// popup can be open at the same time (e.g. the chat opens a project, then tucks itself away); when
// each saved/restored `body.style.overflow` on its own, closing them in a different order than they
// opened left the page permanently un-scrollable. Here the page unlocks only when the LAST holder
// releases.

let count = 0;
let saved = '';

export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (count === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
  }
  count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
    if (count === 0) {
      document.body.style.overflow = saved;
      document.documentElement.style.overscrollBehavior = '';
    }
  };
}
