// src/lib/builder/pricing.ts — market-reference pricing with live exchange rates (isomorphic).
//
// Template prices are stored as a USD "market reference" (what comparable premium HTML/Bootstrap templates
// typically sell for) and converted to UGX with the CURRENT exchange rate (fetched live by /api/rates, cached 1h).
// The owner can override with a fixed UGX price per template. Customers pay in UGX by mobile money.

export const CURRENCIES = [
  { code: 'UGX', symbol: 'UGX', round: 1000, label: 'Ugandan Shilling' },
  { code: 'USD', symbol: '$', round: 1, label: 'US Dollar' },
  { code: 'KES', symbol: 'KSh', round: 10, label: 'Kenyan Shilling' },
  { code: 'TZS', symbol: 'TSh', round: 1000, label: 'Tanzanian Shilling' },
  { code: 'RWF', symbol: 'RWF', round: 100, label: 'Rwandan Franc' },
  { code: 'NGN', symbol: '₦', round: 100, label: 'Nigerian Naira' },
  { code: 'ZAR', symbol: 'R', round: 5, label: 'South African Rand' },
  { code: 'EUR', symbol: '€', round: 1, label: 'Euro' },
  { code: 'GBP', symbol: '£', round: 1, label: 'British Pound' },
] as const;

export interface Rates {
  base: 'USD';
  /** units of each currency per 1 USD */
  rates: Record<string, number>;
  updatedAt: string;
  /** live = fetched just now · cached = last good fetch · fallback = built-in estimate (flag it in the UI) */
  source: 'live' | 'cached' | 'fallback';
}

export const FALLBACK_RATES: Rates = {
  base: 'USD', updatedAt: '2026-01-01T00:00:00.000Z', source: 'fallback',
  rates: { USD: 1, UGX: 3700, KES: 129, TZS: 2600, RWF: 1400, NGN: 1550, ZAR: 18, EUR: 0.92, GBP: 0.78 },
};

/** Sanity check so one bad API response can never make templates cost 1 shilling or 1 billion. */
export function plausible(rates: Record<string, number> | undefined): boolean {
  const u = rates?.UGX;
  return typeof u === 'number' && u > 1500 && u < 9000;
}

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/** What the customer is charged, in UGX (rounded to 1,000). null = not for sale. */
export function effectiveUGX(t: { priceUGX: number | null; priceUSD?: number | null }, ugxPerUsd: number): number | null {
  if (t.priceUGX !== null && t.priceUGX !== undefined) return t.priceUGX;
  if (t.priceUSD === null || t.priceUSD === undefined) return null;
  return t.priceUSD === 0 ? 0 : roundTo(t.priceUSD * ugxPerUsd, 1000);
}

export function convertFromUGX(amountUGX: number, code: string, r: Rates): number {
  const cur = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
  const ugx = r.rates.UGX || FALLBACK_RATES.rates.UGX;
  const per = r.rates[cur.code] ?? FALLBACK_RATES.rates[cur.code] ?? 1;
  return cur.code === 'UGX' ? amountUGX : amountUGX === 0 ? 0 : roundTo((amountUGX / ugx) * per, cur.round);
}

export function formatMoney(amountUGX: number | null, code: string, r: Rates): string {
  if (amountUGX === null) return 'Price coming soon';
  if (amountUGX === 0) return 'Free';
  const cur = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
  const v = convertFromUGX(amountUGX, cur.code, r);
  return `${cur.symbol}${cur.symbol.length > 1 ? ' ' : ''}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
