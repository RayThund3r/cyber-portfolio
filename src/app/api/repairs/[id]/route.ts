import { cleanId } from '@/server/art';
import { getRepairImage } from '@/server/repairs';
import { demoRepairSvg } from '@/server/repairsDemo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// One picture of a job: ?s=before or ?s=after (the page adds &v=<version> so a changed picture gets a new URL).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const side = new URL(req.url).searchParams.get('s') === 'before' ? 'before' : 'after';
  const svg = demoRepairSvg(cleanId(id), side);
  if (svg) return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
  const img = await getRepairImage(cleanId(id), side).catch(() => null);
  if (!img) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(img.bytes), { headers: { 'Content-Type': img.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}
