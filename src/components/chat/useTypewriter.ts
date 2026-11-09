// src/components/chat/useTypewriter.ts
//
// Reveals a finished reply a little at a time so it reads like someone typing, instead of a wall of
// text popping in. Skippable (tap the message), instant under prefers-reduced-motion, and it always
// ends on the exact full text.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

export function useTypewriter(full: string, enabled: boolean, onDone: () => void, onTick?: () => void) {
  const instant = !enabled || prefersReducedMotion();
  const [shown, setShown] = useState(instant ? full.length : 0);
  const done = useRef(false);
  const cb = useRef({ onDone, onTick });
  cb.current = { onDone, onTick };

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setShown(full.length);
    cb.current.onDone();
  }, [full]);

  useEffect(() => {
    if (instant) {
      if (!done.current) finish();
      return;
    }
    done.current = false;
    setShown(0);
    // ~7 ms per character, but never shorter than 350 ms nor longer than 1.8 s
    const total = Math.min(1800, Math.max(350, full.length * 7));
    const start = performance.now();
    const id = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / total);
      let n = Math.ceil(p * full.length);
      // stop at a word boundary so words don't appear half-typed
      if (p < 1) {
        const space = full.indexOf(' ', n);
        n = space === -1 ? full.length : space;
      }
      setShown(n);
      cb.current.onTick?.();
      if (p >= 1) {
        window.clearInterval(id);
        finish();
      }
    }, 32);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, instant]);

  return { text: full.slice(0, shown), typing: !instant && shown < full.length, skip: finish };
}
