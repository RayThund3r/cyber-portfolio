// src/utils/analytics.ts — cookie-free, aggregate-only analytics + client error reporting.
'use client';

function dnt(): boolean {
  return typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || (navigator as any).globalPrivacyControl === true);
}

function send(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon?.('/api/ev', new Blob([body], { type: 'text/plain' }))) return;
    fetch('/api/ev', { method: 'POST', body, keepalive: true }).catch(() => {}); // offline / blocked: ignore (must not trigger our own error reporter)
  } catch { /* analytics must never break the site */ }
}

/** Page view. The referrer (or ?ref= / ?utm_source= when a link was shared on purpose) and screen width let the owner see where visitors come from. */
export const trackView = (path: string) => {
  if (dnt()) return;
  let r = '';
  try { const q = new URLSearchParams(location.search); r = q.get('ref') || q.get('utm_source') || document.referrer || ''; } catch { /* ignore */ }
  send({ t: 'view', p: path, r: r.slice(0, 200), w: typeof window !== 'undefined' ? window.innerWidth : 0 });
};
/** A question asked in the chat (the text is only used for the owner's "what do people ask?" list). */
export const trackChat = (q: string, src: string) => { if (!dnt() && q.trim().length >= 2) send({ t: 'chat', q: q.slice(0, 200), src: src.slice(0, 20) }); };
/** A finished game: res = w(in) | l(oss) | d(raw) | p(lay). */
export const trackGame = (id: string, res: 'w' | 'l' | 'd' | 'p') => { if (!dnt()) send({ t: 'game', id, res }); };
/** Page speed in ms (load event), one sample per view. */
export const trackPerf = (path: string, ms: number) => { if (!dnt()) send({ t: 'perf', p: path, ms: Math.round(ms) }); };
export const trackEvent = (n: string) => { if (!dnt()) send({ t: 'event', n }); };
/** Chat questions the assistant could not answer — shown to the owner in /admin (emails/numbers are scrubbed server-side). */
export const reportUnanswered = (q: string) => { if (!dnt() && q.trim().length >= 3) send({ t: 'unanswered', q }); };

let lastErr = '';
export function reportError(err: unknown, where: string) {
  const m = String((err as Error)?.message || err).slice(0, 300);
  if (m === lastErr) return; // avoid loops
  lastErr = m;
  send({ t: 'error', m, w: where });
}
