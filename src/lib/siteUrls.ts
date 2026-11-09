// src/lib/siteUrls.ts
//
// One place that knows how page state is encoded in URLs. The chat builds these URLs, the pages
// read them — so "show branding projects" is just a link (shareable, back-button friendly).
//
//   /portfolio?cat=BRANDING&q=figma&open=03     filter, search text, open project popup
//   /contact?type=repair                        pre-select the repair form

import { CATEGORIES, Category } from './siteMap';

export function parseCategory(v: string | null | undefined): Category | 'ALL' {
  return v && (CATEGORIES as readonly string[]).includes(v) ? (v as Category) : 'ALL';
}

export function parseContactType(v: string | null | undefined): 'design' | 'repair' | null {
  return v === 'design' || v === 'repair' ? v : null;
}

export function portfolioUrl(opts: { category?: string; query?: string; open?: string } = {}): string {
  const p = new URLSearchParams();
  const cat = parseCategory(opts.category);
  if (cat !== 'ALL') p.set('cat', cat);
  if (opts.query && opts.query.trim()) p.set('q', opts.query.trim().slice(0, 60));
  if (opts.open) p.set('open', opts.open);
  const s = p.toString();
  return s ? `/portfolio?${s}` : '/portfolio';
}

/** `withNonce` adds a throw-away `k` so repeating the same chat command re-applies it. */
export function contactUrl(kind?: 'design' | 'repair', withNonce = false): string {
  const p = new URLSearchParams();
  if (kind) p.set('type', kind);
  // Only the chat passes withNonce (computed at click time). Links rendered in pages must be stable,
  // otherwise server and client HTML differ and React reports a hydration mismatch.
  if (withNonce) p.set('k', Date.now().toString(36));
  const s = p.toString();
  return s ? `/contact?${s}` : '/contact';
}
