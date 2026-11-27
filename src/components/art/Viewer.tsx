// src/components/art/Viewer.tsx — full-screen viewer: the picture lit by its own colour, zoom and pan, swipe, filmstrip,
// slideshow, share, and a one-tap way to ask for something similar.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';
import { colorOf, commissionHref, imgSrc, toneOf, type Art } from './types';

interface View { s: number; x: number; y: number }
const ONE: View = { s: 1, x: 0, y: 0 };
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export default function Viewer({ items, index, onIndex, onClose }: { items: Art[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const art = items[index];
  const many = items.length > 1;
  const root = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [view, setView] = useState<View>(ONE);
  const [loaded, setLoaded] = useState(false);
  const [info, setInfo] = useState(true);
  const [play, setPlay] = useState(false);
  const [note, setNote] = useState('');
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ d0: number; s0: number; x0: number; y0: number; vx: number; vy: number; moved: boolean } | null>(null);
  const c = colorOf(art);

  const go = useCallback((d: number) => { if (items.length > 1) onIndex((index + d + items.length) % items.length); }, [index, items.length, onIndex]);
  const zoomBy = useCallback((f: number) => setView((v) => { const s = clamp(v.s * f, 1, 6); return s === 1 ? ONE : { ...v, s }; }), []);

  // a new piece starts un-zoomed and un-loaded
  useEffect(() => { setView(ONE); setLoaded(false); }, [art.id]);
  // start closed on small screens so the picture gets the room
  useEffect(() => { setInfo(window.matchMedia('(min-width: 1024px)').matches); }, []);

  // lock the page behind, remember who opened us, give focus back on close
  useEffect(() => {
    opener.current = document.activeElement;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    root.current?.focus();
    return () => { document.body.style.overflow = prev; (opener.current as HTMLElement | null)?.focus?.(); };
  }, []);

  // neighbours load in the background so next/previous feels instant
  useEffect(() => { [1, -1].forEach((d) => { const n = items[(index + d + items.length) % items.length]; if (n && n.id !== art.id) { const im = new Image(); im.src = imgSrc(n); } }); }, [index, items, art.id]);

  // slideshow
  useEffect(() => {
    if (!play || view.s > 1 || !many) return;
    const t = window.setInterval(() => go(1), 5000);
    return () => window.clearInterval(t);
  }, [play, view.s, many, go]);

  const fullscreen = () => { const el = root.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.().catch(() => undefined); };
  const share = async () => {
    const url = `${location.origin}/art?piece=${art.id}`;
    try {
      if (navigator.share) await navigator.share({ title: art.title, url });
      else { await navigator.clipboard.writeText(url); setNote('Link copied'); window.setTimeout(() => setNote(''), 1800); }
    } catch { /* cancelled */ }
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { if (document.fullscreenElement) return; onClose(); }
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === '+' || e.key === '=') zoomBy(1.4);
      else if (e.key === '-') zoomBy(1 / 1.4);
      else if (e.key === '0') setView(ONE);
      else if (e.key === ' ' && many) { e.preventDefault(); setPlay((p) => !p); }
      else if (e.key.toLowerCase() === 'f') fullscreen();
      else if (e.key.toLowerCase() === 'i') setInfo((v) => !v);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, zoomBy, onClose, many]);

  useEffect(() => { strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }, [index]);

  // pointer gestures: drag to pan when zoomed, pinch to zoom, swipe to change piece, double tap to zoom
  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.current.values()];
    gesture.current = { d0: p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0, s0: view.s, x0: view.x, y0: view.y, vx: e.clientX, vy: e.clientY, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const g = gesture.current; if (!g || !pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.current.values()];
    if (p.length === 2 && g.d0 > 0) {
      const s = clamp(g.s0 * (Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / g.d0), 1, 6);
      setView((v) => (s === 1 ? ONE : { ...v, s })); g.moved = true;
    } else if (p.length === 1 && view.s > 1) {
      g.moved = true; setView((v) => ({ ...v, x: g.x0 + (e.clientX - g.vx), y: g.y0 + (e.clientY - g.vy) }));
    }
  };
  const lastTap = useRef(0);
  const up = (e: React.PointerEvent) => {
    const g = gesture.current; pts.current.delete(e.pointerId);
    if (!g || pts.current.size > 0) return;
    const dx = e.clientX - g.vx, dy = e.clientY - g.vy;
    gesture.current = null;
    if (view.s === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) { go(dx < 0 ? 1 : -1); return; }
    if (!g.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      const now = Date.now();
      if (now - lastTap.current < 320) { setView((v) => (v.s > 1 ? ONE : { s: 2.5, x: 0, y: 0 })); lastTap.current = 0; } else lastTap.current = now;
    }
  };
  const wheel = (e: React.WheelEvent) => { if (e.ctrlKey || Math.abs(e.deltaY) > 0) zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18); };

  const btn = 'flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-default disabled:opacity-30';
  const idx = items.indexOf(art);
  const wa = hasWhatsApp() ? whatsappLink(`Hello, I saw "${art.title}" in your art gallery and I would like something similar. `) : '';

  return createPortal(
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={art.title} className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#06070a] text-white outline-none">
      {/* ambient backdrop: the piece itself, blurred, plus its colour */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={`bg-${art.id}`} src={imgSrc(art, true)} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-[90px] saturate-200 transition-opacity duration-700" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(80% 70% at 40% 45%, ${c}33, transparent 70%), linear-gradient(to bottom, rgba(6,7,10,.55), rgba(6,7,10,.85))` }} />

      <header className="relative z-10 flex items-center justify-between gap-2 px-3 py-2 max-sm:pt-[max(0.5rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate pl-1 text-xs text-zinc-400"><span className="tabular-nums text-zinc-200">{idx + 1}</span> of {items.length}</p>
        <div className="flex items-center gap-1.5" role="toolbar" aria-label="Viewer controls">
          <button type="button" className={`${btn} max-sm:hidden`} onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out" disabled={view.s <= 1}><span aria-hidden="true" className="text-lg leading-none">−</span></button>
          <button type="button" className={`${btn} max-sm:hidden`} onClick={() => zoomBy(1.4)} aria-label="Zoom in" disabled={view.s >= 6}><Icon name="plus" size={16} /></button>
          {many && <button type="button" className={btn} onClick={() => setPlay((p) => !p)} aria-pressed={play} aria-label={play ? 'Pause slideshow' : 'Play slideshow'}>{play ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg> : <Icon name="play" size={15} />}</button>}
          <button type="button" className={`${btn} max-sm:hidden`} onClick={fullscreen} aria-label="Full screen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg></button>
          <button type="button" className={btn} onClick={() => setInfo((v) => !v)} aria-pressed={info} aria-label="Details"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg></button>
          <button type="button" className={btn} onClick={onClose} aria-label="Close"><Icon name="close" size={17} /></button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1 touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}
          style={{ cursor: view.s > 1 ? 'grab' : 'zoom-in' }}>
          {many && <button type="button" onClick={() => go(-1)} aria-label="Previous piece" className={`${btn} absolute left-3 top-1/2 z-10 -translate-y-1/2 max-sm:hidden`} onPointerDown={(e) => e.stopPropagation()}><Icon name="chevron-left" size={20} /></button>}
          {many && <button type="button" onClick={() => go(1)} aria-label="Next piece" className={`${btn} absolute right-3 top-1/2 z-10 -translate-y-1/2 max-sm:hidden`} onPointerDown={(e) => e.stopPropagation()}><Icon name="chevron-right" size={20} /></button>}
          <div className="flex h-full w-full items-center justify-center p-3 sm:p-8 lg:px-16">
            {!loaded && <span className="absolute h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white/70 motion-reduce:animate-none" aria-label="Loading" role="status" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={art.id} src={imgSrc(art)} alt={art.title} draggable={false} onLoad={() => setLoaded(true)} ref={(el) => { if (el?.complete && el.naturalWidth) setLoaded(true); }}
              className={`max-h-full max-w-full rounded-md object-contain shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10 transition-opacity duration-500 motion-reduce:transition-none ${loaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transition: gesture.current ? 'none' : 'transform 180ms ease-out, opacity 500ms', background: toneOf(art) }} />
          </div>
        </div>

        {info && (
          <aside className="relative z-10 max-h-[46%] shrink-0 overflow-y-auto border-t border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:p-5 lg:max-h-none lg:w-[22rem] lg:border-l lg:border-t-0 lg:p-7" aria-label="About this piece">
            <p className="text-xs text-zinc-400">{art.category}{art.year ? `, ${art.year}` : ''}</p>
            <h2 className="mt-1 text-xl sm:text-2xl font-extrabold leading-tight tracking-tight">{art.title}</h2>
            {art.description && <p className="mt-2 text-sm leading-relaxed text-zinc-300 lg:mt-3">{art.description}</p>}
            {art.tools.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Made with">
                {art.tools.map((t) => <li key={t} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-zinc-300">{t}</li>)}
              </ul>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2 lg:mt-6 lg:grid-cols-1">
              <Link href={commissionHref(art)} onClick={onClose} className="col-span-2 inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold text-black lg:col-span-1 transition hover:brightness-110" style={{ background: c }}>Ask for something like this</Link>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-3 text-sm text-zinc-100 transition hover:bg-white/10"><Icon name="chat" size={15} />WhatsApp</a>}
              <button type="button" onClick={share} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-sm text-zinc-100 transition hover:bg-white/10"><Icon name="copy" size={15} />{note || 'Share this piece'}</button>
            </div>
            <p className="mt-5 hidden text-[11px] leading-relaxed text-zinc-500 lg:block">Arrow keys to move, + and − to zoom, space for a slideshow, F for full screen.</p>
          </aside>
        )}
      </div>

      {many && (
        <div ref={strip} className="relative z-10 flex shrink-0 gap-2 overflow-x-auto px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]" role="listbox" aria-label="All pieces">
          {items.map((a, n) => (
            <button key={a.id} type="button" role="option" aria-selected={n === index} aria-current={n === index} aria-label={a.title} onClick={() => onIndex(n)}
              className={`h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg transition sm:h-14 sm:w-14 ${n === index ? 'opacity-100 ring-2' : 'opacity-50 ring-1 ring-white/10 hover:opacity-90'}`}
              style={n === index ? { ['--tw-ring-color' as string]: colorOf(a) } : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc(a, true)} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
