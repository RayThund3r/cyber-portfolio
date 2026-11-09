// A short "digital rain" overlay (Konami code easter egg). Respects reduced-motion by showing a still frame.
'use client';
import { useEffect, useRef } from 'react';

export default function MatrixRain({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) { onDone(); return; }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const size = 16;
    const fit = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    fit(); window.addEventListener('resize', fit);
    const cols = () => Math.ceil(c.width / size);
    let drops = Array.from({ length: cols() }, () => Math.random() * -40);
    const glyphs = 'アイウエオカキクケコサシスセソ0123456789ABCDEFﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ'.split('');
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22d3ee';
    let raf = 0; const t0 = performance.now();
    const frame = (now: number) => {
      ctx.fillStyle = 'rgba(9,9,11,0.12)'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = `${size}px monospace`;
      if (drops.length !== cols()) drops = Array.from({ length: cols() }, () => Math.random() * -40);
      drops.forEach((y, i) => { ctx.fillStyle = Math.random() > 0.96 ? '#fff' : accent; ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, y * size); drops[i] = y * size > c.height && Math.random() > 0.975 ? 0 : y + 1; });
      if (now - t0 < (reduce ? 200 : 6500)) raf = requestAnimationFrame(frame); else onDone();
    };
    raf = requestAnimationFrame(frame);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', esc);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); window.removeEventListener('keydown', esc); };
  }, [onDone]);
  return <canvas ref={ref} className="pointer-events-auto fixed inset-0 z-[60] cursor-pointer" aria-hidden onClick={onDone} />;
}
