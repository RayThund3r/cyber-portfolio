// src/lib/events/useWorldEvents.ts — what the site should react to right now. Offline by default (the calendar is built in);
// the owner's settings (Admin → Events) are fetched once. `?event=<id>` previews any event (the owner's "Preview" button).
'use client';
import { useEffect, useState } from 'react';
import { eventById, type WorldEvent } from './calendar';
import { DEFAULT_EVENTS_CFG, eventsNow, sanitizeEventsCfg, type EventsConfig } from './config';

let cfgCache: EventsConfig | null = null;
let cfgAsked: Promise<EventsConfig> | null = null;
export function loadEventsCfg(): Promise<EventsConfig> {
  if (cfgCache) return Promise.resolve(cfgCache);
  if (typeof window === 'undefined') return Promise.resolve(DEFAULT_EVENTS_CFG);
  cfgAsked ||= fetch(`/api/events?_=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : DEFAULT_EVENTS_CFG)).then((d) => (cfgCache = sanitizeEventsCfg(d))).catch(() => DEFAULT_EVENTS_CFG);
  return cfgAsked;
}
export const cachedEventsCfg = (): EventsConfig => cfgCache || DEFAULT_EVENTS_CFG;

export function useWorldEvents(): { events: WorldEvent[]; fxOn: boolean; preview: boolean } {
  const [state, setState] = useState<{ events: WorldEvent[]; fxOn: boolean; preview: boolean }>({ events: [], fxOn: true, preview: false });
  useEffect(() => {
    let alive = true;
    const forced = (() => { try { return new URLSearchParams(window.location.search).get('event'); } catch { return null; } })();
    const pv = forced ? eventById(forced) : undefined;
    if (pv) { setState({ events: [pv], fxOn: true, preview: true }); return; }
    setState({ events: eventsNow(DEFAULT_EVENTS_CFG), fxOn: true, preview: false }); // instant, offline
    void loadEventsCfg().then((cfg) => { if (alive) setState({ events: eventsNow(cfg), fxOn: cfg.fx, preview: false }); });
    const again = () => { cfgCache = null; cfgAsked = null; void loadEventsCfg().then((cfg) => { if (alive) setState({ events: eventsNow(cfg), fxOn: cfg.fx, preview: false }); }); };
    window.addEventListener('site:updated', again); // owner changed Admin → Events
    return () => { alive = false; window.removeEventListener('site:updated', again); };
  }, []);
  return state;
}
