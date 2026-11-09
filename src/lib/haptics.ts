// src/lib/haptics.ts
// A tiny tap of vibration on phones that support it. Never throws, never runs without a touch
// screen, and respects reduced-motion.
import { isCoarsePointer, prefersReducedMotion } from './motion';

export function tap(ms = 10): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (!isCoarsePointer() || prefersReducedMotion()) return;
    navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
