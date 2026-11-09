import { admin } from '@/lib/admin/api';
import { adminEnv } from '@/lib/admin/auth';
import { getStore } from '@/lib/admin/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async ({ session }) => ({ ok: true, sid: session.sid.slice(0, 6), exp: session.exp * 1000, store: getStore().mode, totp: !!adminEnv().totp }));
