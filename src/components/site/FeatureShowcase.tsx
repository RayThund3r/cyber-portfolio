// src/components/site/FeatureShowcase.tsx — "more than a portfolio" previews on the home page: games, templates, AI assistant, request tracking.
// Every preview is decorative and cheap: nothing runs until it scrolls into view, and reduced-motion visitors get a still picture.
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Icon, { type IconName } from '@/components/ui/Icon';
import { openChat } from '@/lib/chatBus';
import { newDemo, stepDemo, type DemoState } from '@/lib/snakeDemo';

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

function reduced(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/* ───────────── games: a snake that plays itself ───────────── */
function SnakePreview() {
  const [wrap, seen] = useInView<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const accent = (css.getPropertyValue('--color-accent') || '#22d3ee').trim() || '#22d3ee';
    let s: DemoState = newDemo();
    const cell = 18;
    c.width = s.w * cell; c.height = s.h * cell;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = 'rgba(113,113,122,.10)';
      for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath(); ctx.arc(s.food[0] * cell + cell / 2, s.food[1] * cell + cell / 2, cell * 0.32, 0, Math.PI * 2); ctx.fill();
      s.snake.forEach(([x, y], i) => {
        ctx.globalAlpha = Math.max(0.35, 1 - i * 0.045);
        ctx.fillStyle = accent;
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      });
      ctx.globalAlpha = 1;
    };
    draw();
    if (!seen || reduced()) return;
    const t = setInterval(() => { s = stepDemo(s); draw(); }, 140);
    return () => clearInterval(t);
  }, [seen]);

  return (
    <div ref={wrap} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <canvas ref={canvas} className="block h-auto w-full" aria-hidden="true" />
    </div>
  );
}

/* ───────────── templates: a mini website being "built" ───────────── */
function TemplatePreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950" aria-hidden="true">
      <div className="flex items-center gap-1 border-b border-zinc-800 px-2 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400/70" /><span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" /><span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 h-2 flex-1 rounded bg-zinc-800" />
      </div>
      <div className="space-y-2 p-3">
        <div className="h-14 rounded bg-gradient-to-r from-accent/40 to-fuchsia-500/30" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-zinc-800/80" style={{ animationDelay: `${i * 180}ms` }} />)}
        </div>
        <div className="h-2 w-3/4 rounded bg-zinc-800" /><div className="h-2 w-1/2 rounded bg-zinc-800" />
        <div className="inline-block rounded bg-accent-strong px-3 py-1 font-mono text-[9px] font-semibold text-black">BUY &amp; DOWNLOAD</div>
      </div>
    </div>
  );
}

/* ───────────── AI: a looping chat ───────────── */
const SCRIPT: Array<{ me: boolean; text: string }> = [
  { me: true, text: 'my phone screen cracked' },
  { me: false, text: 'Ouch. Screens are one of our most common fixes. Want a price range or to book a drop-off?' },
  { me: true, text: 'take me to the games' },
  { me: false, text: 'Opening Games. Try Tetris. Dare you.' },
];
function ChatPreview() {
  const [wrap, seen] = useInView<HTMLDivElement>();
  const [n, setN] = useState(SCRIPT.length);
  useEffect(() => {
    if (!seen || reduced()) { setN(SCRIPT.length); return; }
    setN(0);
    let i = 0;
    const t = setInterval(() => { i = i >= SCRIPT.length + 2 ? 0 : i + 1; setN(Math.min(i, SCRIPT.length)); }, 1500);
    return () => clearInterval(t);
  }, [seen]);
  return (
    <div ref={wrap} className="min-h-[154px] space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px]" aria-hidden="true">
      {SCRIPT.slice(0, n).map((m, i) => (
        <div key={i} className={`max-w-[88%] rounded-lg px-2.5 py-1.5 leading-snug ${m.me ? 'ml-auto bg-accent/90 text-black' : 'bg-zinc-800 text-zinc-200'}`}>{m.text}</div>
      ))}
      {n < SCRIPT.length && <div className="flex gap-1 pl-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:240ms]" /></div>}
    </div>
  );
}

/* ───────────── tracking: progress steps ───────────── */
function TrackPreview() {
  const steps = ['Received', 'Diagnosing', 'Repairing', 'Ready'];
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3" aria-hidden="true">
      <div className="mb-3 font-mono text-[10px] text-zinc-500">REF: <span className="text-accent">SYS-2F9K</span></div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2 text-[11px]">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${i < 2 ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : i === 2 ? 'border-accent text-accent' : 'border-zinc-700 text-zinc-700'}`}>
              {i < 2 ? <Icon name="check" size={10} /> : i === 2 ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> : null}
            </span>
            <span className={i <= 2 ? 'text-zinc-200' : 'text-zinc-600'}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface Card { id: string; icon: IconName; tag: string; title: string; text: string; preview: React.ReactNode; cta: React.ReactNode }

export default function FeatureShowcase() {
  const cards: Card[] = [
    {
      id: 'games', icon: 'gamepad', tag: 'ARCADE', title: 'Games for the brain',
      text: 'Chess, Tetris, 2048, Sudoku and more, with real AI opponents, guides and a buddy that trash-talks kindly.',
      preview: <SnakePreview />,
      cta: <Link href="/games" className="hit inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline">PLAY_NOW <Icon name="arrow" size={13} /></Link>,
    },
    {
      id: 'templates', icon: 'layout', tag: 'TEMPLATES', title: 'Website templates',
      text: 'Pick a design, edit it live, pay by mobile money and download the finished site as a zip.',
      preview: <TemplatePreview />,
      cta: <Link href="/builder" className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline">BROWSE_DESIGNS <Icon name="arrow" size={13} /></Link>,
    },
    {
      id: 'ai', icon: 'chat', tag: 'ASSISTANT', title: 'Ask the assistant',
      text: 'It answers, books visits, navigates the site and runs on your device. Nothing is sent to a paid AI.',
      preview: <ChatPreview />,
      cta: <button type="button" onClick={() => openChat()} className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline">START_CHAT <Icon name="arrow" size={13} /></button>,
    },
    {
      id: 'track', icon: 'search', tag: 'TRACKING', title: 'Track your repair',
      text: 'Every request gets a reference. Check progress, payment and pickup status any time.',
      preview: <TrackPreview />,
      cta: <Link href="/track" className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline">TRACK_REQUEST <Icon name="arrow" size={13} /></Link>,
    },
  ];
  return (
    <section id="more" className="mx-auto max-w-7xl scroll-mt-20 border-t border-zinc-900 px-4 py-12 sm:px-8">
      <div className="mb-8" data-reveal>
        <span className="font-mono text-[10px] uppercase tracking-wider text-accent sm:text-xs">EXTRA_MODULES // MORE THAN A PORTFOLIO</span>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-100 sm:text-3xl">Things to try while you are here</h2>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <article key={c.id} data-reveal className="cy-card group flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl">
            <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
              <span className="flex items-center gap-1.5 text-accent"><Icon name={c.icon} size={14} />{c.tag}</span>
            </div>
            {c.preview}
            <h3 className="text-base font-bold text-zinc-100 transition-colors group-hover:text-accent">{c.title}</h3>
            <p className="flex-1 text-xs leading-relaxed text-zinc-400">{c.text}</p>
            <div className="pt-1">{c.cta}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
