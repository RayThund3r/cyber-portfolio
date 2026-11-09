// src/components/chat/ImageLightbox.tsx
// Full-size view of a picture from the chat. Portalled to <body> (the chat window has transforms
// that would otherwise trap a fixed overlay). Esc / click / ✕ close it; focus returns to the opener.
'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ImageLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // don't also close the chat underneath
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      data-modal-open
      onClick={onClose}
      className="animate-nudge-in fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ''}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] max-w-full rounded-xl border border-white/10 object-contain shadow-2xl"
      />
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="touch-target absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex cursor-pointer items-center justify-center rounded-full border border-white/15 bg-zinc-900/90 text-zinc-200 hover:text-white"
      >
        ✕
      </button>
    </div>,
    document.body
  );
}
