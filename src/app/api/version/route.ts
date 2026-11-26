// GET /api/version — the live-site version stamp (one tiny storage read). Open pages poll this and refresh when it changes.
import { getSiteVersion } from '@/server/liveVersion';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return new Response(JSON.stringify({ v: await getSiteVersion() }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store, max-age=0' } });
}
