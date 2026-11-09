import { admin } from '@/lib/admin/api';
import { envChecklist, storeCheck } from '@/lib/admin/health';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => ({
  env: envChecklist(),
  store: await storeCheck(),
  runtime: {
    node: process.version, region: process.env.VERCEL_REGION || '', vercelEnv: process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7), branch: process.env.VERCEL_GIT_COMMIT_REF || '', commitMsg: (process.env.VERCEL_GIT_COMMIT_MESSAGE || '').slice(0, 100),
  },
  at: Date.now(),
}));
