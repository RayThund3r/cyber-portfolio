// src/app/demo/[slug]/route.ts — the public live demo of a published Studio site.
import { DEMO_CSP, loadStudio, renderDemo, SLUG_RE } from '@/server/studio';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const p = SLUG_RE.test(slug) ? await loadStudio(slug) : null;
  if (!p || !p.published) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(renderDemo(p), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      'X-Robots-Tag': 'noindex, nofollow', // a demo of a client's site, not a second copy of it for search engines
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': DEMO_CSP,
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}
