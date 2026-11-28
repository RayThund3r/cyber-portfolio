// src/components/art/favs.ts: a visitor's favourite pieces, kept in their own browser (no account needed).
'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'art_favs';
const EVT = 'art:favs';
const read = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 200) : []; } catch { return []; }
};

export function useFavs() {
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setFavs(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* blocked storage: keep it for this visit only */ }
    setFavs(next);
    window.dispatchEvent(new Event(EVT));
  }, []);
  return { favs, toggle, has: (id: string) => favs.includes(id) };
}
