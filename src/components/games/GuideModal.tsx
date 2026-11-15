// src/components/games/GuideModal.tsx — "How to play" for one game (data: lib/games/guides.ts), plus the first-time hint strip.
'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { guideFor } from '@/lib/games/guides';
import { safeLocal } from '@/lib/safeStorage';

const List = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex gap-2 text-sm text-zinc-300"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />{t}</li>)}</ul>
);

export function GuideModal({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const g = guideFor(id);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [onClose]);
  if (!g) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={`How to play ${title}`}>
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div ref={box} tabIndex={-1} className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-zinc-700 bg-zinc-950 shadow-2xl outline-none sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Icon name="lightbulb" size={18} className="text-accent" />
          <h2 className="flex-1 text-base font-bold text-zinc-100">How to play {title}</h2>
          <button type="button" onClick={onClose} aria-label="Close guide" className="flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:text-white"><Icon name="close" size={18} /></button>
        </div>
        <div className="space-y-5 overflow-y-auto px-4 py-4 sb-slim">
          <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-zinc-100"><strong className="mr-1 font-mono text-[11px] text-accent">GOAL</strong>{g.goal}</p>
          <section><h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500">Controls</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="mb-1 font-mono text-[11px] text-accent">KEYBOARD</p><List items={g.controls.keyboard} /></div>
              <div><p className="mb-1 font-mono text-[11px] text-accent">TOUCH</p><List items={g.controls.touch} /></div>
            </div></section>
          <section><h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500">Rules</h3><List items={g.rules} /></section>
          <section><h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500">Pro tips</h3><List items={g.tips} /></section>
          <section><h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500">Common mistakes</h3><List items={g.mistakes} /></section>
          <p className="text-xs text-zinc-400"><strong className="font-mono text-[11px] text-zinc-300">SCORING </strong>{g.scoring}</p>
        </div>
      </div>
    </div>
  );
}

/** One-line hint the first time a game is opened, with a link to the full guide. */
export function FirstTimeHint({ id, onMore }: { id: string; onMore: () => void }) {
  const g = guideFor(id);
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(!!g && safeLocal.get(`sys_guide_seen_${id}`) !== '1'); }, [id, g]);
  if (!g || !show) return null;
  const dismiss = () => { safeLocal.set(`sys_guide_seen_${id}`, '1'); setShow(false); };
  return (
    <div role="note" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-xs text-zinc-200">
      <Icon name="lightbulb" size={15} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1">{g.hint}</span>
      <button type="button" onClick={() => { dismiss(); onMore(); }} className="cursor-pointer font-mono text-[11px] text-accent hover:underline">FULL GUIDE</button>
      <button type="button" onClick={dismiss} aria-label="Dismiss hint" className="cursor-pointer text-zinc-500 hover:text-zinc-200"><Icon name="close" size={14} /></button>
    </div>
  );
}
