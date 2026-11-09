import { admin } from '@/lib/admin/api';
import { deskSummary } from '@/lib/admin/desk';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async ({ url }) => deskSummary(Number(url.searchParams.get('limit')) || 10));
