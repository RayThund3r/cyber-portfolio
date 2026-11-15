// Pro-site order → payment → download, plus zip contents. Run after: node tests/build-server.mjs
process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.example'; // the address the downloaded sites will send their orders to
const H = require('./server-setup.cjs'); const { ok } = H; const { execFileSync } = require('child_process'); const fs = require('fs'), path = require('path'), os = require('os');
const route = H.req('app/api/site/route'), { cloudToken, cloudVerifier } = H.req('lib/builder/sha256');
const ownerList = async (id, pass) => route.POST(new Request('http://x/api/site', { method: 'POST', headers: { 'x-forwarded-for': '7.7.7.' + Math.floor(Math.random() * 250) }, body: JSON.stringify({ id, action: 'owner.list', token: cloudToken(id, pass) }) }));
const data2cloud = (z) => { const d = JSON.parse(z.read('site-data.json')); return !!(d.cloud && d.cloud.id); };
const P = H.req('server/projects'), S = H.req('server/store'), { hashPass } = H.req('lib/builder/sha256'), { ownerPasscode } = H.req('lib/builder/pro');
global.fetch = async (u) => { if (String(u).includes('er-api')) return { ok: true, json: async () => ({ result: 'success', time_last_update_unix: 1760000000, rates: { UGX: 3700, KES: 129, USD: 1 } }) }; throw new Error('net'); };
const unzip = (buf) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'z-')), f = path.join(d, 'a.zip'); fs.writeFileSync(f, buf); execFileSync('unzip', ['-q', f, '-d', path.join(d, 'x')]); const list = []; const walk = (p, rel = '') => fs.readdirSync(p).forEach((n) => { const q = path.join(p, n); fs.statSync(q).isDirectory() ? walk(q, rel + n + '/') : list.push(rel + n); }); walk(path.join(d, 'x')); return { list: list.sort(), read: (n) => fs.readFileSync(path.join(d, 'x', n), 'utf8') }; };
const pay = (ticket, tx) => S.mutateTicket(ticket, (t) => { t.payments.push({ id: tx, network: 'MTN', txId: tx, status: 'CONFIRMED', at: new Date().toISOString() }); });
(async () => {
  const r = await P.createProject('pro-bakery'); const { id, key } = r; let p = await P.authProject(id, key);
  ok('Pro template creates a Pro project', p.config.kind === 'pro' && p.config.pro.setup.mode === 'shop' && p.config.pro.catalog.products.length === 5);
  ok('price = $69 × live rate (3,700), rounded to 1,000 UGX', (await P.priceNow('pro-bakery')) === 255000);
  const cfg = JSON.parse(JSON.stringify(p.config)); cfg.pro.business.name = 'Test Bakery'; cfg.pro.business.wa = '0700123456';
  ok('save works for Pro', !!(await P.saveProject(id, key, { config: cfg })).rev);
  const o = await P.placeOrder(id, key, { name: 'Ann', email: 'a@b.co', phone: '0700000000' }); ok('order placed', !!o.ticket);
  ok('download blocked until payment confirmed', (await P.downloadFor(await P.authProject(id, key))).status === 402);
  await pay(o.ticket, 'TX123456');
  const zip = await P.downloadFor(await P.authProject(id, key)); ok('download works after payment', Buffer.isBuffer(zip));
  const z = unzip(zip);
  ok('Pro zip has exactly the engine files + data + readme + generated passcode', JSON.stringify(z.list) === JSON.stringify(['ADMIN-PASSCODE.txt', 'README.txt', 'css/app.css', 'index.html', 'js/app.js', 'js/core.js', 'site-data.json']), z.list.join(','));
  const data = JSON.parse(z.read('site-data.json')); const pass = ownerPasscode(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret', id);
  ok('passcode file contains the generated passcode', z.read('ADMIN-PASSCODE.txt').includes(pass));
  ok('baked admin hash == hash of that passcode (admin login will work)', data.adm.h === hashPass(cfg.pro.key, pass));
  ok('exported data is not in preview mode (no demo passcode, remote data fetch enabled)', data.preview === false && data.adm.h !== hashPass(cfg.pro.key, 'demo'));
  ok('same passcode on every download (stable)', unzip(await P.downloadFor(await P.authProject(id, key))).read('ADMIN-PASSCODE.txt').includes(pass));
  ok('no editor/preview leakage in exported HTML', !/data-sec|"preview":true|\bdemo\b/.test(z.read('index.html')) && z.read('index.html').includes('Test Bakery'));
  // ── cloud inbox registration ──
  ok('download registers the site and bakes in the cloud address', data.cloud && data.cloud.u === 'https://platform.example' && data.cloud.id === cfg.pro.key && /CLOUD INBOX/.test(z.read('README.txt')));
  ok("the generated passcode IS the key to the shop's cloud inbox (and a wrong one is not)", (await ownerList(cfg.pro.key, pass)).status === 200 && (await ownerList(cfg.pro.key, 'wrong-guess')).status === 401);
  const c2 = await P.createProject('pro-salon'); const p2 = await P.authProject(c2.id, c2.key); const cfg2 = JSON.parse(JSON.stringify(p2.config)); cfg2.pro.owner.adminHash = hashPass(cfg2.pro.key, 'my-own-passcode'); cfg2.pro.owner.cloudVerifier = cloudVerifier(cloudToken(cfg2.pro.key, 'my-own-passcode')); await P.saveProject(c2.id, c2.key, { config: cfg2 });
  const o2 = await P.placeOrder(c2.id, c2.key, { name: 'Bo', email: '', phone: '0700000001' }); await pay(o2.ticket, 'TX999999');
  const z2 = unzip(await P.downloadFor(await P.authProject(c2.id, c2.key))); ok("customer's own passcode used; no ADMIN-PASSCODE.txt", !z2.list.includes('ADMIN-PASSCODE.txt') && JSON.parse(z2.read('site-data.json')).adm.h === hashPass(cfg2.pro.key, 'my-own-passcode'));
  ok("customer's own passcode (set in the builder with its cloud verifier) opens THEIR cloud inbox", data2cloud(z2) && (await ownerList(cfg2.pro.key, 'my-own-passcode')).status === 200 && (await ownerList(cfg2.pro.key, pass)).status === 401);
  ok('booking template exports with booking mode', JSON.parse(z2.read('site-data.json')).mode === 'book');
  const c3 = await P.createProject('business'); const o3 = await P.placeOrder(c3.id, c3.key, { name: 'Cy', email: '', phone: '0700000002' }); await pay(o3.ticket, 'TX777777');
  ok('classic zip unchanged (index, css, js, README)', JSON.stringify(unzip(await P.downloadFor(await P.authProject(c3.id, c3.key))).list) === JSON.stringify(['README.txt', 'css/style.css', 'index.html', 'js/script.js']));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64').toString('base64');
  const c4 = await P.createProject('pro-boutique'); const up = await P.addAsset(c4.id, c4.key, 'image/png', png); const p4 = await P.authProject(c4.id, c4.key); const cfg4 = JSON.parse(JSON.stringify(p4.config)); cfg4.pro.catalog.products[0].images = [{ u: 'asset:' + up.id }]; cfg4.pro.business.logo = 'asset:' + up.id; await P.saveProject(c4.id, c4.key, { config: cfg4 });
  const o4 = await P.placeOrder(c4.id, c4.key, { name: 'Di', email: '', phone: '0700000003' }); await pay(o4.ticket, 'TX555555');
  const z4 = unzip(await P.downloadFor(await P.authProject(c4.id, c4.key))); const d4 = JSON.parse(z4.read('site-data.json'));
  ok('uploaded picture bundled and referenced relatively (product + logo)', z4.list.includes(`assets/img-${up.id}.png`) && d4.cat.products[0].images[0] === `assets/img-${up.id}.png` && d4.b.logo === `assets/img-${up.id}.png`);
  // legacy passcode (hash only, no cloud verifier) and a shop that switched the cloud inbox off: both still export fine, without cloud
  const c5 = await P.createProject('pro-clinic'); const p5 = await P.authProject(c5.id, c5.key); const cfg5 = JSON.parse(JSON.stringify(p5.config)); cfg5.pro.owner.adminHash = hashPass(cfg5.pro.key, 'legacy-passcode-1'); await P.saveProject(c5.id, c5.key, { config: cfg5 });
  const o5 = await P.placeOrder(c5.id, c5.key, { name: 'Ed', email: '', phone: '0700000004' }); await pay(o5.ticket, 'TX444444'); const z5 = unzip(await P.downloadFor(await P.authProject(c5.id, c5.key)));
  ok('passcode set before the cloud existed (no verifier) → site works, no cloud, README does not promise it', !('cloud' in JSON.parse(z5.read('site-data.json'))) && !/CLOUD INBOX/.test(z5.read('README.txt')));
  const c6 = await P.createProject('pro-events'); const p6 = await P.authProject(c6.id, c6.key); const cfg6 = JSON.parse(JSON.stringify(p6.config)); cfg6.pro.features.cloud = false; await P.saveProject(c6.id, c6.key, { config: cfg6 });
  const o6 = await P.placeOrder(c6.id, c6.key, { name: 'Fay', email: '', phone: '0700000005' }); await pay(o6.ticket, 'TX333333'); const z6 = unzip(await P.downloadFor(await P.authProject(c6.id, c6.key)));
  ok('shop that switched the cloud inbox OFF → no cloud in the site and nothing registered', !('cloud' in JSON.parse(z6.read('site-data.json'))) && (await require(require('path').join(__dirname, '.build-server/server/cloud.js')).getSite(cfg6.pro.key)) === null);
  // re-downloading must not disturb the registration
  const again = unzip(await P.downloadFor(await P.authProject(id, key))); ok('re-download is idempotent: same cloud id, key still opens the inbox', JSON.parse(again.read('site-data.json')).cloud.id === cfg.pro.key && (await ownerList(cfg.pro.key, pass)).status === 200);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
