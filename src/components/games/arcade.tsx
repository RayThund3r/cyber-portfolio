// src/components/games/arcade.tsx — shared plumbing for the real-time games: a frame loop that pauses when the tab is hidden,
// swipe detection, an on-screen pad, the accent colour for canvases and the "tell the buddy" helper.
'use client';

import { ReactNode, useEffect, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import { publishGame, type GameEventDetail } from '@/lib/chatBus';

/** requestAnimationFrame loop with dt in seconds (clamped), paused while `running` is false or the tab is hidden. */
export function useFrameLoop(cb: (dt: number) => void, running: boolean) {
  const fn = useRef(cb);
  fn.current = cb;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = 0;
    const frame = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (!document.hidden) fn.current(dt);
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => { last = 0; };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
  }, [running]);
}

export const accentColor = (): string => {
  try { return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#22d3ee'; } catch { return '#22d3ee'; }
};

export const reducedMotion = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Tell the game buddy and the assistant what is happening. Never throws. */
export const say = (game: string, kind: GameEventDetail['kind'], extra: Omit<GameEventDetail, 'game' | 'kind'> = {}) => publishGame({ game, kind, ...extra });

/** Calls onSwipe('U'|'D'|'L'|'R') for a finger drag longer than `min` px. Spread the result onto the element. */
export function useSwipe(onSwipe: (d: 'U' | 'D' | 'L' | 'R') => void, min = 24) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY }; },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current; start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U');
    },
  };
}

/** Big touch buttons. `hold` repeats while pressed (for moving left/right). */
export function PadButton({ label, onPress, hold = false, children, className = '' }: { label: string; onPress: () => void; hold?: boolean; children: ReactNode; className?: string }) {
  const timer = useRef<number | null>(null);
  const stop = () => { if (timer.current) { window.clearInterval(timer.current); timer.current = null; } };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); onPress(); if (hold) { stop(); timer.current = window.setInterval(onPress, 110); } }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex h-14 min-w-14 touch-none select-none items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/80 font-mono text-xs text-zinc-200 active:scale-95 active:border-accent active:text-accent ${className}`}
    >
      {children}
    </button>
  );
}

export const Arrow = ({ dir }: { dir: 'U' | 'D' | 'L' | 'R' }) => (
  <Icon name="arrowUp" size={22} style={{ transform: `rotate(${dir === 'U' ? 0 : dir === 'R' ? 90 : dir === 'D' ? 180 : 270}deg)` }} />
);

/** Keyboard handler that ignores typing in inputs and stops the page from scrolling on game keys. */
export function useGameKeys(handler: (key: string, e: KeyboardEvent) => boolean | void, active = true) {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (h.current(e.key, e) === true) e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [active]);
}

/** Canvas sized for the device pixel ratio, drawn in logical units. */
export function setupCanvas(c: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
