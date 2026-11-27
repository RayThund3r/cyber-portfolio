import { getArtImage, cleanId } from '@/server/art';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// One picture. `?t=1` gives the small thumbnail. The page adds `&v=<version>` so a changed picture gets a new URL,
// which lets browsers keep each version for a year.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const img = await getArtImage(cleanId(id), new URL(req.url).searchParams.get('t') === '1').catch(() => null);
  if (!img) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(img.bytes), { headers: { 'Content-Type': img.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}
