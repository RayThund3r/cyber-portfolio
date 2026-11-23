// src/lib/safeText.ts — tiny shared validators (isomorphic).
/** A link we are willing to store: an on-site /path (never //other-site or backslash tricks) or https://. */
export function safeLink(v: unknown, max = 600): string {
  const s = String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
  if (/^\/(?![\/\\])[^\s\\]*$/.test(s) || /^https:\/\/[^\s"'<>\\]+$/i.test(s)) return s;
  return '';
}
