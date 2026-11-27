import { NextResponse } from 'next/server';
import { listArt } from '@/server/art';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Public list of artwork (details only; each picture is fetched from /api/art/<id>).
export async function GET() {
  try { return NextResponse.json({ items: await listArt() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ items: [] }, { status: 200, headers: { 'Cache-Control': 'no-store' } }); }
}
