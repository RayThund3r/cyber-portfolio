// src/components/site/VisitorNode.tsx — "NODE: <where you are>". Approximate from the browser's own time zone; precise only if the visitor taps GPS.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { approxPlace, formatCoords } from '@/lib/visitorPlace';
import { SITE } from '@/utils/chatEngine/siteConfig';

export function useVisitorPlace() {
  const [approx, setApprox] = useState('');
  const [coords, setCoords] = useState('');
  const [time, setTime] = useState('');
  const [gps, setGps] = useState<'idle' | 'asking' | 'denied' | 'unavailable'>('idle');
  const [canGps, setCanGps] = useState(false);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setApprox(approxPlace(tz, navigator.language));
    } catch { /* leave empty: the owner's base shows instead */ }
    setCanGps(typeof navigator !== 'undefined' && 'geolocation' in navigator);
    const tick = () => { try { setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); } catch { /* ignore */ } };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const askGps = useCallback(() => {
    if (!('geolocation' in navigator)) { setGps('unavailable'); return; }
    setGps('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords(formatCoords(p.coords.latitude, p.coords.longitude)); setGps('idle'); },
      (e) => setGps(e && e.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: 10_000 },
    );
  }, []);

  return { approx, coords, time, gps, canGps, askGps };
}

/** Short label for the home ticker. */
export function NodeInline() {
  const v = useVisitorPlace();
  const where = v.coords || v.approx || SITE.location.split(',')[0];
  return <span title="Your approximate location, taken from your browser's time zone. It is not sent anywhere.">NODE: {where.toUpperCase()}{v.time ? ` · ${v.time}` : ''}</span>;
}

/** Footer block. */
export function NodeFooter() {
  const v = useVisitorPlace();
  const where = v.coords || v.approx;
  return (
    <div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-zinc-600 sm:justify-start">
        <Icon name="pin" size={11} className="text-accent/70" />
        <span title="Taken from your browser's time zone. It is not sent anywhere.">NODE: {where || SITE.location}{v.time ? ` · ${v.time}` : ''}</span>
        {v.canGps && !v.coords && (
          <button type="button" onClick={v.askGps} disabled={v.gps === 'asking'} className="hit rounded border border-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500 transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-60">
            {v.gps === 'asking' ? 'LOCATING…' : v.gps === 'denied' ? 'GPS_BLOCKED' : v.gps === 'unavailable' ? 'GPS_UNAVAILABLE' : 'USE_GPS'}
          </button>
        )}
      </div>
      {where && <div className="mt-0.5 text-[10px] text-zinc-700">WORKSHOP: {SITE.location}</div>}
    </div>
  );
}
