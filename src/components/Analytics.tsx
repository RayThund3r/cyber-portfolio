// src/components/Analytics.tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackView, trackEvent, trackPerf, reportError } from '@/utils/analytics';

export default function Analytics() {
  const pathname = usePathname() || '';

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    trackView(pathname);
    // one page-speed sample per view, a few seconds in so the load event has fired
    const t = window.setTimeout(() => {
      try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (nav && nav.loadEventEnd > 0) trackPerf(pathname, nav.loadEventEnd);
      } catch { /* ignore */ }
    }, 4000);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.error || e.message, 'window.onerror');
    const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason, 'unhandledrejection');
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="https://wa.me/"]');
      if (a) trackEvent('whatsapp_click');
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return null;
}
