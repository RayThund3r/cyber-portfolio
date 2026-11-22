import { admin } from '@/lib/admin/api';
import { adminEnv } from '@/lib/admin/auth';
import { storeConfigured } from '@/lib/admin/store';
import { missions, readiness } from '@/lib/admin/launch';
import { anyAvailable } from '@/server/llmProviders';
import { runLiveChecks } from '@/lib/admin/liveChecks';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => {
  const e = adminEnv();
  let aiAvailable = false;
  try { aiAvailable = (await anyAvailable()).available; } catch { /* provider store unreachable */ }
  const ms = missions(process.env, { storeConfigured: storeConfigured(), aiAvailable, totp: !!e.totp, passwordLen: e.password.length, secretLen: e.secret.length });
  return { missions: ms, ...readiness(ms), at: Date.now() };
});

let lastProbe = 0;
// POST: run the live probes (read-only). One run per 8 seconds so the button cannot be used to hammer other services.
export const POST = admin(async () => {
  const now = Date.now();
  if (now - lastProbe < 8000) return { checks: [], busy: true };
  lastProbe = now;
  return { checks: await runLiveChecks(process.env), at: Date.now() };
}, true);
