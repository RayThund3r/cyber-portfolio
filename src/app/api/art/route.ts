import { NextResponse } from 'next/server';
import { listArt } from '@/server/art';
import { demoItems } from '@/server/artDemo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Public list of artwork (details only; each picture is fetched from /api/art/<id>).
export async function GET() {
  // Until the owner saves a first real piece, sample pieces are shown so the page never looks empty.
  try { const l = await listArt(); return NextResponse.json({ items: l.length ? l : demoItems(), demo: !l.length }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ items: demoItems(), demo: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } }); }
}
