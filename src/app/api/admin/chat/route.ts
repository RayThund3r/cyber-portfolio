import { admin } from '@/lib/admin/api';
import { db } from '@/lib/admin/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
interface Q { t: number; q: string; src: string; gap: boolean }
export const GET = admin(async () => ({ questions: await db.list<Q>('s:q', 500) }));
