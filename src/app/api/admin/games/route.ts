import { admin } from '@/lib/admin/api';
import { readExt, writeExt } from '@/lib/admin/games';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => ({ games: await readExt() }));
export const PUT = admin(async ({ body }) => ({ games: await writeExt(body.games) }), true);
