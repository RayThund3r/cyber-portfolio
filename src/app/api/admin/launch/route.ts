import { admin } from '@/lib/admin/api';
import { adminEnv } from '@/lib/admin/auth';
import { storeConfigured } from '@/lib/admin/store';
import { missions, readiness } from '@/lib/admin/launch';
import { anyAvailable } from '@/server/llmProviders';
import { credentialState } from '@/server/auth';
import { getPayDetails } from '@/server/payDetails';
import { runLiveChecks } from '@/lib/admin/liveChecks';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async ({ req }) => {
  const e = adminEnv();
  let aiAvailable = false;
  try { aiAvailable = (await anyAvailable()).available; } catch { /* provider store unreachable */ }
  const cs = await credentialState().catch(() => null);
  const pay = await getPayDetails().catch(() => null);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const siteUrl = host && !/localhost|127\.0\.0\.1/.test(host) ? `https://${host}` : '';
  const ms = missions(process.env, {
    storeConfigured: storeConfigured(), aiAvailable, totp: !!e.totp || !!cs?.totpEnabled, passwordLen: e.password.length, secretLen: e.secret.length,
    passwordSaved: !!cs?.passwordSaved, payConfigured: !!(pay && (pay.mtnNumber || pay.airtelNumber)), siteUrl,
  });
  return { missions: ms, ...readiness(ms), at: Date.now() };
});

let lastProbe = 0;
// POST: run the live probes (read-only). One run per 8 seconds so the button cannot be used to hammer other services.
export const POST = admin(async ({ req }) => {
  const now = Date.now();
  if (now - lastProbe < 8000) return { checks: [], busy: true };
  lastProbe = now;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const env = { ...process.env, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || (host && !/localhost|127\.0\.0\.1/.test(host) ? `https://${host}` : '') };
  return { checks: await runLiveChecks(env), at: Date.now() };
}, true);
