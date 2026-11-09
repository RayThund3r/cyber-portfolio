// src/components/portfolio/imageFallback.ts
import type { SyntheticEvent } from 'react';

export const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop';

/** Swap a broken image for the fallback once (prevents infinite error loops). */
export function applyImageFallback(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  // React's onError is not the DOM `onerror` property, so it must be guarded explicitly —
  // otherwise a failing fallback (offline) would retry forever.
  if (img.dataset.fellBack === '1') return;
  img.dataset.fellBack = '1';
  img.src = FALLBACK_IMAGE;
}
