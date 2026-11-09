// src/components/builder/GuidedTour.tsx
//
// A small, dependency-free "coach marks" tour: dims the page, spotlights one element at a time and explains it.
// Skips steps whose element is not on screen, works with keyboard (←, →, Esc) and on phones, and remembers when it was finished.
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TourStep {
  /** CSS selector of the element to highlight. */
  target: string;
  title: string;
  text: string;
  /** Runs before the step is shown (for example: switch the editor to the preview). */
  before?: () => void;
}

const PAD = 8;

export default function GuidedTour({ steps, open, onClose, doneKey }: { steps: TourStep[]; open: boolean; onClose: () => void; doneKey: string }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const finish = useCallback(() => {
    try { localStorage.setItem(doneKey, '1'); } catch { /* storage blocked: the tour may show again, harmless */ }
    onClose();
  }, [doneKey, onClose]);

  // measure the current target (and keep it in view / in sync while the page moves)
  const measure = useCallback(() => {
    const el = document.querySelector(steps[i]?.target ?? '') as HTMLElement | null;
    if (!el || el.offsetParent === null) return setRect(null);
    setRect(el.getBoundingClientRect());
  }, [steps, i]);

  useEffect(() => { if (open) setI(0); }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    steps[i]?.before?.();
    const t = setTimeout(() => {
      const el = document.querySelector(steps[i]?.target ?? '') as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      measure();
    }, 120);
    return () => clearTimeout(t);
  }, [open, i, steps, measure]);
  useEffect(() => {
    if (!open) return;
    const on = () => measure();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    const iv = setInterval(on, 500); // layout can shift while panels open
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); clearInterval(iv); };
  }, [open, measure]);

  const go = useCallback((d: number) => {
    // jump over steps whose element is not available (for example a hidden panel)
    let n = i + d;
    while (n >= 0 && n < steps.length) {
      const el = document.querySelector(steps[n].target) as HTMLElement | null;
      if (steps[n].before || (el && el.offsetParent !== null)) break;
      n += d;
    }
    if (n >= steps.length) return finish();
    if (n >= 0) setI(n);
  }, [i, steps, finish]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', k);
    nextRef.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open, go, finish]);

  if (!open || !steps[i]) return null;
  const s = steps[i];
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth, vh = typeof window === 'undefined' ? 768 : window.innerHeight;
  const W = Math.min(340, vw - 24);
  // place the card below the target when there is room, otherwise above, otherwise centred
  let top = vh / 2 - 90, left = (vw - W) / 2;
  if (rect) {
    const below = rect.bottom + PAD + 12, above = rect.top - PAD - 12;
    top = below + 190 < vh ? below : above - 190 > 0 ? above - 190 : Math.max(12, Math.min(vh - 200, below));
    left = Math.max(12, Math.min(vw - W - 12, rect.left + rect.width / 2 - W / 2));
  }

  return (
    <div className="fixed inset-0 z-[300]" role="dialog" aria-label="Quick tour">
      {/* click-catcher + dim; the spotlight is a hole made with a huge box-shadow */}
      <div className="absolute inset-0" onClick={finish} aria-hidden="true" />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-cyan-400 transition-all duration-300"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgba(0,0,0,0.68)' }}
        />
      )}
      {!rect && <div className="pointer-events-none absolute inset-0 bg-black/68" style={{ background: 'rgba(0,0,0,0.68)' }} />}
      <div className="absolute rounded-xl border border-cyan-500/40 bg-zinc-900 p-4 text-zinc-100 shadow-2xl" style={{ top, left, width: W }}>
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-cyan-300">
          <span>STEP {i + 1} OF {steps.length}</span>
          <button type="button" onClick={finish} className="rounded px-1 text-zinc-400 hover:text-zinc-100">Skip ✕</button>
        </div>
        <h2 className="text-base font-bold">{s.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">{s.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => go(-1)} disabled={i === 0} className="min-h-10 rounded border border-zinc-700 px-3 font-mono text-xs disabled:opacity-30">Back</button>
          <div className="flex gap-1" aria-hidden="true">{steps.map((_, n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${n === i ? 'bg-cyan-400' : 'bg-zinc-700'}`} />)}</div>
          <button ref={nextRef} type="button" onClick={() => go(1)} className="min-h-10 rounded bg-cyan-500 px-4 font-mono text-xs font-semibold text-black">{i === steps.length - 1 ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
