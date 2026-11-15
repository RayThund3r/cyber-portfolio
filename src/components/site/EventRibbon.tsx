// src/components/site/EventRibbon.tsx — a slim, dismissible strip under the announcement bar when the world calendar (or the owner) has something to mark.
// Solemn days get a quiet strip and no effects. Dismissal is remembered for that event and day only.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useWorldEvents } from '@/lib/events/useWorldEvents';
import { triggerFx } from '@/lib/events/fx';

const dayKey = () => new Date().toISOString().slice(0, 10);
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export default function EventRibbon() {
  const { events, fxOn, preview } = useWorldEvents();
  const ev = events[0];
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!ev) return;
    const seen = !preview && store.get('sys_event_seen') === ev.id + ':' + dayKey();
    setHidden(seen);
    // Celebrate once per event per day (and always while previewing).
    if (!seen && fxOn && ev.tone === 'celebrate' && ev.fx !== 'none') {
      const t = window.setTimeout(() => triggerFx(ev.fx, 7000), 900);
      return () => window.clearTimeout(t);
    }
  }, [ev, fxOn, preview]);

  if (!ev || hidden) return null;
  const solemn = ev.tone === 'solemn';
  const close = () => { setHidden(true); store.set('sys_event_seen', ev.id + ':' + dayKey()); };
  return (
    <div role="status" className={`relative z-40 flex items-center justify-center gap-2 border-b px-10 py-1.5 text-center font-mono text-[11px] sm:text-xs ${solemn ? 'border-zinc-700 bg-zinc-900 text-zinc-300' : 'border-accent/30 bg-accent/10 text-accent'}`}>
      <Icon name={ev.icon} size={14} className="shrink-0" />
      <span className="min-w-0 truncate sm:whitespace-normal">{ev.ribbon}{preview ? ' (preview)' : ''}</span>
      {ev.href && <Link href={ev.href} className="shrink-0 underline underline-offset-2 hover:text-white">More</Link>}
      {!solemn && ev.fx !== 'none' && fxOn && <button type="button" onClick={() => triggerFx(ev.fx, 5000)} aria-label="Play the celebration again" className="shrink-0 cursor-pointer rounded p-1 hover:bg-accent/20"><Icon name="spark" size={13} /></button>}
      <button type="button" onClick={close} aria-label="Dismiss" className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer rounded p-2 hover:bg-white/10"><Icon name="close" size={13} /></button>
    </div>
  );
}
