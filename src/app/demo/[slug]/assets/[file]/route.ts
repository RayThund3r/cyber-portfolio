// src/app/demo/[slug]/assets/[file]/route.ts — pictures uploaded for a published demo.
import { demoAsset, loadStudio, SLUG_RE } from '@/server/studio';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await ctx.params;
  const p = SLUG_RE.test(slug) ? await loadStudio(slug) : null;
  const a = p && p.published ? demoAsset(p, file) : null;
  if (!a) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(a.body), { headers: { 'Content-Type': a.mime, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
}
