// Property / stress tests for the engine core. Run: node tests/engine.core.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const Core = createRequire(import.meta.url)('../engine/core.js');
let pass = 0; const t = (name, fn) => { try { fn(); pass++; console.log('PASS ', name); } catch (e) { console.log('FAIL ', name, '\n     ', e.message); process.exitCode = 1; } };
const R = (n) => Math.floor(Math.random() * n);
const products = Array.from({ length: 30 }, (_, i) => ({ id: 'p' + i, name: 'Item ' + i, category: ['A', 'B', 'C'][i % 3], price: R(200000), stock: i % 7 === 0 ? 0 : (i % 5 === 0 ? 3 : 50), description: 'desc ' + i }));

t('sha256 matches Node on 5,000 random inputs (incl. unicode/surrogates)', () => {
  for (let i = 0; i < 5000; i++) { const s = i % 2 ? crypto.randomBytes(R(200)).toString('latin1') : String.fromCodePoint(...Array.from({ length: R(40) }, () => 32 + R(0x10fff))); assert.equal(Core.sha256(s), crypto.createHash('sha256').update(s, 'utf8').digest('hex')); }
});
t('hashPass is deterministic, salted by site key, and safeEq is constant-shape', () => {
  assert.equal(Core.hashPass('k1', 'pw'), Core.hashPass('k1', 'pw')); assert.notEqual(Core.hashPass('k1', 'pw'), Core.hashPass('k2', 'pw'));
  assert.ok(Core.safeEq('abc', 'abc')); assert.ok(!Core.safeEq('abc', 'abd')); assert.ok(!Core.safeEq('abc', 'abcd')); assert.ok(!Core.safeEq('', 'a'));
});
t('CART INVARIANTS under 100,000 random operations', () => {
  let cart = [];
  for (let i = 0; i < 100000; i++) {
    const op = R(4), id = 'p' + R(35);
    if (op < 2) cart = Core.cartAdd(cart, id, R(5) - 1);
    else if (op === 2) cart = cart.filter(() => Math.random() > 0.2);
    else cart.push({ id, q: [NaN, Infinity, -5, 1e9, '3', null][R(6)] });
    const rows = Core.cartRows(cart, products); const seen = new Set();
    for (const r of rows) { assert.ok(Number.isInteger(r.q) && r.q >= 1 && r.q <= 99 && r.q <= Core.stockOf(r.p)); assert.ok(Core.stockOf(r.p) > 0); assert.ok(!seen.has(r.p.id)); seen.add(r.p.id); }
    const tot = Core.cartTotals(rows, R(1e6), R(3) * 5000); assert.ok(tot.total >= 0 && tot.disc >= 0 && tot.disc <= tot.sub && Number.isFinite(tot.total));
    if (cart.length > 60) cart = cart.slice(-20);
  }
});
t('promo: never negative, never above subtotal, prototype keys inert', () => {
  const promos = Core.parsePromos('WELCOME10=10%\nSAVE5000=5000\nBIG=150%\nbad line\n=5\nX=0\nNEG=-5%\n__proto__=50%\nconstructor=10%');
  assert.deepEqual(Object.keys(promos).sort(), ['BIG', 'SAVE5000', 'WELCOME10', 'constructor'.toUpperCase(), '__PROTO__'].sort().filter((k) => promos[k]));
  for (let i = 0; i < 20000; i++) { const sub = R(2e6); const r = Core.applyPromo(['WELCOME10', 'SAVE5000', 'big', 'nope', '__proto__', 'constructor', 'toString', ''][R(8)], promos, sub); assert.ok(r.discount >= 0 && r.discount <= sub); }
  assert.equal(Core.applyPromo('welcome10', promos, 100000).discount, 10000); assert.equal(Core.applyPromo('BIG', promos, 5000).discount, 5000);
});
t('slots / days / past-time logic', () => {
  assert.deepEqual(Core.parseSlots('9am, 10:30, 2pm, 14:00, bad, 25:00, 12am, 12pm, 9:00'), ['00:00', '09:00', '10:30', '12:00', '14:00']);
  const mon = new Date(2026, 9, 19); const d = Core.nextDays(mon, 14, [0]); assert.equal(d.length, 12); assert.ok(d.every((x) => x.date.getDay() !== 0)); assert.equal(d[0].key, '2026-10-19');
  assert.ok(Core.slotPast('2026-10-19', '09:00', new Date(2026, 9, 19, 9, 0))); assert.ok(!Core.slotPast('2026-10-19', '09:01', new Date(2026, 9, 19, 9, 0))); assert.ok(Core.slotPast('garbage', '09:00', new Date()));
  for (let i = 0; i < 5000; i++) { const n = Core.nextDays(new Date(2026, R(12), 1 + R(28)), R(400) - 50, [R(7), R(7)]); assert.ok(n.length <= 120 && n.length >= 0); }
});
t('urls: javascript:/data:/protocol-relative tricks blocked; relative, https, mailto, inline images allowed', () => {
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:x', '//evil.com/x', 'https://x.com/a" onerror="x', 'file:///etc/passwd', 'http://a b']) assert.equal(Core.url(bad), '', bad);
  for (const ok of ['https://a.com/x.png', 'http://a.com', '#book', '/img/a.jpg', 'img/a.jpg', './a.png', 'mailto:a@b.co', 'tel:+256700000000']) assert.equal(Core.url(ok), ok, ok);
  assert.ok(Core.url('data:image/png;base64,AAAA', true)); assert.equal(Core.url('data:image/svg+xml;base64,AAAA', true), ''); assert.equal(Core.url('data:image/png;base64,AAAA', false), '');
});
t('esc() neutralises all five HTML-significant characters', () => { assert.equal(Core.esc('<img src=x onerror="a()">&\'"'), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;&quot;'); assert.equal(Core.esc(null), ''); assert.equal(Core.esc(5), '5'); });
t('csv: quoting, newlines, and spreadsheet formula injection', () => {
  const out = Core.csv([{ a: '=HYPERLINK("http://evil")', b: 'x,"y"\nz', c: '+1', d: null }], [{ h: 'A', v: 'a' }, { h: 'B', v: 'b' }, { h: 'C', v: 'c' }, { h: 'D', v: 'd' }]);
  assert.equal(out, 'A,B,C,D\r\n"\'=HYPERLINK(""http://evil"")","x,""y""\nz",\'+1,');
});
t('merge: prototype pollution impossible; arrays replaced; deep objects merged', () => {
  const m = Core.merge({ a: { x: 1, y: 2 }, l: [1, 2] }, JSON.parse('{"a":{"y":3},"l":[9],"__proto__":{"polluted":1},"constructor":{"prototype":{"p2":1}}}'));
  assert.deepEqual(m, { a: { x: 1, y: 3 }, l: [9] }); assert.equal({}.polluted, undefined); assert.equal({}.p2, undefined);
  const base = { k: 1 }; Core.merge(base, { k: 2 }); assert.equal(base.k, 1);
});
t('refs are unique across 50,000 orders and phone/WhatsApp normalisation', () => {
  const used = {}, seen = new Set(); for (let i = 0; i < 50000; i++) { const r = Core.ref('ORD', 1760000000000 + i * 37, Math.random, used); used[r] = 1; assert.ok(!seen.has(r)); seen.add(r); }
  assert.equal(Core.normPhone('0700 123 456'), '256700123456'); assert.equal(Core.normPhone('+256700123456'), '256700123456'); assert.equal(Core.normPhone('00256700123456'), '256700123456'); assert.ok(!Core.phoneOk('12')); assert.ok(Core.phoneOk('0700123456'));
  assert.ok(Core.waUrl('0700123456', 'hi & bye').startsWith('https://wa.me/256700123456?text=hi%20%26%20bye'));
});
t('filter/sort/categories are stable and total on messy data', () => {
  const messy = [{ id: 'a', name: null, price: 'x' }, { id: 'b', name: 'Shoe', category: 'Shoes', price: 5 }, { id: 'c', name: 'Boot', category: 'Shoes', price: 9 }];
  assert.equal(Core.filterProducts(messy, { q: 'sho' }).length, 2); assert.equal(Core.filterProducts(messy, { q: 'boot' }).length, 1); assert.deepEqual(Core.filterProducts(messy, { sort: 'high', cat: 'Shoes' }).map((p) => p.id), ['c', 'b']); assert.deepEqual(Core.categories(messy), ['All', 'Shoes']);
  for (let i = 0; i < 20000; i++) Core.filterProducts(products, { q: ['', 'item 1', '%', '(', '\\'][R(5)], cat: ['All', 'A', 'Z'][R(3)], sort: ['', 'low', 'high', 'name'][R(4)], favs: R(2) ? ['p1', 'p2'] : null });
});
t('visit counter keeps only the last 60 days', () => { let v = {}; for (let d = 0; d < 200; d++) v = Core.bumpVisit(v, `2026-${String(1 + (d % 12)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}-${d}`); assert.ok(Object.keys(v).length <= 60); });
console.log(`\n${pass} core tests passed` + (process.exitCode ? ' — WITH FAILURES' : ''));
