// src/lib/admin/client.ts — browser-side helpers for the admin panel (fetch wrapper + a tiny data hook).
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method || 'GET';
  const res = await fetch(path, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(method !== 'GET' ? { 'x-admin': '1' } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error || `Request failed (${res.status})`);
  return data as T;
}

/** Loads `path` now and every `every` ms (pauses while the tab is hidden). */
export function useApi<T>(path: string | null, opts: { every?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(!!path);
  const alive = useRef(true);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const mine = ++seq.current;
    try {
      const d = await api<T>(path);
      if (alive.current && mine === seq.current) { setData(d); setError(''); }
    } catch (e) {
      if (!alive.current || mine !== seq.current) return;
      if (e instanceof ApiError && e.status === 401) window.dispatchEvent(new CustomEvent('admin:signed-out'));
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { if (alive.current && mine === seq.current) setLoading(false); }
  }, [path]);
  useEffect(() => { alive.current = true; setLoading(!!path); load(); return () => { alive.current = false; }; }, [load, path]);
  useEffect(() => {
    if (!opts.every || !path) return;
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, opts.every);
    return () => window.clearInterval(id);
  }, [opts.every, load, path]);
  return { data, error, loading, reload: load, setData };
}

export const fmtNum = (n: number) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : n.toLocaleString());
export function relTime(t: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  if (s < 86400 * 30) return Math.round(s / 86400) + ' d ago';
  return new Date(t).toLocaleDateString();
}
export const pct = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : null);
