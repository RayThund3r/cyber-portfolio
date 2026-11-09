// src/components/Turnstile.tsx — optional Cloudflare bot check. Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
'use client';

import { useEffect, useRef } from 'react';

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void } } }
const KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const turnstileEnabled = !!KEY;

export default function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!KEY || !ref.current) return;
    let id: string | undefined;
    const mount = () => {
      if (!window.turnstile || !ref.current) return;
      id = window.turnstile.render(ref.current, { sitekey: KEY, theme: 'dark', callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') });
    };
    if (window.turnstile) mount();
    else {
      let s = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      if (!s) {
        s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.dataset.turnstile = '1';
        document.head.appendChild(s);
      }
      s.addEventListener('load', mount);
    }
    return () => { if (id && window.turnstile) window.turnstile.remove(id); };
  }, [onToken]);

  return KEY ? <div ref={ref} className="min-h-[65px]" /> : null;
}
