// GET /api/events — the owner's world-events settings for the public site (read-only, cached briefly). Never throws.
import { readEventsCfg } from '@/lib/admin/events';
import { DEFAULT_EVENTS_CFG } from '@/lib/events/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  let cfg = DEFAULT_EVENTS_CFG;
  try { cfg = await readEventsCfg(); } catch { /* storage down: defaults */ }
  return new Response(JSON.stringify(cfg), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=30, stale-while-revalidate=300' } });
}
