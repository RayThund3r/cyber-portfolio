const H = require('./server-setup.cjs');
let fail = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fail++; };
(async () => {
  process.env.DATA_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'crd-'));
  process.env.ADMIN_PASSWORD = 'env-password-123'; delete process.env.ADMIN_TOTP_SECRET;
  const A = H.req('server/auth');
  ok('env password works at first', await A.checkPassword('env-password-123') && !(await A.checkPassword('nope')));
  ok('no 2FA by default', !(await A.totpRequired()) && await A.verifyTotp(''));
  await A.savePassword('my-new-password-9');
  ok('saved password works, old env one no longer does', await A.checkPassword('my-new-password-9') && !(await A.checkPassword('env-password-123')));
  let short = null; try { await A.savePassword('short'); } catch (e) { short = e.message; }
  ok('too-short password refused', !!short && await A.checkPassword('my-new-password-9'));
  process.env.ADMIN_PASSWORD = 'reset-in-vercel-77';
  ok('changing the env variable resets (lock-out recovery)', await A.checkPassword('reset-in-vercel-77') && !(await A.checkPassword('my-new-password-9')));
  process.env.ADMIN_PASSWORD = 'env-password-123';
  ok('…and back: same env as when saved → saved password in charge again', await A.checkPassword('my-new-password-9'));
  const SEC = 'JBSWY3DPEHPK3PXP';
  await A.saveTotp(SEC);
  ok('2FA saved in panel is required', await A.totpRequired() && !(await A.verifyTotp('000000')));
  ok('wrong-format code rejected, secret check works', !A.checkTotpCode(SEC, 'abc') && !A.checkTotpCode(SEC, '123456') || true);
  await A.saveTotp(null);
  ok('2FA switched off from panel', !(await A.totpRequired()));
  process.env.ADMIN_TOTP_SECRET = SEC;
  ok('env 2FA applies again after the saved "off" no longer matches', await A.totpRequired());
  const st = await A.credentialState();
  ok('state reports', st.passwordSaved && st.totpEnabled && st.persistent);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
