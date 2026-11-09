import { NextResponse } from 'next/server';
import { getSlots, bookingWindow } from '@/server/booking';
import { clientIp, rateLimit } from '@/server/util';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (rateLimit(`slots:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const date = new URL(req.url).searchParams.get('date');
  if (!date) return NextResponse.json(bookingWindow(), { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(await getSlots(date), { headers: { 'Cache-Control': 'no-store' } });
}
