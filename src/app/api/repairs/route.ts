import { NextResponse } from 'next/server';
import { listRepairs } from '@/server/repairs';
import { demoRepairs } from '@/server/repairsDemo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The public before / after list. Until the owner saves a first real job, sample jobs are shown so the section never looks empty.
export async function GET() {
  const h = { 'Cache-Control': 'no-store' };
  try { const l = (await listRepairs()).filter((r) => r.shown); return NextResponse.json({ items: l.length ? l : demoRepairs(), demo: !l.length }, { headers: h }); }
  catch { return NextResponse.json({ items: demoRepairs(), demo: true }, { headers: h }); }
}
