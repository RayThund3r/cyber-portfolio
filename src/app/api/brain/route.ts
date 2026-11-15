// GET /api/brain — the owner-taught answers (public, read-only, cached briefly). Never throws: no storage = empty list.
import { readBrain } from '@/lib/admin/brain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  let items: Array<{ id: string; q: string[]; a: string; l?: string }> = [];
  try { items = (await readBrain()).filter((e) => !e.off).map((e) => ({ id: e.id, q: e.q, a: e.a, l: e.link })); } catch { /* storage down */ }
  return new Response(JSON.stringify({ items }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=20, stale-while-revalidate=120' } });
}
