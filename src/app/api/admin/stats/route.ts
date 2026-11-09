import { admin } from '@/lib/admin/api';
import { readStats } from '@/lib/admin/stats';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async ({ url }) => readStats(Number(url.searchParams.get('days')) || 14));
