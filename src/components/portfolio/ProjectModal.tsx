// src/components/portfolio/ProjectModal.tsx
//
// The project popup. It owns its own gallery state (slide index, autoplay) so a slideshow tick
// re-renders only this component, never the whole archive grid behind it.
//
// Added on top of the original popup:
//   - focus is trapped inside the dialog and returned to the card that opened it
//   - previous / next project buttons (steps through whatever the grid is currently showing)
//   - gallery arrows, swipe, and ← → keys; autoplay is off for visitors who prefer reduced motion
//   - share / copy link, and REQUEST_WORK opens the form that fits the project
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import type { ProjectItem } from '@/data/portfolioData';
import { contactUrl, portfolioUrl } from '@/lib/siteUrls';
import { lockScroll } from '@/lib/scrollLock';
import { FALLBACK_IMAGE, applyImageFallback } from './imageFallback';

interface ModalProps {
  project: ProjectItem;
  /** Place in the list being stepped through, or null when stepping isn't possible. */
  position: { index: number; total: number } | null;
  onClose: () => void;
  onStep: (dir: -1 | 1) => void;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

export default function ProjectModal({ project, position, onClose, onStep }: ModalProps) {
  // On phones the popup is an iOS-style bottom sheet: springs up from the bottom edge and can be
  // dragged down to dismiss (grab the handle or the header). Desktop keeps the centred popup.
  const [sheet] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  const dragControls = useDragControls();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Lock background scroll while open.
  useEffect(() => lockScroll(), []);

  // Move focus in, and put it back on the card that opened the popup when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Escape closes; Tab / Shift+Tab loop inside the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Stepping to another project: start reading from the top.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [project.id]);

  return (
    <div
      ref={dialogRef}
      className={`fixed inset-0 z-[100] flex justify-center font-sans text-zinc-100 ${sheet ? 'items-end' : 'items-center p-3 sm:p-4'}`}
      role="dialog"
      data-modal-open
      aria-modal="true"
      aria-label={`Project ${project.id}: ${project.title}`}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
      />

      {/* Modal card */}
      <motion.div
        initial={sheet ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={sheet ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
        drag={sheet ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.7 }}
        onDragEnd={(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
          if (info.offset.y > 110 || info.velocity.y > 700) onClose();
        }}
        className={`relative flex w-full max-w-2xl flex-col overflow-hidden border border-accent/60 bg-zinc-950 glow-accent-lg ${
          sheet
            ? 'h-[92vh] max-h-[92dvh] rounded-t-2xl border-b-0 pb-[env(safe-area-inset-bottom)] supports-[height:100dvh]:h-[92dvh]'
            : 'h-[88vh] max-h-[88dvh] supports-[height:100dvh]:h-[88dvh] rounded-xl'
        }`}
      >
        {/* Grabber (phones): drag it, or the header, down to close */}
        {sheet && (
          <div className="flex flex-shrink-0 touch-none justify-center bg-zinc-900/90 pb-1 pt-2.5" onPointerDown={(e: React.PointerEvent) => dragControls.start(e)}>
            <span className="h-1.5 w-10 rounded-full bg-zinc-600" aria-hidden="true" />
          </div>
        )}
        {/* Header */}
        <div
          className={`flex flex-shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/90 px-4 py-3 sm:px-6 ${sheet ? 'touch-none' : ''}`}
          onPointerDown={(e: React.PointerEvent) => {
            // Dragging the header moves the sheet; taps on its buttons must stay taps.
            if (sheet && !(e.target as HTMLElement).closest('button, a')) dragControls.start(e);
          }}
        >
          <span className="flex min-w-0 items-center gap-2 truncate font-mono text-[11px] text-accent sm:text-xs">
            <span className="h-2 w-2 flex-shrink-0 animate-ping rounded-full bg-accent" />
            <span className="truncate">MODULE_INSPECTION // ID: {project.id}</span>
          </span>

          <div className="flex flex-shrink-0 items-center gap-1.5 font-mono text-xs">
            {position && position.total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onStep(-1)}
                  aria-label="Previous project"
                  className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800/60 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                >
                  ‹
                </button>
                <span className="hidden min-w-[3.25rem] text-center text-[11px] text-zinc-500 xs:inline" aria-live="polite">
                  {String(position.index + 1).padStart(2, '0')} / {String(position.total).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={() => onStep(1)}
                  aria-label="Next project"
                  className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800/60 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                >
                  ›
                </button>
              </>
            )}
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="ml-1 min-h-10 cursor-pointer rounded bg-zinc-800/60 px-3 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
            >
              [CLOSE ✕]
            </button>
          </div>
        </div>

        {/* Scrollable body (keyed: gallery state resets for each project) */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <ModalBody key={project.id} project={project} onClose={onClose} />
        </div>
      </motion.div>
    </div>
  );
}

function ModalBody({ project, onClose }: { project: ProjectItem; onClose: () => void }) {
  const gallery = project.gallery && project.gallery.length > 0 ? project.gallery : null;
  const count = gallery?.length ?? 1;

  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(() => count > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [imageHasError, setImageHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (dir: -1 | 1) => {
      setAutoplay(false);
      setImageHasError(false);
      setIndex((i) => (i + dir + count) % count);
    },
    [count]
  );

  // Slideshow
  useEffect(() => {
    if (!autoplay || count <= 1) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), 3000);
    return () => window.clearInterval(t);
  }, [autoplay, count]);

  // ← → change the picture
  useEffect(() => {
    if (count <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, go]);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const pick = (idx: number) => {
    setAutoplay(false);
    setImageHasError(false);
    setIndex(idx);
  };

  const share = async () => {
    const url = `${window.location.origin}${portfolioUrl({ open: project.id })}`;
    try {
      // Phones get the native share sheet; desktops copy the link.
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: project.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* cancelled share sheet or blocked clipboard: nothing to do */
    }
  };

  const src = imageHasError ? FALLBACK_IMAGE : gallery?.[index] || project.image;

  return (
    <div className="space-y-4">
      <div
        className="relative h-52 flex-shrink-0 touch-pan-y select-none overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 sm:h-64"
        onPointerDown={(e) => {
          swipeStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipeStart.current;
          swipeStart.current = null;
          if (!s || count <= 1) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            src={src}
            alt={count > 1 ? `${project.title}, image ${index + 1} of ${count}` : project.title}
            draggable={false}
            onError={() => setImageHasError(true)}
            className="h-full w-full object-cover"
          />
        </AnimatePresence>

        {count > 1 && (
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 font-mono text-[10px] text-accent backdrop-blur-md">
            {autoplay ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span>AUTOPLAY ACTIVE</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>MANUAL OVERRIDE</span>
              </>
            )}
          </div>
        )}

        <div className="absolute right-2 top-2 rounded border border-zinc-800 bg-zinc-950/80 px-2 py-1 font-mono text-[10px] text-accent backdrop-blur-md">
          IMG [{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}]
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-lg text-zinc-200 backdrop-blur-md transition-colors hover:border-accent/50 hover:text-accent"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-lg text-zinc-200 backdrop-blur-md transition-colors hover:border-accent/50 hover:text-accent"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {gallery && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] text-zinc-500">SUB_MODULE GALLERY (SELECT TO OVERRIDE)</span>
            {autoplay && (
              <button type="button" onClick={() => setAutoplay(false)} className="py-1 font-mono text-[10px] text-accent hover:underline max-sm:py-2">
                [PAUSE]
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {gallery.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => pick(idx)}
                aria-label={`Show image ${idx + 1}`}
                aria-current={index === idx}
                className={`h-12 overflow-hidden rounded border transition-all sm:h-14 ${
                  index === idx ? 'scale-105 border-accent glow-accent' : 'border-zinc-800 opacity-60 hover:border-zinc-700 hover:opacity-100'
                }`}
              >
                <img src={imgUrl} alt="" loading="lazy" decoding="async" onError={applyImageFallback} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 font-mono text-xs">
        <span className="rounded border border-accent/30 bg-accent/10 px-2.5 py-1 text-accent">[{project.category}]</span>
        {project.clientType && <span className="text-zinc-400">• {project.clientType}</span>}
      </div>

      <h2 className="text-xl font-bold text-zinc-100 sm:text-2xl">{project.title}</h2>

      <p className="font-sans text-xs leading-relaxed text-zinc-300 sm:text-sm">{project.description}</p>

      <div className="grid grid-cols-1 gap-3 border-t border-zinc-900 pt-4 font-mono text-xs sm:grid-cols-2">
        {/* Only shown when a real result has been entered for the project */}
        {project.metrics && (
          <div className="rounded border border-zinc-800/80 bg-zinc-900/40 p-3">
            <span className="mb-1 block text-zinc-500">RESULT</span>
            <span className="font-semibold text-accent">{project.metrics}</span>
          </div>
        )}
        <div className="rounded border border-zinc-800/80 bg-zinc-900/40 p-3">
          <span className="mb-1 block text-zinc-500">TOOLCHAIN USED</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {project.tools?.map((t) => (
              <span key={t} className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-zinc-300">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-900 pt-4 font-mono text-xs sm:flex-row">
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 cursor-pointer rounded border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-300 transition-all duration-200 hover:border-zinc-700 sm:flex-none"
          >
            MINIMIZE_TO_GRID
          </button>
          <button
            type="button"
            onClick={share}
            className="min-h-11 flex-1 cursor-pointer rounded border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-300 transition-all duration-200 hover:border-accent/40 hover:text-accent sm:flex-none"
          >
            <span aria-live="polite">{copied ? 'LINK COPIED ✓' : 'SHARE_LINK'}</span>
          </button>
        </div>

        <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-center text-emerald-400 transition-all duration-200 hover:scale-105 sm:w-auto"
            >
              LIVE SITE ↗
            </a>
          )}
          <Link
            href={`/portfolio/${project.id}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded border border-accent/30 bg-accent/10 px-4 py-2.5 text-center text-accent transition-all duration-200 hover:scale-105 sm:w-auto"
          >
            [DEEP-DIVE ARCHIVE →]
          </Link>
          <Link
            href={contactUrl(project.category === 'HARDWARE' ? 'repair' : 'design')}
            className="inline-flex min-h-11 w-full items-center justify-center rounded bg-accent-strong px-5 py-2.5 text-center font-semibold text-black transition-all duration-300 hover:scale-105 hover:bg-accent glow-accent sm:w-auto"
          >
            REQUEST_WORK →
          </Link>
        </div>
      </div>
    </div>
  );
}
