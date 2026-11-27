// Engine ⇄ cloud inbox, end to end: the REAL engine in a DOM model talking to the REAL server handlers.
// Run: node tests/build-server.mjs && node tests/engine.cloud.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
// The booking scenarios need open slots "today", which do not exist late in the evening: run them as if it were 10:00 local time (the clock still ticks).
{ const RD = Date, n = new RD(), t = new RD(n); t.setHours(10, 0, 0, 0); const off = t.getTime() - n.getTime();
  globalThis.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(RD.now() + off); } static now() { return RD.now() + off; } }; }
process.env.CONTACT_FROM = ''; // no e-mail in these tests
const H = require('./server-setup.cjs'); const { makeEnv } = require('./dom.js'); const Core = require('../engine/core.js');
const C = H.req('server/cloud'); const route = H.req('app/api/site/route');
let pass = 0, failed = 0; const queue = []; const t = (name, fn) => queue.push([name, fn]);
const PASS = 'owner-pass-123';
let ipn = 0; const nextIp = () => `172.16.${(++ipn >> 8) & 255}.${ipn & 255}`;
const settle = async (cond, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 8)); } return false; };
const verifierFor = (id, pass) => Core.cloudVerifier(Core.cloudToken(id, pass));
const ownerCall = async (id, body, pass = PASS) => route.POST(new Request('http://x/api/site', { method: 'POST', headers: { 'x-forwarded-for': nextIp() }, body: JSON.stringify({ id, token: Core.cloudToken(id, pass), ...body }) }));
const ownerList = async (id, pass) => (await ownerCall(id, { action: 'owner.list' }, pass)).body;

// the "network": routes /api/site to the real handlers; can be switched off, made flaky, or lose responses
function net(o = {}) {
  let n = 0; const api = { calls: 0 };
  api.fetch = async (url, init = {}) => {
    url = String(url); if (!url.includes('/api/site')) return { ok: false, status: 404, json: async () => ({}) };
    api.calls++; n++; if (o.down && o.down()) throw new TypeError('network down');
    if (o.flaky && n % 3 !== 0) { if (o.loseResponse && n % 3 === 1) await send(url, init); throw new TypeError('flaky'); } // 2 of 3 requests fail; some AFTER the server processed them
    return send(url, init);
  };
  const send = async (url, init) => { const m = init.method || 'GET'; const req = new Request(url, { method: m, headers: { 'x-forwarded-for': o.ip ? o.ip() : nextIp(), ...(init.headers || {}) }, body: m === 'GET' ? undefined : init.body }); const res = m === 'GET' ? await route.GET(req) : await route.POST(req); if (process.env.DEBUG_NET) console.log('   NET', m, init.body ? JSON.parse(init.body).action : url.split('?')[1], '→', res.status, JSON.stringify(res.body).slice(0, 90)); const wire = JSON.parse(JSON.stringify(res.body)); return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => wire }; }; // like a real network: the client gets a COPY, never the server's live objects
  return api;
}
const site = (id, over = {}) => ({ v: 1, key: id, updatedAt: 1760000000000, mode: 'shop', cur: 'UGX', theme: 'auto', lang: 'en', sec: ['hero', 'about', 'catalog', 'book', 'quote', 'contact'],
  b: { name: 'Mama Pima', tag: 'Fresh', about: 'We bake.', phone: '0700123456', wa: '0700123456', hours: 'Mon–Sat', mono: 'MP' }, hero: { slides: [{ t: 'Hi', s: '' }] }, about: {}, sv: { items: [{ t: 'Haircut', d: '' }, { t: 'Wedding', d: '' }] },
  cat: { title: 'Shop', fee: 0, promos: '', pay: { mtn: '0770111222', cash: true }, products: [{ id: 'p1', name: 'Bread', category: 'Bakery', price: 4000, stock: 50, images: [] }, { id: 'p2', name: 'Cake', category: 'Cakes', price: 50000, stock: 50, images: [] }] },
  bk: { title: 'Book', slots: '08:00, 09:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00, 20:00, 21:00, 22:00, 23:00', ahead: 10, closed: [], deposit: 'Wedding=50000' }, gal: { items: [] }, ts: { items: [] }, faq: { items: [] }, ct: { title: 'Contact' },
  f: {}, adm: { h: Core.hashPass(id, PASS) }, ep: '', cloud: { u: 'https://platform.test', id }, ...over });
const device = (s, network = net()) => { const e = makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>', { protocol: 'https:', fetch: network.fetch }); e.doc.getElementById('site-data').textContent = JSON.stringify(s); e.load('core.js'); e.load('app.js'); e.network = network; e.site = s; return e; };
const register = (id, pass = PASS) => C.registerSite({ id, projectId: 'PRJ-' + id, name: id, ownerEmail: '', verifier: verifierFor(id, pass) });
const queueLen = (e, id) => JSON.parse(e.localStorage.getItem(`se_${id}_q`) || '[]').length;
const localDb = (e, id, k) => JSON.parse(e.localStorage.getItem(`se_${id}_db`) || '{}')[k] || [];
const place = (e, name = 'Ann Ouma', phone = '0700555666') => { e.click(e.$('.pc[data-id=p1] [data-act=add]')); e.click(e.$('[data-act=cart]')); e.type(e.$('#ck_name'), name); e.type(e.$('#ck_phone'), phone); e.click(e.$('[data-act=place]')); const ref = e.$$('.ov').pop().querySelector('p b').textContent; e.click(e.$$('[data-act=close]').pop()); return ref; };
const login = async (e, pass = PASS) => { e.loc.hash = '#admin'; e.type(e.$('#pw'), pass); e.click(e.$('[data-act=login]')); return settle(() => !!e.$('.am'), 350); }; // login asks the cloud first, so it is asynchronous
const tab = (e, v) => e.click(e.$$('.sb [data-act=at]').find((b) => b.dataset.v === v));
const bookFirstFree = (e, name = 'Bob Okello', phone = '0700123123') => { e.type(e.$('#bk_s'), 'Haircut'); e.click(e.$$('#slots button').find((b) => !('disabled' in b.attrs))); const time = e.$('#slots .on').textContent; e.type(e.$('#bk_n'), name); e.type(e.$('#bk_p'), phone); e.click(e.$('[data-act=book]')); return time; };

t('CROSS-DEVICE: customer orders on A → owner sees it on B → owner marks Paid → customer tracks from a THIRD device C', async () => {
  const id = 'xdevshop1'; await register(id); const A = device(site(id)), B = device(site(id)), Cdev = device(site(id));
  const ref = place(A); assert.ok(await settle(async () => (await ownerList(id)).orders.some((o) => o.ref === ref)), 'order reached the cloud'); assert.equal(queueLen(A, id), 0, 'queue drained');
  await login(B); assert.ok(await settle(() => /Live/.test(B.$('.am').textContent)), 'owner admin connected'); tab(B, 'ord'); assert.ok(B.$('.am').textContent.includes(ref), "B shows A's order"); assert.equal(localDb(B, id, 'orders').length, 0, 'B never had it locally');
  B.type(B.$('.am select[data-ch=ostat]'), 'Paid'); assert.ok(await settle(async () => (await ownerList(id)).orders.find((o) => o.ref === ref).st === 'Paid'), 'status synced to the cloud');
  Cdev.click(Cdev.$('footer [data-act=track]')); Cdev.type(Cdev.$('#tr_r'), ref); Cdev.type(Cdev.$('#tr_p'), '0700 555 666'); Cdev.click(Cdev.$('[data-act=trackgo]'));
  assert.ok(await settle(() => /Paid/.test(Cdev.$('#tr_o').textContent)), 'C (never saw the order) sees the owner\'s status'); Cdev.type(Cdev.$('#tr_p'), '0700000000'); Cdev.click(Cdev.$('[data-act=trackgo]')); await Cdev.sleep(60); assert.ok(!/Paid/.test(Cdev.$('#tr_o').textContent), 'wrong phone → nothing');
  for (const e of [A, B, Cdev]) assert.equal(e.errors.length, 0, e.errors.join('|'));
});
t('DOUBLE-BOOKING RACE: two devices, same slot → exactly one wins; loser is told, nothing saved, slot greys out', async () => {
  const id = 'racebook1'; await register(id); const s = site(id, { mode: 'book' }); const A = device(s), B = device(s); await B.sleep(30);
  const time = bookFirstFree(A); assert.ok(await settle(() => A.$$('.ov').length > 0 && /Reference/.test(A.$$('.ov').pop().textContent)), 'A confirmed'); assert.equal(localDb(A, id, 'bookings').length, 1);
  const timeB = bookFirstFree(B, 'Late Comer', '0700999000'); assert.equal(timeB, time, 'B (stale view) picked the same slot');
  assert.ok(await settle(() => !B.$$('#slots button').some((b) => b.textContent === time && !('disabled' in b.attrs))), 'slot now disabled on B'); assert.equal(localDb(B, id, 'bookings').length, 0, 'loser has no phantom booking'); assert.ok(!B.$$('.ov').some((o) => /✓/.test(o.textContent)), 'no confirmation shown to the loser');
  const Cdev = device(s); assert.ok(await settle(() => Cdev.$$('#slots button').some((b) => b.textContent === time && 'disabled' in b.attrs)), 'a brand-new visitor sees it taken too'); assert.equal((await ownerList(id)).bookings.length, 1);
  assert.equal(A.errors.length + B.errors.length, 0);
});
t('DOUBLE-TAP on "Confirm booking" sends ONE request', async () => {
  const id = 'dbltapbk1'; await register(id); const e = device(site(id, { mode: 'book' })); await e.sleep(20);
  e.type(e.$('#bk_s'), 'Haircut'); e.click(e.$$('#slots button').find((b) => !('disabled' in b.attrs))); e.type(e.$('#bk_n'), 'Dee Dee'); e.type(e.$('#bk_p'), '0700123123'); const before = e.network.calls; e.click(e.$('[data-act=book]')); e.click(e.$('[data-act=book]')); e.click(e.$('[data-act=book]'));
  await settle(() => localDb(e, id, 'bookings').length > 0); await e.sleep(60); assert.equal(e.network.calls - before, 1, 'one request'); assert.equal(localDb(e, id, 'bookings').length, 1); assert.equal((await ownerList(id)).bookings.length, 1);
});
t('OFFLINE FIRST: order + booking made with no network are kept, then delivered when it returns; a slot lost meanwhile is flagged', async () => {
  const id = 'offlineshp'; await register(id); let down = true; const s = site(id), D = device(s, net({ down: () => down }));
  const ref = place(D); assert.equal(localDb(D, id, 'orders').length, 1, 'saved locally'); assert.equal((await ownerList(id)).orders.length, 0, 'not in cloud yet'); assert.equal(queueLen(D, id), 1);
  const E = device(site(id, { mode: 'book' }), net({ down: () => down })); await E.sleep(20); const t1 = bookFirstFree(E, 'Offline Olga', '0700444555'); await settle(() => localDb(E, id, 'bookings').length === 1); assert.equal(queueLen(E, id), 1, 'booking queued');
  const F = device(site(id, { mode: 'book' })); await F.sleep(30); const t2 = bookFirstFree(F, 'Online Otto', '0700666777'); assert.equal(t2, t1, 'someone else took the same slot while E was offline'); await settle(async () => (await ownerList(id)).bookings.length === 1);
  down = false; D.sb.fire('online'); E.sb.fire('online');
  assert.ok(await settle(async () => (await ownerList(id)).orders.some((o) => o.ref === ref) && queueLen(D, id) === 0), 'offline order delivered after reconnect'); assert.ok(await settle(() => queueLen(E, id) === 0), 'E queue drained');
  assert.equal(localDb(E, id, 'bookings')[0].st, 'Conflict', 'E\'s booking flagged: slot was taken'); assert.equal((await ownerList(id)).bookings.length, 1, 'cloud still holds only the first booking');
});
t('EVENTUAL DELIVERY under a hostile network: 40 orders, 2 of 3 requests fail, some responses LOST after the server processed them → exactly 40 orders, no duplicates, refs match', async () => {
  const id = 'flakyshop1'; await register(id); const D = device(site(id), net({ flaky: true, loseResponse: true })); const refs = [];
  for (let i = 0; i < 40; i++) refs.push(place(D, 'Cust ' + i, '07005550' + String(10 + i)));
  const ok = await settle(async () => { D.sb.fire('online'); return queueLen(D, id) === 0; }, 15000); assert.ok(ok, 'queue drained, left: ' + queueLen(D, id));
  const got = (await ownerList(id)).orders; assert.equal(got.length, 40, 'server has ' + got.length); assert.deepEqual(got.map((o) => o.ref).sort(), refs.slice().sort()); assert.equal(D.errors.length, 0, D.errors.join('|'));
});
t('THE CLOUD DECIDES THE PASSCODE: a passcode the cloud no longer recognises is refused — even if it matches the copy saved with the site', async () => {
  const id = 'mismatch01'; await register(id, 'the-CURRENT-passcode'); const B = device(site(id)); await login(B, PASS);   // PASS matches the site's saved hash, but not the cloud
  await B.sleep(80); assert.ok(B.$('#pw'), 'still at the login screen'); assert.ok(!B.$('.kp')); assert.equal(B.errors.length, 0);
  await login(B, 'the-CURRENT-passcode'); assert.ok(await settle(() => !!B.$('.kp') && /Live/.test(B.$('.am').textContent)), 'the cloud\'s current passcode works even though the saved copy differs');
});
t('CLOUD DOWN at login: the passcode saved with the site is the offline fallback; unregistered site also falls back', async () => {
  const id = 'fallback001'; await register(id); const B = device(site(id), net({ down: () => true })); await login(B, 'wrong-one'); await B.sleep(60); assert.ok(B.$('#pw'), 'wrong passcode refused offline too');
  await login(B, PASS); assert.ok(await settle(() => !!B.$('.kp')), 'right passcode works offline'); assert.ok(await settle(() => /unreachable/.test(B.$('.am').textContent)));
  const U = device(site('neverreg001')); await login(U, PASS); assert.ok(await settle(() => !!U.$('.kp')), 'site unknown to the server → local passcode still works');
});
t('PASSCODE CHANGE in the admin rotates the cloud credential too (no lock-out)', async () => {
  const id = 'rotate0001'; await register(id); const B = device(site(id)); await login(B); assert.ok(await settle(() => /Live/.test(B.$('.am').textContent)));
  tab(B, 'sec'); B.type(B.$('#pw1'), 'a-brand-new-passcode'); B.click(B.$('[data-act=pw]')); assert.ok(await settle(async () => (await ownerCall(id, { action: 'owner.list' }, PASS)).status === 401), 'old credential dead');
  assert.equal((await ownerCall(id, { action: 'owner.list' }, 'a-brand-new-passcode')).status, 200, 'new credential works'); B.click(B.$('[data-act=logout]')); await login(B, 'a-brand-new-passcode'); assert.ok(await settle(() => /Live/.test(B.$('.am').textContent)), 'signs in to the cloud with the new passcode');
  const C2 = device(site(id)); await login(C2, PASS); await C2.sleep(80); assert.ok(C2.$('#pw') && !C2.$('.kp'), 'the OLD passcode is refused on every device (cloud knows it was changed)');
  await login(C2, 'a-brand-new-passcode'); assert.ok(await settle(() => !!C2.$('.kp') && /Live/.test(C2.$('.am').textContent)), 'the NEW passcode works on a device that never saw the change, although its saved copy is the old one');
});
t('SECRETS: the owner token / verifier are never written to browser storage', async () => {
  const id = 'secretsite1'; await register(id); const B = device(site(id)); await login(B); await settle(() => /Live/.test(B.$('.am').textContent)); tab(B, 'sec'); B.type(B.$('#pw1'), 'another-passcode-1'); B.click(B.$('[data-act=pw]')); await B.sleep(80);
  const dump = JSON.stringify([...B.localStorage._store.entries()]); for (const secret of [Core.cloudToken(id, PASS), Core.cloudVerifier(Core.cloudToken(id, PASS)), Core.cloudToken(id, 'another-passcode-1'), PASS, 'another-passcode-1']) assert.ok(!dump.includes(secret), 'leaked a secret into storage');
});
t('HOSTILE visitor data (script/markup in names, notes, items) is inert in the owner admin', async () => {
  const id = 'xssadmin001'; await register(id); const X = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  await route.POST(new Request('http://x/api/site', { method: 'POST', headers: { 'x-forwarded-for': nextIp() }, body: JSON.stringify({ id, action: 'submit', kind: 'order', data: { name: X + ' Eve', phone: '0700555666', note: X, items: [{ n: X, p: 5, q: 1 }] } }) }));
  await route.POST(new Request('http://x/api/site', { method: 'POST', headers: { 'x-forwarded-for': nextIp() }, body: JSON.stringify({ id, action: 'submit', kind: 'enquiry', data: { name: X + ' Mal', contact: 'a@b.co', msg: X } }) }));
  const B = device(site(id)); await login(B); await settle(() => /Live/.test(B.$('.am').textContent)); tab(B, 'ord'); assert.ok(B.$('.am').textContent.includes('<img src=x'), 'shown as text'); tab(B, 'enq'); assert.ok(B.$('.am').textContent.includes('<script>alert(2)'));
  const bad = B.doc.documentElement.all('*').filter((n) => n.tag === 'img' && /onerror/.test(JSON.stringify(n.attrs)) && !/this\.style\.display/.test(n.attrs.onerror || '') || (n.tag === 'script' && n.parent.tag !== 'body' && n.parent.tag !== 'head') || Object.keys(n.attrs).some((k) => /^on/.test(k) && k !== 'onerror')); assert.equal(bad.length, 0);
});
t('QUOTE site: enquiry + newsletter from a visitor reach the owner on another device; owner can mark done / delete', async () => {
  const id = 'quotesite01'; await register(id); const s = site(id, { mode: 'quote' }), A = device(s), B = device(s);
  A.type(A.$('#qt_n'), 'Cy Mugisha'); A.type(A.$('#qt_p'), 'cy@mail.com'); A.type(A.$('#qt_m'), 'Need 50 cupcakes'); A.click(A.$('[data-act=quote]')); A.click(A.$$('[data-act=close]').pop()); A.type(A.$('#nl'), 'fan@x.co'); A.click(A.$('[data-act=news]'));
  assert.ok(await settle(async () => { const l = await ownerList(id); return l.enquiries.length === 1 && l.subs.length === 1; })); await login(B); await settle(() => /Live/.test(B.$('.am').textContent)); tab(B, 'enq'); assert.ok(B.$('.am').textContent.includes('Need 50 cupcakes'));
  B.click(B.$('[data-act=edone]')); assert.ok(await settle(async () => (await ownerList(id)).enquiries[0].st === 'Done')); B.click(B.$('[data-act=edel]')); assert.ok(await settle(async () => (await ownerList(id)).enquiries.length === 0));
});
t('CLOUD UNREACHABLE at page load: the whole site (orders, admin, tracking) still works from this device', async () => {
  const id = 'nocloud001'; await register(id); const e = device(site(id), net({ down: () => true })); assert.equal(e.$$('#grid .pc').length, 2); const ref = place(e); assert.equal(localDb(e, id, 'orders').length, 1);
  await login(e); assert.ok(await settle(() => /unreachable/.test(e.$('.am').textContent)), 'banner explains'); tab(e, 'ord'); assert.ok(e.$('.am').textContent.includes(ref)); e.loc.hash = '#home'; e.click(e.$('footer [data-act=track]')); e.type(e.$('#tr_r'), ref); e.type(e.$('#tr_p'), '0700555666'); e.click(e.$('[data-act=trackgo]')); assert.ok(await settle(() => /Pending/.test(e.$('#tr_o').textContent)), 'local tracking still works'); assert.equal(e.errors.length, 0);
});
t('NO cloud configured / PREVIEW mode: engine behaves exactly as before and never calls the network', async () => {
  const id = 'plainsite01'; const n1 = net(), a = device(site(id, { cloud: undefined }), n1); place(a); await a.sleep(30); assert.equal(n1.calls, 0);
  const n2 = net(), b = device(site(id, { preview: true }), n2); place(b); await b.sleep(30); assert.equal(n2.calls, 0, 'a site with cloud config but in preview mode does not send');
});
t('FUZZ: 3,000 random actions on 3 devices sharing one cloud shop, with a flaky network, never throw; cloud never has duplicates', async () => {
  const id = 'fuzzcloud01'; await register(id); const s = site(id, { sec: ['hero', 'catalog', 'book', 'quote', 'contact'] }); const devs = [device(s, net({ flaky: true, loseResponse: true })), device(site(id, { mode: 'book' }), net()), device(site(id, { mode: 'quote' }), net({ flaky: true }))];
  const R = (n) => Math.floor(Math.random() * n); const words = ['', 'x', '0700123456', '<script>', '=1+1', '-5', 'Ann Ouma', 'a@b.co', '\u0000', 'a'.repeat(2000)];
  for (let i = 0; i < 3000; i++) { const e = devs[R(3)]; if (i === 1500) { await login(devs[1]); } const acts = e.$$('[data-act]').filter((a) => !/^(reset|publish|bkx|csv|print|logout|yes|pdel|pw)$/.test(a.dataset.act)), inputs = e.$$('input, textarea, select');
    try { const r = R(10); if (r < 6 && acts.length) e.click(acts[R(acts.length)]); else if (inputs.length && r < 9) { const n = inputs[R(inputs.length)]; if (n.attrs.type !== 'file') e.type(n, words[R(words.length)]); } else e.sb.fire('online'); } catch (x) { assert.fail('iteration ' + i + ': ' + x.stack); } if (i % 200 === 0) await new Promise((r) => setTimeout(r, 2)); }
  await new Promise((r) => setTimeout(r, 100)); const l = await ownerList(id); for (const k of ['orders', 'bookings', 'enquiries']) assert.equal(new Set(l[k].map((x) => x.ref)).size, l[k].length, 'duplicate refs in ' + k);
  const slots = l.bookings.filter((b) => b.st !== 'Cancelled').map((b) => b.date + b.time); assert.equal(new Set(slots).size, slots.length, 'two bookings hold the same slot');
  for (const e of devs) assert.equal(e.errors.length, 0, 'engine errors: ' + e.errors.slice(0, 2).join(' | '));
});
(async () => { const only = process.env.ONLY; for (const [name, fn] of queue) { if (only && !name.includes(only)) continue; try { await fn(); pass++; console.log('PASS ', name); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', String(e.stack || e).split('\n').slice(0, 6).join('\n      ')); } } console.log(`\n${pass} passed, ${failed} failed`); process.exit(failed ? 1 : 0); })();
