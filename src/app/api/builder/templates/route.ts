import { NextResponse } from 'next/server';
import { getTemplates } from '@/server/builderUtil';

export const runtime = 'nodejs';

export async function GET() {
  const items = (await getTemplates()).filter((t) => t.enabled);
  return NextResponse.json({ templates: items }, { headers: { 'Cache-Control': 'no-store' } });
}
