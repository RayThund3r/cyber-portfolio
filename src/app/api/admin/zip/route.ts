// Admin-only: download any customer's site as a .zip (e.g. to deliver manually or fix something for them).
import { NextResponse } from 'next/server';
import { ipAllowed, isAdmin } from '@/server/auth';
import { buildProjectZip, loadProject } from '@/server/projects';
import { clean } from '@/server/util';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!ipAllowed(req) || !(await isAdmin())) return new NextResponse('Not found', { status: 404 });
  const p = await loadProject(clean(new URL(req.url).searchParams.get('id'), 12).toUpperCase());
  if (!p) return new NextResponse('Not found', { status: 404 });
  const zip = await buildProjectZip(p.order?.snapshot ?? p.config, p);
  const name = (p.config.brand.name || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
  return new NextResponse(new Uint8Array(zip), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${name}.zip"`, 'Cache-Control': 'no-store' } });
}
