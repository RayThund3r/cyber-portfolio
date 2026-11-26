// src/lib/useNetStatus.ts — live connection status for the badge at the top of the home page.
//   online      → the browser is online AND our server answered
//   offline     → the browser has no connection
//   server-down → the browser is online but our server did not answer (down, deploying, or blocked)
//   checking    → first probe has not finished yet
'use client';

import { useEffect, useState } from 'react';

export type NetState = 'checking' | 'online' | 'offline' | 'server-down';
export type Ping = 'unknown' | 'ok' | 'fail';

/** Pure rule (unit-tested): what the visitor should be told, from the browser flag and the last server probe. */
export function deriveStatus(browserOnline: boolean, ping: Ping): NetState {
  if (!browserOnline) return 'offline';
  if (ping === 'unknown') return 'checking';
  return ping === 'ok' ? 'online' : 'server-down';
}

const OK_EVERY = 30_000;
const RETRY_EVERY = 8_000;
const TIMEOUT = 6_000;

async function probe(): Promise<boolean> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : 0;
  try {
    const r = await fetch(`/api/health?_=${Date.now()}`, { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
    return r.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function useNetStatus(): NetState {
  const [browserOnline, setBrowserOnline] = useState(true);
  const [ping, setPing] = useState<Ping>('unknown');

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (timer) clearTimeout(timer);
      const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
      if (alive) setBrowserOnline(online);
      let ok = false;
      if (online) ok = await probe();
      if (!alive) return;
      setPing(online ? (ok ? 'ok' : 'fail') : 'unknown');
      // no background-tab polling: when the tab is hidden the next check happens when it becomes visible again (onVisible below)
      timer = setTimeout(() => { if (document.visibilityState === 'visible') void run(); }, ok ? OK_EVERY : RETRY_EVERY);
    };
    const onNet = () => { void run(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void run(); };
    run();
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return deriveStatus(browserOnline, ping);
}
