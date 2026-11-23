// src/components/builder/useSortable.ts
//
// Drag-and-drop reordering for vertical lists, built on Pointer Events so it works the same with a mouse, a finger or a pen,
// with no library. It also works from the keyboard (focus the grip, then ↑ / ↓) and announces moves to screen readers.
//
//   const sort = useSortable({ count: items.length, onReorder: (from, to) => … });
//   <ul>{items.map((it, i) => <li key={…} {...sort.itemProps(i)}><button {...sort.handleProps(i)}><Icon name="grip" /></button>…</li>)}</ul>
//   <span className="sr-only" role="status">{sort.status}</span>
'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';

export interface SortableOptions {
  count: number;
  /** Only items in this inclusive index range can move or be moved over (e.g. keep a header first and a footer last). */
  range?: [number, number];
  onReorder: (from: number, to: number) => void;
  disabled?: boolean;
}

interface DragState { from: number; to: number; dy: number }

export function useSortable({ count, range, onReorder, disabled }: SortableOptions) {
  const lo = range?.[0] ?? 0;
  const hi = range?.[1] ?? Math.max(0, count - 1);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [status, setStatus] = useState('');
  const rects = useRef<{ top: number; height: number }[]>([]);
  const gap = useRef(8);
  const cleanup = useRef<(() => void) | null>(null);
  const latest = useRef({ lo, hi, onReorder });
  latest.current = { lo, hi, onReorder };

  useEffect(() => () => cleanup.current?.(), []);

  // Where would the dragged row land if dropped with the pointer at `py`? Count how many OTHER movable rows have their
  // middle above the pointer: that is the new index. Using the pointer (not the dragged row's own middle) keeps this right
  // when rows have very different heights, for example an expanded section next to collapsed ones.
  const targetFor = (from: number, py: number): number => {
    const r = rects.current;
    let k = 0;
    for (let j = latest.current.lo; j <= latest.current.hi; j++) {
      if (!r[j] || j === from) continue;
      if (py > r[j].top + r[j].height / 2) k++;
    }
    return Math.max(latest.current.lo, Math.min(latest.current.hi, latest.current.lo + k));
  };

  const handleProps = useCallback((i: number) => ({
    type: 'button' as const,
    disabled: disabled || undefined,
    'aria-label': 'Drag to reorder (or press the up and down arrow keys)',
    title: 'Drag to reorder',
    style: { touchAction: 'none', cursor: disabled ? 'not-allowed' : 'grab' } as CSSProperties,
    onKeyDown: (e: KeyboardEvent) => {
      if (disabled || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      const to = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (to < latest.current.lo || to > latest.current.hi) return;
      latest.current.onReorder(i, to);
      setStatus(`Moved to position ${to - latest.current.lo + 1} of ${latest.current.hi - latest.current.lo + 1}`);
      // keep keyboard focus on the same item's grip after it re-renders in its new place
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-sort-index="${to}"] [data-sort-grip]`)?.focus());
    },
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0 || i < latest.current.lo || i > latest.current.hi) return;
      const grip = e.currentTarget;
      const row = grip.closest('[data-sort-index]');
      const rows = row?.parentElement ? ([...row.parentElement.children].filter((c) => c.hasAttribute('data-sort-index')) as HTMLElement[]) : [];
      if (!rows.length) return;
      e.preventDefault();
      rects.current = rows.map((r) => { const b = r.getBoundingClientRect(); return { top: b.top, height: b.height }; });
      gap.current = rects.current.length > 1 ? Math.max(0, rects.current[1].top - (rects.current[0].top + rects.current[0].height)) : 8;
      const scroller = grip.closest<HTMLElement>('.overflow-y-auto') ?? (document.scrollingElement as HTMLElement | null);
      const startY = e.clientY, startScroll = scroller?.scrollTop ?? 0;
      let current: DragState = { from: i, to: i, dy: 0 };
      setDrag(current);
      try { grip.setPointerCapture(e.pointerId); } catch { /* not capturable */ }

      const move = (ev: PointerEvent) => {
        if (scroller) { // scroll the panel when the pointer nears its edge
          const sr = scroller.getBoundingClientRect();
          if (ev.clientY < sr.top + 40) scroller.scrollTop -= 12; else if (ev.clientY > sr.bottom - 40) scroller.scrollTop += 12;
        }
        const dy = ev.clientY - startY + ((scroller?.scrollTop ?? 0) - startScroll);
        const py = ev.clientY + ((scroller?.scrollTop ?? 0) - startScroll);
        current = { from: i, to: targetFor(i, py), dy };
        setDrag(current);
      };
      const end = (commit: boolean) => {
        cleanup.current?.();
        setDrag(null);
        if (commit && current.to !== i) {
          latest.current.onReorder(i, current.to);
          setStatus(`Moved to position ${current.to - latest.current.lo + 1} of ${latest.current.hi - latest.current.lo + 1}`);
        }
      };
      const up = () => end(true);
      const cancel = () => end(false);
      const key = (ev: globalThis.KeyboardEvent) => { if (ev.key === 'Escape') end(false); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', key);
      cleanup.current = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); cleanup.current = null;
      };
    },
    'data-sort-grip': '',
  }), [disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const itemProps = (i: number): { 'data-sort-index': number; style?: CSSProperties } => {
    if (!drag) return { 'data-sort-index': i };
    const h = (rects.current[drag.from]?.height ?? 0) + gap.current;
    if (i === drag.from) {
      return { 'data-sort-index': i, style: { transform: `translateY(${drag.dy}px)`, zIndex: 30, position: 'relative', transition: 'none', boxShadow: '0 10px 30px rgba(0,0,0,.45)', cursor: 'grabbing' } };
    }
    let shift = 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -h;
    else if (drag.from > drag.to && i < drag.from && i >= drag.to) shift = h;
    return { 'data-sort-index': i, style: { transform: shift ? `translateY(${shift}px)` : undefined, transition: 'transform 160ms cubic-bezier(0.32, 0.72, 0, 1)' } };
  };

  return { handleProps, itemProps, status, dragging: drag !== null };
}
