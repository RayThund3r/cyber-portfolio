import { admin } from '@/lib/admin/api';
import { readConfig, writeConfig } from '@/lib/admin/siteconfig';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => ({ config: await readConfig() }));
export const PUT = admin(async ({ body }) => ({ config: await writeConfig(body.config) }), true);
