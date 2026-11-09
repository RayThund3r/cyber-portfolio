// A living radar of the site: every visit, chat question and finished game sends a ring across the screen.
'use client';
import { useEffect, useRef } from 'react';
import type { LiveEvent } from '@/lib/admin/track';

const COLOR: Record<string, string> = { pv: '#22d3ee', chat: '#a78bfa', gap: '#fbbf24', game: '#34d399' };
interface Ring { x: number; y: number; born: number; color: string; r: number }

export default function Pulse({ events, demo }: { events: LiveEvent[]; demo: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rings = useRef<Ring[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const queue = useRef<LiveEvent[]>([]);

  useEffect(() => {
    const fresh = events.filter((e) => { const k = `${e.t}:${e.k}:${e.p || e.x || ''}`; if (seen.current.has(k)) return false; seen.current.add(k); return true; });
    if (seen.current.size > 500) seen.current = new Set([...seen.current].slice(-200));
    // first load: show the last few as a quick welcome sweep instead of dumping everything at once
    queue.current.push(...fresh.reverse().slice(-25));
  }, [events]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, last = 0, sweep = 0, spawnAt = 0;
    const fit = () => { const r = c.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = r.width * dpr; c.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(c);
    const spawn = (k: string) => { const r = c.getBoundingClientRect(); const ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * Math.min(r.width, r.height) * 0.42; rings.current.push({ x: r.width / 2 + Math.cos(ang) * d, y: r.height / 2 + Math.sin(ang) * d, born: performance.now(), color: COLOR[k] || '#22d3ee', r: 0 }); };
    const frame = (now: number) => {
      const r = c.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2, R = Math.min(cx, cy) * 0.92;
      ctx.clearRect(0, 0, r.width, r.height);
      ctx.strokeStyle = 'rgba(113,113,122,0.25)'; ctx.lineWidth = 1;
      for (const k of [0.25, 0.5, 0.75, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      if (!reduce) { sweep += (now - (last || now)) * 0.0011; const g = ctx.createConicGradient ? ctx.createConicGradient(sweep, cx, cy) : null; if (g) { g.addColorStop(0, 'rgba(34,211,238,0.22)'); g.addColorStop(0.12, 'rgba(34,211,238,0)'); g.addColorStop(1, 'rgba(34,211,238,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); } }
      last = now;
      if (queue.current.length && now > spawnAt) { spawn(queue.current.shift()!.k); spawnAt = now + 260; }
      else if (demo && now > spawnAt + 900) { spawn(['pv', 'pv', 'chat', 'game', 'gap'][(Math.random() * 5) | 0]); spawnAt = now + 700 + Math.random() * 700; }
      rings.current = rings.current.filter((g) => now - g.born < 3200);
      for (const g of rings.current) { const t = (now - g.born) / 3200; ctx.globalAlpha = 1 - t; ctx.strokeStyle = g.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, 3 + t * 46, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = g.color; ctx.beginPath(); ctx.arc(g.x, g.y, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [demo]);
  return <canvas ref={ref} className="block aspect-square w-full max-w-md" role="img" aria-label="Live activity radar: each ring is a visit, chat question or game" />;
}
