const H = require('./server-setup.cjs');
let fail = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fail++; };
(async () => {
  process.env.DATA_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'live-'));
  const L = H.req('server/liveVersion');
  const v0 = await L.getSiteVersion();
  ok('fresh site has the placeholder version', v0 === '0');
  const v1 = await L.bumpSiteVersion(); const v2 = await L.bumpSiteVersion();
  ok('each bump gives a new version that getSiteVersion returns', v1 !== v2 && (await L.getSiteVersion()) === v2);
  await L.publishChange('/guides');
  ok('publishChange bumps even outside a request (revalidate failure is harmless)', (await L.getSiteVersion()) !== v2);
  const A = H.req('lib/admin/api');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
