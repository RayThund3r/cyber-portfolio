// src/components/builder/SiteViewer.tsx — read-only, fully interactive view of a site (the "viewer mode").
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSite } from '@/lib/builder/generate';
import type { SiteConfig } from '@/lib/builder/schema';

type Device = 'desktop' | 'tablet' | 'mobile';
const WIDTH: Record<Device, string> = { desktop: '100%', tablet: '820px', mobile: '390px' };
const btn = 'px-2.5 py-1.5 rounded border border-zinc-700 text-xs font-mono hover:border-zinc-500 cursor-pointer';

export default function SiteViewer({ config, assets = {}, title, subtitle, actions, onClose, fill = true }: {
  config: SiteConfig; assets?: Record<string, string>; title: string; subtitle?: string;
  actions?: React.ReactNode; onClose?: () => void; fill?: boolean;
}) {
  const [device, setDevice] = useState<Device>('desktop');
  const [toast, setToast] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => buildSite(config, { mode: 'view', assetSrc: (a) => assets[a] || '' }).html, [config, assets]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data || {};
      if (m.t === 'ext') setToast(`External link: ${String(m.u).slice(0, 80)} (opens on the real site)`);
      if (m.t === 'form') setToast('Form submitted — on the real site this sends your message.');
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className={`${fill ? 'h-dvh' : 'h-[80vh]'} flex flex-col bg-zinc-950 text-zinc-100`}>
      <header className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-zinc-800">
        {onClose && <button className={btn} onClick={onClose} aria-label="Close preview">✕</button>}
        <div className="min-w-0 mr-auto">
          <div className="text-sm font-semibold truncate">{title}</div>
          {subtitle && <div className="text-[11px] font-mono text-zinc-400 truncate">{subtitle}</div>}
        </div>
        <div className="hidden sm:flex gap-1" role="group" aria-label="Device size">
          {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
            <button key={d} className={`${btn} ${device === d ? 'border-cyan-500 text-cyan-300' : ''}`} aria-pressed={device === d} onClick={() => setDevice(d)}>{d === 'desktop' ? '🖥 Desktop' : d === 'tablet' ? '▭ Tablet' : '📱 Phone'}</button>
          ))}
        </div>
        {actions}
      </header>
      <div className="flex-1 min-h-0 bg-zinc-900 flex justify-center overflow-auto sm:p-4 relative">
        <div style={{ width: WIDTH[device], maxWidth: '100%' }} className="h-full bg-white sm:rounded-lg overflow-hidden shadow-2xl transition-[width] duration-300">
          {/* sandbox WITHOUT allow-same-origin: the previewed site can never touch this app, its cookies or storage */}
          <iframe ref={frame} title={`Preview of ${title}`} sandbox="allow-scripts" srcDoc={html} className="w-full h-full border-0 bg-white" />
        </div>
        {toast && <div role="status" className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-zinc-800 border border-zinc-600 text-xs shadow-lg">{toast}</div>}
      </div>
    </div>
  );
}
