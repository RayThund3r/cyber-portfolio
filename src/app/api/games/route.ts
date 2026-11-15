// GET /api/games — the owner's extra web games for the /games page (public, read-only, cached briefly). Never throws.
import { readExt } from '@/lib/admin/games';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  let games: Array<Record<string, unknown>> = [];
  try { games = (await readExt()).filter((g) => !g.off).map(({ off, t, ...g }) => g); } catch { /* storage down: empty list */ }
  return new Response(JSON.stringify({ games }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=20, stale-while-revalidate=120' } });
}
