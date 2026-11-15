// src/lib/visitorPlace.ts — where the visitor is, WITHOUT sending anything anywhere.
// Approximate place comes from the browser's own time zone and language ("Africa/Kampala" + "en-UG" → "Kampala, Uganda").
// Precise place is opt-in (the visitor taps GPS and the browser asks); it is rounded and never leaves the page.

/** "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function cityFromTimeZone(tz: string | undefined | null): string {
  if (!tz || tz === 'UTC' || tz === 'GMT' || tz.indexOf('/') < 0) return '';
  const last = tz.split('/').pop() || '';
  return last.replace(/_/g, ' ').trim();
}

/** "en-UG" → "UG" (2 letters) or ''. */
export function regionFromLocale(locale: string | undefined | null): string {
  const m = /[-_]([A-Za-z]{2})(?:$|[-_])/.exec(locale || '');
  return m ? m[1].toUpperCase() : '';
}

function countryName(region: string): string {
  if (!region) return '';
  try {
    const D = (Intl as any).DisplayNames;
    if (D) return new D(['en'], { type: 'region' }).of(region) || region;
  } catch { /* old browser */ }
  return region;
}

export function approxPlace(tz?: string | null, locale?: string | null): string {
  const city = cityFromTimeZone(tz);
  const country = countryName(regionFromLocale(locale));
  return [city, country].filter(Boolean).join(', ');
}

/** 0.3136, 32.5811 → "0.31°N 32.58°E" (about 1 km: enough to feel local, not enough to find a door). */
export function formatCoords(lat: number, lon: number): string {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  return `${f(lat, 'N', 'S')} ${f(lon, 'E', 'W')}`;
}
