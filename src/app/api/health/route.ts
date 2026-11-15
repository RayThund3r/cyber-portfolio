// src/app/api/health/route.ts — tiny "is the server alive?" probe used by the live status badge on the home page.
// No data, no cookies, never cached.
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store, max-age=0', 'Content-Type': 'application/json' };

export function GET() {
  return new Response(JSON.stringify({ ok: true, t: Date.now() }), { status: 200, headers });
}

export function HEAD() {
  return new Response(null, { status: 200, headers });
}
