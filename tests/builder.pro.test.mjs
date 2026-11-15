// Pro-site pipeline tests: editor settings → sanitize → generate → run in the engine. Run: node tests/build-lib.mjs && node tests/builder.pro.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const B = (n) => require('./.build/' + n + '.js'); const { makeEnv } = require('./dom.js'); const Core = require('../engine/core.js');
const { sanitizeConfig } = B('sanitize'), { buildSite } = B('generate'), { defaultConfig } = B('schema'), P = B('pro'), { sha256, hashPass } = B('sha256'), { applyOps } = B('ops'), { readinessWarnings } = B('readiness');
const queue = []; const t = (n, f) => queue.push([n, f]); const R = (n) => Math.floor(Math.random() * n);
const mkPro = (mode = 'shop', patch) => { const c = defaultConfig(); c.kind = 'pro'; c.pro = P.defaultPro(mode); if (patch) patch(c.pro); return sanitizeConfig(c); };
const site = (cfg, mode = 'view') => { const h = buildSite(cfg, { mode, assetSrc: (i) => 'assets/img-' + i + '.jpg' }).html; return JSON.parse(h.match(/<script type="application\/json" id="site-data">([\s\S]*?)<\/script>/)[1]); };

t('TypeScript SHA-256 == engine SHA-256 == Node crypto (3,000 random inputs); hashPass parity', () => {
  for (let i = 0; i < 3000; i++) { const s = i % 2 ? crypto.randomBytes(R(150)).toString('latin1') : String.fromCodePoint(...Array.from({ length: R(30) }, () => 32 + R(0x2fff))); const n = crypto.createHash('sha256').update(s, 'utf8').digest('hex'); assert.equal(sha256(s), n); assert.equal(Core.sha256(s), n); }
  assert.equal(hashPass('k1', 'pw'), Core.hashPass('k1', 'pw'));
});
t('defaultPro survives sanitize unchanged (idempotent) for every mode', () => { for (const m of ['shop', 'book', 'quote', 'none']) { const c = mkPro(m); assert.equal(JSON.stringify(sanitizeConfig(c)), JSON.stringify(c)); assert.equal(c.kind, 'pro'); assert.match(c.pro.key, /^[a-z0-9]{8}$/); } });
t('classic sites are untouched: no kind/pro keys, identical output path', () => { const c = sanitizeConfig(defaultConfig()); assert.ok(!('kind' in c) && !('pro' in c)); const out = buildSite(c, { mode: 'export', assetSrc: (i) => i }); assert.ok(out.html.includes('bootstrap') && out.files.some((f) => f.name === 'js/script.js')); });
t('export file set, embedded data == site-data.json, no editor/preview markers', () => {
  const out = buildSite(mkPro(), { mode: 'export', assetSrc: (i) => 'assets/img-' + i + '.jpg' }); const names = out.files.map((f) => f.name).sort();
  assert.deepEqual(names, ['css/app.css', 'index.html', 'js/app.js', 'js/core.js', 'site-data.json']);
  const emb = JSON.parse(out.html.match(/id="site-data">([\s\S]*?)<\/script>/)[1]), file = JSON.parse(out.files.find((f) => f.name === 'site-data.json').text); assert.deepEqual(emb, file);
  assert.ok(out.html.includes('src="js/core.js"') && out.html.includes('href="css/app.css"') && !out.html.includes('FRAME') && !/preview":true/.test(out.html)); assert.ok(out.html.includes('application/ld+json') && out.html.includes('<noscript>'));
});
t('compile mapping: closed days, deposits, section order/hiding, asset URLs, endpoint https-only, owner hash rules', () => {
  const c = mkPro('book', (p) => { p.booking.closed0 = false; p.booking.closed3 = true; p.booking.deposit = 'Cut=20000'; p.setup.order = [{ id: 'faq', show: true }, { id: 'about', show: false }, { id: 'book', show: true }]; p.hero.slides[0].u = 'asset:abcd1234'; p.contact.endpoint = 'http://insecure.example'; p.owner.adminHash = 'a'.repeat(64); });
  const s = site(c, 'export'); assert.deepEqual(s.bk.closed, [3]); assert.equal(s.bk.deposit, 'Cut=20000'); assert.deepEqual(s.sec, ['hero', 'faq', 'book']); assert.equal(s.hero.slides[0].u, 'assets/img-abcd1234.jpg'); assert.equal(s.ep, ''); assert.equal(s.adm.h, 'a'.repeat(64));
  assert.equal(site(c, 'preview').adm.h, hashPass(c.pro.key, 'demo'), 'preview/demo uses the known demo passcode'); assert.equal(site(c, 'view').preview, true);
  const o = buildSite(c, { mode: 'export', assetSrc: (i) => i, adminHash: 'b'.repeat(64) }); assert.equal(JSON.parse(o.files.find((f) => f.name === 'site-data.json').text).adm.h, 'a'.repeat(64), 'customer passcode beats a generated one');
  const noOwn = mkPro('shop'); assert.equal(JSON.parse(buildSite(noOwn, { mode: 'export', assetSrc: (i) => i, adminHash: 'c'.repeat(64) }).files.find((f) => f.name === 'site-data.json').text).adm.h, 'c'.repeat(64), 'generated passcode used when the customer set none');
  const ok = mkPro('shop', (p) => { p.contact.endpoint = 'https://formspree.io/f/x'; }); assert.equal(site(ok, 'export').ep, 'https://formspree.io/f/x');
});
t('CLOUD in the compiled site: only in the finished download, only when enabled AND the server gave an address; never in previews', () => {
  const c = mkPro('shop'); const exp = (cfg, o = {}) => JSON.parse(buildSite(cfg, { mode: 'export', assetSrc: (i) => i, ...o }).files.find((f) => f.name === 'site-data.json').text);
  assert.deepEqual(exp(c, { cloudUrl: 'https://platform.example' }).cloud, { u: 'https://platform.example', id: c.pro.key });
  assert.ok(!('cloud' in exp(c)), 'no server address → no cloud'); assert.ok(!('cloud' in exp(mkPro('shop', (p) => { p.features.cloud = false; }), { cloudUrl: 'https://platform.example' })), 'owner switched it off');
  for (const m of ['preview', 'view']) assert.ok(!('cloud' in JSON.parse(buildSite(c, { mode: m, assetSrc: (i) => i, cloudUrl: 'https://platform.example' }).html.match(/id="site-data">([\s\S]*?)<\/script>/)[1])), m + ': previews never carry the cloud address');
});
t('passcode companion: cloudVerifier accepts ONLY a sha256 hex string; matches the engine + server formula', () => {
  const { cloudToken, cloudVerifier } = B('sha256'); assert.equal(cloudToken('k1', 'pw'), Core.cloudToken('k1', 'pw')); assert.equal(cloudVerifier(cloudToken('k1', 'pw')), Core.cloudVerifier(Core.cloudToken('k1', 'pw')));
  for (const bad of ['plain', 'A'.repeat(64), 5, null, 'f'.repeat(63)]) assert.equal(mkPro('shop', (p) => { p.owner.cloudVerifier = bad; }).pro.owner.cloudVerifier, ''); assert.equal(mkPro('shop', (p) => { p.owner.cloudVerifier = 'e'.repeat(64); }).pro.owner.cloudVerifier, 'e'.repeat(64));
  const f = P.PRO_GROUPS.find((g) => g.id === 'owner').fields; assert.ok(f.find((x) => x.key === 'cloudVerifier').hidden && f.find((x) => x.key === 'adminHash').companion === 'cloudVerifier');
});
t('ownerPasscode: stable per project, 10 chars, differs per project/secret; sanitize accepts ONLY a sha256 hash', () => {
  assert.equal(P.ownerPasscode('s', 'PRJ-AAAAAA'), P.ownerPasscode('s', 'PRJ-AAAAAA')); assert.notEqual(P.ownerPasscode('s', 'PRJ-AAAAAA'), P.ownerPasscode('s', 'PRJ-BBBBBB')); assert.notEqual(P.ownerPasscode('s', 'PRJ-AAAAAA'), P.ownerPasscode('t', 'PRJ-AAAAAA')); assert.match(P.ownerPasscode('s', 'x'), /^[A-HJ-NP-Z2-9]{10}$/);
  for (const bad of ['plaintext', 'A'.repeat(64), 'g'.repeat(64), 123, null, 'a'.repeat(63)]) assert.equal(mkPro('shop', (p) => { p.owner.adminHash = bad; }).pro.owner.adminHash, ''); assert.equal(mkPro('shop', (p) => { p.owner.adminHash = 'f'.repeat(64); }).pro.owner.adminHash, 'f'.repeat(64));
});
t('INJECTION: hostile text in every Pro field cannot escape the JSON script or the HTML', () => {
  const X = '</script><img src=x onerror=alert(1)><!--\u2028\u2029"\'&';
  const c = mkPro('shop', (p) => { for (const g of ['business', 'about', 'services', 'catalog', 'gallery', 'reviews', 'faq', 'contact', 'seo', 'booking']) for (const k of Object.keys(p[g])) if (typeof p[g][k] === 'string' && !/^(mtn|airtel|link|endpoint)$/.test(k)) p[g][k] = X; p.catalog.products = [{ name: X, category: X, price: 1, stock: 1, description: X, images: [{ u: 'javascript:alert(1)' }, { u: 'https://ok.com/a.png' }] }]; p.seo.favicon = X; });
  for (const m of ['preview', 'view', 'export']) {
    const h = buildSite(c, { mode: m, assetSrc: (i) => i }).html; const json = h.match(/id="site-data">([\s\S]*?)<\/script>/)[1]; assert.ok(!json.includes('</') && !json.includes('<!--') && !/[\u2028\u2029]/.test(json), m + ': data blob is inert'); const parsed = JSON.parse(json);
    assert.ok(parsed.b.name.includes('</script>'), 'data round-trips exactly'); const scripts = h.split('<script').length - 1; const body = h.split('<body>')[1].replace(/<script[\s\S]*?<\/script>/g, ''); assert.ok(!/<img src=x/.test(body) && !/<img src=x/.test(h.split('<head>')[1].split('</head>')[0]), m + ': no raw injected tag');
    const ld = h.match(/application\/ld\+json">([\s\S]*?)<\/script>/)[1]; assert.ok(!ld.includes('</'), 'ld+json inert'); assert.ok(scripts <= 8);
  }
});
t('GENERATED SITE RUNS IN THE ENGINE: render, order, admin login with the baked-in passcode', async () => {
  const c = mkPro('shop', (p) => { p.business.name = 'Mama Pima'; p.business.wa = '0700123456'; p.catalog.mtn = '0770111222'; p.catalog.products = [{ name: 'Bread', category: 'Bakery', price: 4000, stock: 5, description: 'Soft', images: [{ u: 'https://x.com/a.jpg' }] }, { name: 'Cake', category: 'Cakes', price: 50000, stock: 2, description: '', images: [] }]; p.owner.adminHash = hashPass(p.key, 'my-secret-pass'); });
  const e = makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>'); const msgs = []; e.sb.parent = { postMessage: (m) => msgs.push(m) };
  const { files } = buildSite(c, { mode: 'export', assetSrc: (i) => i }); e.doc.getElementById('site-data').textContent = files.find((f) => f.name === 'site-data.json').text;
  vm.runInContext(files.find((f) => f.name === 'js/core.js').text, e.ctx); vm.runInContext(files.find((f) => f.name === 'js/app.js').text, e.ctx); // the REAL exported scripts, not the source files
  assert.ok(e.$('.logo').textContent.includes('Mama Pima')); assert.equal(e.$$('#grid .pc').length, 2); e.click(e.$('.pc[data-id=p1] [data-act=add]')); e.click(e.$('[data-act=cart]')); e.type(e.$('#ck_name'), 'Ann'); e.type(e.$('#ck_phone'), '0700555666'); e.click(e.$('[data-act=place]'));
  const o = JSON.parse(e.localStorage.getItem('se_' + c.pro.key + '_db')).orders[0]; assert.equal(o.total, 4000); assert.ok(e.$$('.ov').pop().textContent.includes('0770111222'));
  e.loc.hash = '#admin'; e.type(e.$('#pw'), 'wrong'); e.click(e.$('[data-act=login]')); assert.ok(e.$('#pw')); e.type(e.$('#pw'), 'my-secret-pass'); e.click(e.$('[data-act=login]')); assert.ok(!e.$('#pw') && e.$('.kp'), 'owner passcode set in the builder opens the admin');
  assert.equal(e.errors.length, 0, e.errors.join('|'));
});
t('book & quote & none modes render their own sections only', () => {
  for (const [m, has, not] of [['book', 'book', ['catalog', 'quote']], ['quote', 'quote', ['catalog', 'book']], ['none', null, ['catalog', 'book', 'quote']], ['shop', 'catalog', ['book', 'quote']]]) {
    const c = mkPro(m); const e = makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>'); e.doc.getElementById('site-data').textContent = JSON.stringify(site(c, 'view')); e.sb.parent = { postMessage() {} }; e.load('core.js'); e.load('app.js');
    if (has) assert.ok(e.doc.getElementById(has), m + ' shows ' + has); for (const n of not) assert.ok(!e.doc.getElementById(n), m + ' hides ' + n); assert.equal(e.errors.length, 0);
  }
});
t('AI ops on Pro: setPro merges, string pictures normalised, owner passcode untouchable, classic rejects setPro', () => {
  const c = mkPro('shop'); const r = applyOps(c, [{ op: 'setPro', group: 'business', values: { name: 'Pima', wa: '0700111222', evil: 1 } }, { op: 'setPro', group: 'catalog', values: { products: [{ name: 'Tea', price: '2500', stock: 3, images: ['https://x.com/t.jpg', { u: 'https://x.com/u.jpg' }] }] } },
    { op: 'setPro', group: 'owner', values: { adminHash: 'f'.repeat(64) } }, { op: 'setPro', group: 'nope', values: {} }, { op: 'setSection', id: 'x', values: {} }]);
  assert.equal(r.config.pro.business.name, 'Pima'); assert.equal(r.config.pro.catalog.products[0].price, 2500); assert.deepEqual(r.config.pro.catalog.products[0].images.map((x) => x.u), ['https://x.com/t.jpg', 'https://x.com/u.jpg']); assert.equal(r.config.pro.owner.adminHash, '', 'AI cannot set the passcode'); assert.ok(r.skipped.length >= 2);
  assert.ok(applyOps(sanitizeConfig(defaultConfig()), [{ op: 'setPro', group: 'business', values: { name: 'x' } }]).skipped[0].includes('not a Pro site'));
});
t('readiness warnings catch the common Pro mistakes', () => {
  const w = readinessWarnings(mkPro('shop', (p) => { p.catalog.products = []; p.catalog.cash = false; })); assert.ok(w.some((x) => /placeholder/.test(x)) && w.some((x) => /no products/.test(x)) && w.some((x) => /payment method/.test(x)) && w.some((x) => /WhatsApp/.test(x)));
  assert.equal(readinessWarnings(mkPro('shop', (p) => { p.business.name = 'Real Co'; p.business.wa = '0700123456'; })).filter((x) => /placeholder|WhatsApp|payment|no products/.test(x)).length, 0);
});
t('ALL 20 TEMPLATES: valid categories, stable under sanitize, build in every mode; Pro ones boot in the engine without errors', () => {
  const { PRESETS } = B('templates'), { CATEGORIES } = B('schema'); const cats = new Set(CATEGORIES.map((c) => c.id)); assert.equal(PRESETS.length, 20);
  for (const p of PRESETS) {
    assert.ok(cats.has(p.category), p.id + ' category'); const cfg = sanitizeConfig(p.config); assert.equal(JSON.stringify(cfg), JSON.stringify(p.config), p.id + ' unstable under sanitize (a field was silently altered)');
    for (const m of ['preview', 'view', 'export']) buildSite(cfg, { mode: m, assetSrc: (i) => i });
    if (cfg.kind === 'pro') { const e = makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>'); e.doc.getElementById('site-data').textContent = JSON.stringify(site(cfg, 'view')); e.sb.parent = { postMessage() {} }; e.load('core.js'); e.load('app.js'); assert.equal(e.errors.length, 0, p.id); assert.ok(e.$$('.slide').length >= 1 && e.$$('section').length >= 4, p.id + ' renders'); }
  }
});
t('FUZZ 3,000 random Pro configs: sanitize never throws & is idempotent, all 3 builds succeed and stay valid', () => {
  const junk = ['</script>', '"\'', null, undefined, 1e99, -5, NaN, [], {}, '\u0000', 'x'.repeat(4000), true, 'asset:zzzzzzzz', 'https://ok.com/a.png', 'javascript:alert(1)', { __proto__: { a: 1 } }, [1, 2, 3], '2026-01-01'];
  const mutate = (o) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (Math.random() < 0.12) o[k] = junk[R(junk.length)]; else mutate(o[k]); } };
  for (let i = 0; i < 3000; i++) {
    const c = JSON.parse(JSON.stringify(mkPro(['shop', 'book', 'quote', 'none'][R(4)]))); c.pro.catalog.products = Array.from({ length: R(8) }, (_, k) => ({ name: 'P' + k, category: 'C', price: 100 * k, stock: k, description: 'd', images: [{ u: 'https://x.com/' + k }] })); mutate(c);
    const a = sanitizeConfig(c), b = sanitizeConfig(a); assert.equal(JSON.stringify(a), JSON.stringify(b));
    for (const m of ['preview', 'view', 'export']) { const o = buildSite(a, { mode: m, assetSrc: (x) => x }); if (a.kind !== 'pro') { assert.ok(o.html.includes('<!doctype html>')); continue; } const j = o.html.match(/id="site-data">([\s\S]*?)<\/script>/)[1]; JSON.parse(j); assert.ok(!j.includes('</')); }
  }
});
t('PERFORMANCE: max-size Pro config (60 products × 6 pictures, 40 gallery photos) sanitizes+builds fast', () => {
  const c = defaultConfig(); c.kind = 'pro'; c.pro = P.defaultPro('shop'); c.pro.catalog.products = Array.from({ length: 80 }, (_, i) => ({ name: 'Product ' + i, category: 'C' + (i % 6), price: 1000 + i, stock: 10, description: 'lorem ipsum '.repeat(30), images: Array.from({ length: 8 }, (_, k) => ({ u: 'https://x.com/' + i + '-' + k + '.jpg' })) })); c.pro.gallery.items = Array.from({ length: 60 }, (_, i) => ({ u: 'https://x.com/g' + i, c: 'cap' }));
  const s = Date.now(); const a = sanitizeConfig(c); const m1 = Date.now() - s; const s2 = Date.now(); buildSite(a, { mode: 'export', assetSrc: (x) => x }); const m2 = Date.now() - s2; assert.ok(a.pro.catalog.products.length === 60 && a.pro.gallery.items.length === 40, 'caps enforced'); assert.ok(m1 < 300 && m2 < 300, `slow ${m1}/${m2}`); console.log(`      (sanitize ${m1}ms · build ${m2}ms)`);
});
(async () => { let p = 0, f = 0; for (const [n, fn] of queue) { try { await fn(); p++; console.log('PASS ', n); } catch (e) { f++; console.log('FAIL ', n, '\n     ', String(e.stack || e).split('\n').slice(0, 6).join('\n      ')); } } console.log(`\n${p} passed, ${f} failed`); process.exit(f ? 1 : 0); })();
