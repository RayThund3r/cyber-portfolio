import { NextResponse } from 'next/server';
import { getRates } from '@/server/rates';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(await getRates(), { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } });
}
