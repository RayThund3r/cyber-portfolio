import { admin, fail } from '@/lib/admin/api';
import { adminEnv, clientInfo } from '@/lib/admin/auth';
import { audit as myAudit } from '@/lib/admin/auth';
import { db, getStore } from '@/lib/admin/store';
import { newTotpSecret, otpauthUri, verifyTotp } from '@/lib/admin/totp';
import { logoutEverywhere, readAudit, checkPassword, verifyTotp as verifyLoginCode, checkTotpCode, savePassword, saveTotp, regenRecoveryCodes, credentialState, createSession, noteFailure, lockedOut } from '@/server/auth';
import { notify } from '@/lib/admin/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The sign-in log lives in the owner login (server/auth.ts); this tool shows it in the same shape as before. */
export const GET = admin(async ({ session }) => {
  const log = await readAudit();
  const cs = await credentialState();
  return {
    creds: cs,
    expiresAt: session.exp * 1000,
    audit: log.slice(0, 100).map((a) => ({ t: Date.parse(a.at) || 0, kind: a.event, ok: a.ok, who: a.ip, ua: a.ua })),
    totpEnabled: cs.totpEnabled, passwordLength: adminEnv().password.length, separateSecret: adminEnv().secret.length >= 16,
    allowList: !!process.env.ADMIN_ALLOWED_IPS,
    notes: await db.list('adm:audit', 20),
  };
});
export const POST = admin(async ({ body, req }) => {
  const who = await clientInfo(req);
  /** Every credential change needs the CURRENT password (and current 2FA code if 2FA is on), so a stolen session alone can't take over. */
  const proveYou = async () => {
    if (lockedOut()) return false;
    const ok = (await checkPassword(String(body.current || ''))) && (await verifyLoginCode(String(body.currentCode || '')));
    if (!ok) { noteFailure(); await new Promise((r) => setTimeout(r, 700)); await myAudit({ kind: 'creds-change', ok: false, who: who.ipHash, note: 'wrong current password/code' }); return false; }
    return true;
  };
  const WRONG = 'Your current password or code is wrong.';
  switch (body.action) {
    case 'password-change': {
      const next = String(body.next || '');
      if (next.length < 10) return fail(400, 'Use at least 10 characters (12+ is better).');
      if (!(await proveYou())) return fail(403, WRONG);
      try { await savePassword(next); } catch (e) { return fail(400, e instanceof Error ? e.message : 'Could not save.'); }
      await createSession(); // keep this device signed in; every other device is signed out
      await myAudit({ kind: 'password-changed', ok: true, who: who.ipHash });
      await notify('Your admin password was changed from the panel.');
      return { ok: true };
    }
    case 'totp-enable': {
      const secret = String(body.secret || '').replace(/\s+/g, '').toUpperCase();
      if (!/^[A-Z2-7]{16,64}$/.test(secret)) return fail(400, 'That secret does not look right.');
      if (!checkTotpCode(secret, String(body.code || ''))) return fail(400, 'That 6-digit code is not right. Check the app and try again; nothing was changed.');
      if (!(await proveYou())) return fail(403, WRONG);
      let codes: string[]; try { codes = await saveTotp(secret); } catch (e) { return fail(400, e instanceof Error ? e.message : 'Could not save.'); }
      await createSession();
      await myAudit({ kind: 'totp-enabled', ok: true, who: who.ipHash });
      await notify('Two-factor sign-in was turned on / rotated from the admin panel.');
      return { ok: true, recoveryCodes: codes };
    }
    case 'recovery-new': {
      if (!(await proveYou())) return fail(403, WRONG);
      try { const codes = await regenRecoveryCodes(); await myAudit({ kind: 'recovery-codes-new', ok: true, who: who.ipHash }); return { ok: true, recoveryCodes: codes }; } catch (e) { return fail(400, e instanceof Error ? e.message : 'Could not save.'); }
    }
    case 'totp-disable': {
      if (!(await proveYou())) return fail(403, WRONG);
      try { await saveTotp(null); } catch (e) { return fail(400, e instanceof Error ? e.message : 'Could not save.'); }
      await createSession();
      await myAudit({ kind: 'totp-disabled', ok: true, who: who.ipHash });
      await notify('Two-factor sign-in was turned OFF from the admin panel.');
      return { ok: true };
    }
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
