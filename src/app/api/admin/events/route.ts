import { admin } from '@/lib/admin/api';
import { readEventsCfg, writeEventsCfg } from '@/lib/admin/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => ({ cfg: await readEventsCfg() }));
export const PUT = admin(async ({ body }) => ({ cfg: await writeEventsCfg(body.cfg) }), true);
