import { admin, fail } from '@/lib/admin/api';
import { adminEnv, clientInfo } from '@/lib/admin/auth';
import { audit as myAudit } from '@/lib/admin/auth';
import { db, getStore } from '@/lib/admin/store';
import { newTotpSecret, otpauthUri, verifyTotp } from '@/lib/admin/totp';
import { logoutEverywhere, readAudit } from '@/server/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The sign-in log lives in the owner login (server/auth.ts); this tool shows it in the same shape as before. */
export const GET = admin(async ({ session }) => {
  const log = await readAudit();
  return {
    expiresAt: session.exp * 1000,
    audit: log.slice(0, 100).map((a) => ({ t: Date.parse(a.at) || 0, kind: a.event, ok: a.ok, who: a.ip, ua: a.ua })),
    totpEnabled: !!adminEnv().totp, passwordLength: adminEnv().password.length, separateSecret: adminEnv().secret.length >= 16,
    allowList: !!process.env.ADMIN_ALLOWED_IPS,
    notes: await db.list('adm:audit', 20),
  };
});
export const POST = admin(async ({ body, req }) => {
  const who = await clientInfo(req);
  switch (body.action) {
    case 'signout-all': await logoutEverywhere(); await myAudit({ kind: 'signout-all', ok: true, who: who.ipHash }); return { ok: true };
    case 'totp-new': { const secret = newTotpSecret(); return { secret, uri: otpauthUri(secret, 'admin') }; }
    case 'totp-test': {
      const secret = typeof body.secret === 'string' ? body.secret : adminEnv().totp;
      if (!secret || !/^[A-Z2-7 ]{16,64}$/i.test(secret)) return fail(400, 'That secret does not look right.');
      const step = await verifyTotp(secret.replace(/\s+/g, ''), String(body.code || ''));
      return { valid: step !== null };
    }
    case 'clear-audit': await getStore().cmd('DEL', 'adm:audit'); return { ok: true };
    default: return fail(400, 'Unknown action.');
  }
}, true);
