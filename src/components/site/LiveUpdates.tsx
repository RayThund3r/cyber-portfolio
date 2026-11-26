// src/components/site/LiveUpdates.tsx
//
// Makes owner edits show up without anybody pressing reload. The page remembers the site version it was built with; it asks /api/version
// whenever it could be stale and, if the version moved on, refreshes its data in place (router.refresh) and tells client-side widgets
// (announcement bar, events, games…) to refetch. Checks run when: the page opens, the tab becomes visible again, Safari restores a page
// from its back/forward cache ("pageshow" — the usual reason iPhones show old content), the window regains focus, the network returns,
// and every 20 s while the page is visible. Nothing runs in a hidden tab, and no check is made more often than every 4 s.
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export const SITE_UPDATED_EVENT = 'site:updated';

export default function LiveUpdates({ version }: { version: string }) {
  const router = useRouter();
  const known = useRef(version);
  const busy = useRef(false);
  const lastAt = useRef(0);
  useEffect(() => { known.current = version; }, [version]); // a refresh delivered a newer layout

  useEffect(() => {
    let alive = true;
    const check = async (force = false) => {
      if (!alive || busy.current || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (!force && now - lastAt.current < 4000) return;
      lastAt.current = now; busy.current = true;
      try {
        const r = await fetch(`/api/version?_=${now}`, { cache: 'no-store', credentials: 'same-origin' });
        if (!r.ok) return;
        const d = (await r.json()) as { v?: string };
        if (!alive || !d.v || d.v === '0') return;
        if (d.v !== known.current) {
          known.current = d.v;
          router.refresh();
          window.dispatchEvent(new Event(SITE_UPDATED_EVENT));
        }
      } catch { /* offline: try again later */ } finally { busy.current = false; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(true); };
    const onShow = (e: PageTransitionEvent) => { void check(!!e.persisted); };
    const onFocus = () => { void check(); };
    const onOnline = () => { void check(true); };
    void check(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onShow);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    const id = window.setInterval(() => { void check(); }, 20_000);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.clearInterval(id);
    };
  }, [router]);

  return null;
}
