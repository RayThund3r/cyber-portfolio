// src/components/site/FxLayer.tsx — draws screen effects on a click-through canvas. Light by design: capped particle count,
// no effect while the tab is hidden, nothing at all for visitors who asked for reduced motion.
'use client';

import { useEffect, useRef } from 'react';
import { FX_EVENT } from '@/lib/events/fx';
import type { FxName } from '@/lib/events/calendar';

interface P { x: number; y: number; vx: number; vy: number; r: number; a: number; va: number; c: string; w: number }
const PALETTE = ['#22d3ee', '#fbbf24', '#f472b6', '#34d399', '#a78bfa', '#f87171'];
const GLYPHS = 'アイウエオカキクケコ0123456789ABCDEF'.split('');

export default function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  const run = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fit = () => { cv.width = window.innerWidth; cv.height = window.innerHeight; };
    fit(); window.addEventListener('resize', fit);

    const start = (fx: FxName, ms: number) => {
      if (reduce) return;
      if (fx === 'barrel') { try { document.body.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1100, easing: 'ease-in-out' }); } catch { /* old browser */ } return; }
      const ctx = cv.getContext('2d'); if (!ctx) return;
      run.current?.stop();
      const small = window.innerWidth < 640;
      const max = small ? 36 : 70;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22d3ee';
      const ps: P[] = [];
      const t0 = performance.now(); let raf = 0; let alive = true; let cols: number[] = [];
      const spawn = (): P => {
        const W = cv.width;
        const base = { x: Math.random() * W, y: -12, vx: 0, vy: 1 + Math.random() * 2, r: 3 + Math.random() * 4, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.2, c: PALETTE[(Math.random() * PALETTE.length) | 0], w: Math.random() * 6.28 };
        switch (fx) {
          case 'snow': return { ...base, r: 1.5 + Math.random() * 3, vy: 0.6 + Math.random() * 1.2, c: '#e2e8f0' };
          case 'hearts': return { ...base, y: cv.height + 12, vy: -(0.8 + Math.random() * 1.5), r: 6 + Math.random() * 8, c: Math.random() < 0.5 ? '#f472b6' : '#fb7185' };
          case 'lanterns': return { ...base, y: cv.height + 12, vy: -(0.4 + Math.random() * 0.8), r: 7 + Math.random() * 6, c: Math.random() < 0.5 ? '#fbbf24' : '#fb923c' };
          case 'stars': return { ...base, y: Math.random() * cv.height, vy: 0, r: 1 + Math.random() * 2.5, c: Math.random() < 0.3 ? accent : '#fef3c7' };
          case 'leaves': return { ...base, vy: 0.8 + Math.random() * 1.4, r: 4 + Math.random() * 4, c: Math.random() < 0.5 ? '#34d399' : '#86efac' };
          case 'rain': return { ...base, vy: 6 + Math.random() * 5, r: 1, c: accent };
          default: return { ...base, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3 };
        }
      };
      if (fx === 'matrix') cols = Array.from({ length: Math.ceil(cv.width / 16) }, () => Math.random() * -40);
      const draw = (now: number) => {
        if (!alive) return;
        const t = now - t0; const fading = t > ms;
        if (document.hidden) { raf = requestAnimationFrame(draw); return; }
        if (fx === 'matrix') {
          ctx.fillStyle = 'rgba(9,9,11,0.14)'; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = accent; ctx.font = '15px monospace';
          cols.forEach((d, i) => { ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * 16, d * 16); cols[i] = d * 16 > cv.height && Math.random() > 0.975 ? 0 : fading ? d + 0.2 : d + 1; });
          if (t > ms + 1500) { stop(); return; }
          raf = requestAnimationFrame(draw); return;
        }
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (!fading && ps.length < max && (fx === 'confetti' ? ps.length < max && Math.random() < 0.6 : Math.random() < 0.25)) ps.push(spawn());
        for (let i = ps.length - 1; i >= 0; i--) {
          const p = ps[i];
          p.w += 0.03; p.a += p.va; p.y += p.vy; p.x += p.vx + (fx === 'snow' || fx === 'leaves' || fx === 'lanterns' || fx === 'hearts' ? Math.sin(p.w) * 0.8 : 0);
          if (fx === 'confetti') p.vy = Math.min(p.vy + 0.02, 4.5);
          const out = p.y > cv.height + 20 || p.y < -30 || p.x < -30 || p.x > cv.width + 30;
          if (out) { ps.splice(i, 1); continue; }
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
          if (fx === 'stars') { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(p.w * 2)); ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.fill(); }
          else if (fx === 'snow') { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.fill(); }
          else if (fx === 'hearts') { ctx.globalAlpha = 0.8; ctx.scale(p.r / 10, p.r / 10); ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-10, -4, -4, -11, 0, -5); ctx.bezierCurveTo(4, -11, 10, -4, 0, 4); ctx.fill(); }
          else if (fx === 'lanterns') { ctx.globalAlpha = 0.75; ctx.shadowColor = p.c; ctx.shadowBlur = 14; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.7, p.r, 0, 0, 6.28); ctx.fill(); }
          else if (fx === 'leaves') { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, 6.28); ctx.fill(); }
          else if (fx === 'rain') { ctx.globalAlpha = 0.5; ctx.fillRect(0, 0, 1, 14); }
          else { ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); }
          ctx.restore();
        }
        if (fading && ps.length === 0) { stop(); return; }
        raf = requestAnimationFrame(draw);
      };
      const stop = () => { alive = false; cancelAnimationFrame(raf); ctx.clearRect(0, 0, cv.width, cv.height); if (run.current?.stop === stop) run.current = null; };
      run.current = { stop };
      raf = requestAnimationFrame(draw);
    };

    const on = (e: Event) => { const d = (e as CustomEvent).detail as { fx: FxName; ms?: number } | undefined; if (d?.fx) start(d.fx, d.ms ?? 6000); };
    window.addEventListener(FX_EVENT, on);
    return () => { window.removeEventListener(FX_EVENT, on); window.removeEventListener('resize', fit); run.current?.stop(); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55]" />;
}
