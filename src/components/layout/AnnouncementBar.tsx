// src/components/layout/AnnouncementBar.tsx
//
// A slim notice above the site, controlled from the admin panel (Site → Announcement). It fetches /api/site-config once per
// session; if the endpoint is unreachable, the site simply shows nothing: it can never break a page.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';

export type BarLevel = 'info' | 'success' | 'warn' | 'alert';
export interface BarData { text: string; level: BarLevel; href: string; dismissible: boolean; id: string }

const LOOK: Record<BarLevel, string> = {
  info: 'border-accent/40 bg-accent/10 text-accent',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  alert: 'border-rose-500/50 bg-rose-500/10 text-rose-200',
};

export function Bar({ data, onDismiss }: { data: BarData; onDismiss?: () => void }) {
  const inner = (<><Icon name={data.level === 'success' ? 'check' : data.level === 'info' ? 'spark' : 'bell'} size={14} className="shrink-0" /><span className="min-w-0 flex-1 truncate sm:whitespace-normal">{data.text}</span>{data.href && <Icon name="arrow" size={13} className="shrink-0" />}</>);
  return (
    <div role="status" className={`flex items-center gap-2 border-b px-4 py-1.5 font-mono text-[11px] sm:text-xs ${LOOK[data.level]}`}>
      {data.href ? (data.href.startsWith('/') ? <Link href={data.href} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">{inner}</Link> : <a href={data.href} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2 hover:underline">{inner}</a>) : <div className="flex min-w-0 flex-1 items-center gap-2">{inner}</div>}
      {data.dismissible && onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss announcement" className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 opacity-70 hover:opacity-100">✕</button>}
    </div>
  );
}

export default function AnnouncementBar() {
  const [bar, setBar] = useState<BarData | null>(null);
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return;
    let off = false;
    fetch('/api/site-config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { announce?: BarData | null } | null) => {
        const a = d?.announce;
        if (off || !a || typeof a.text !== 'string') return;
        let dismissed = '';
        try { dismissed = sessionStorage.getItem('sys_bar_dismissed') || ''; } catch { /* ignore */ }
        if (a.dismissible && dismissed === a.id) return;
        setBar(a);
      })
      .catch(() => undefined);
    return () => { off = true; };
  }, []);
  if (!bar) return null;
  return <Bar data={bar} onDismiss={() => { try { sessionStorage.setItem('sys_bar_dismissed', bar.id); } catch { /* ignore */ } setBar(null); }} />;
}
