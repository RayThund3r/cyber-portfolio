// src/server/rates.ts — live USD→local exchange rates (free, no key), cached for an hour, with safe fallbacks.
import 'server-only';
import { readJson, update } from './store';
import { CURRENCIES, FALLBACK_RATES, plausible, type Rates } from '@/lib/builder/pricing';

let mem: { at: number; r: Rates } | null = null;
const TTL = 60 * 60_000;
const RETRY = 5 * 60_000; // when the live source is down, try again after 5 minutes

export async function getRates(): Promise<Rates> {
  const now = Date.now();
  if (mem && now - mem.at < TTL) return mem.r;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    const j: any = await res.json();
    if (j?.result === 'success' && plausible(j.rates)) {
      const rates: Record<string, number> = { USD: 1 };
      for (const c of CURRENCIES) if (typeof j.rates[c.code] === 'number' && j.rates[c.code] > 0) rates[c.code] = j.rates[c.code];
      const r: Rates = { base: 'USD', rates, updatedAt: new Date((j.time_last_update_unix || now / 1000) * 1000).toISOString(), source: 'live' };
      mem = { at: now, r };
      void update<Rates | null>('rates', null, () => r).catch(() => {});
      return r;
    }
  } catch { /* fall through to cached / fallback */ }
  const saved = await readJson<Rates | null>('rates', null);
  const r: Rates = saved && plausible(saved.rates) ? { ...saved, source: 'cached' } : FALLBACK_RATES;
  mem = { at: now - TTL + RETRY, r };
  return r;
}
