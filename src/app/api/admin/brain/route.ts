import { admin } from '@/lib/admin/api';
import { readBrain, writeBrain } from '@/lib/admin/brain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => ({ entries: await readBrain() }));
export const PUT = admin(async ({ body }) => ({ entries: await writeBrain(body.entries) }), true);
