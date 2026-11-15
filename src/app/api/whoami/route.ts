// Tells a caller which IP address THIS server derived for them. Lets you verify TRUSTED_PROXY_HOPS in one command:
//   curl -H "X-Forwarded-For: 1.2.3.4" https://your-site/api/whoami     → must show your real address, not 1.2.3.4
import { NextResponse } from 'next/server';
import { clientIp } from '@/server/util';

export async function GET(req: Request) {
  return NextResponse.json({ ip: clientIp(req) }, { headers: { 'Cache-Control': 'no-store' } });
}
