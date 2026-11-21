// /vendor/bootstrap/<file> — Bootstrap served from OUR OWN address, so the classic templates keep their layout even when a visitor's network
// blocks or slows the public CDNs (some mobile networks and browsers' shields do).
//
// • If you ran `node scripts/vendor-bootstrap.mjs`, the real files sit in public/vendor/bootstrap and Next serves them directly (this route is never reached).
// • Otherwise this route fetches Bootstrap once from a public CDN, checks it is genuine, keeps it in memory and serves it with long cache headers.
// • If every source fails it answers 502 (never cached) and the page's own fallbacks (jsDelivr → cdnjs) take over.
import { NextResponse } from 'next/server';
import { BS_VERSION } from '@/lib/builder/generate';

export const runtime = 'nodejs';

const FILES: Record<string, { type: string; urls: string[]; mark: RegExp; min: number }> = {
  'bootstrap.min.css': {
    type: 'text/css; charset=utf-8', mark: new RegExp(`Bootstrap\\s+v${BS_VERSION.replace(/\./g, '\\.')}`), min: 100_000,
    urls: [`https://cdn.jsdelivr.net/npm/bootstrap@${BS_VERSION}/dist/css/bootstrap.min.css`, `https://cdnjs.cloudflare.com/ajax/libs/bootstrap/${BS_VERSION}/css/bootstrap.min.css`, `https://unpkg.com/bootstrap@${BS_VERSION}/dist/css/bootstrap.min.css`],
  },
  'bootstrap.bundle.min.js': {
    type: 'application/javascript; charset=utf-8', mark: new RegExp(`Bootstrap\\s+v${BS_VERSION.replace(/\./g, '\\.')}`), min: 50_000,
    urls: [`https://cdn.jsdelivr.net/npm/bootstrap@${BS_VERSION}/dist/js/bootstrap.bundle.min.js`, `https://cdnjs.cloudflare.com/ajax/libs/bootstrap/${BS_VERSION}/js/bootstrap.bundle.min.js`, `https://unpkg.com/bootstrap@${BS_VERSION}/dist/js/bootstrap.bundle.min.js`],
  },
};
const cache = new Map<string, string>();

async function fetchGenuine(name: string): Promise<string | null> {
  const f = FILES[name];
  for (const u of f.urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (!r.ok) continue;
      const t = await r.text();
      if (t.length >= f.min && f.mark.test(t.slice(0, 400))) return t;
    } catch { /* try the next source */ }
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const f = FILES[file];
  if (!f) return new NextResponse('Not found', { status: 404 });
  let body = cache.get(file) ?? null;
  if (!body) { body = await fetchGenuine(file); if (body) cache.set(file, body); }
  if (!body) return new NextResponse('Bootstrap is temporarily unavailable.', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  return new NextResponse(body, { headers: { 'Content-Type': f.type, 'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400', 'X-Content-Type-Options': 'nosniff' } });
}
