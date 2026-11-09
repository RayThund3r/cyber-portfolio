// GET /api/site-config — the public part of the settings (announcement bar + availability). Cached for a minute.
import { publicView, readConfig, DEFAULT_CONFIG } from '@/lib/admin/siteconfig';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  let view;
  try { view = publicView(await readConfig()); } catch { view = publicView(DEFAULT_CONFIG); }
  return new Response(JSON.stringify(view), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' } });
}
