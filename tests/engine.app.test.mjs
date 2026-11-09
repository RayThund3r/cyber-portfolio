// End-to-end tests: the REAL engine (core.js + app.js) running against a minimal DOM. Run: node tests/engine.app.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { makeEnv } = require('./dom.js'); const Core = require('../engine/core.js');
let pass = 0, failed = 0; const queue = []; const t = (name, fn) => queue.push([name, fn]);

const PASS = 'owner-pass-123';
const base = (over = {}) => ({ v: 1, key: 'k1', updatedAt: 1760000000000, mode: 'shop', cur: 'UGX', theme: 'auto', lang: 'en', sec: ['hero', 'about', 'services', 'catalog', 'gallery', 'testimonials', 'faq', 'book', 'quote', 'contact'],
  b: { name: 'Mama Pima Bakery', tag: 'Fresh daily', about: 'We bake.\n\nWith love.', phone: '0700123456', wa: '0700123456', email: 'hi@pima.ug', addr: 'Ndejje', hours: 'Mon–Sat 8–6', announce: 'Free delivery today', mono: 'MP' },
  hero: { fx: 'fade', auto: true, sec: 5, slides: [{ u: 'https://x.com/a.jpg', t: 'Fresh bread', s: 'Every morning', cta: 'Order now' }, { u: 'https://x.com/b.jpg', t: 'Custom cakes', s: 'For every party', cta: 'See cakes' }] },
  about: { eyebrow: 'Our story', title: 'About us', img: 'https://x.com/c.jpg', stats: [{ v: '10+', l: 'Years' }] },
  sv: { title: 'Services', items: [{ t: 'Wedding cakes', d: 'Tiered', p: 'from UGX 200,000' }, { t: 'Catering', d: 'Events' }] },
  cat: { title: 'Shop', intro: 'Order online', fee: 5000, promos: 'WELCOME10=10%\nSAVE5000=5000', pay: { mtn: '0770111222', mtnn: 'Pima', airtel: '0750111222', cash: true },
    products: [{ id: 'p1', name: 'Bread', category: 'Bakery', price: 4000, stock: 20, description: 'Soft', images: ['https://x.com/p1.jpg'] }, { id: 'p2', name: 'Cake', category: 'Cakes', price: 50000, stock: 2, images: [] }, { id: 'p3', name: 'Cookie', category: 'Bakery', price: 1000, stock: 0 }, { id: 'p4', name: 'Muffin', category: 'Bakery', price: 2500, stock: 9 }] },
  bk: { title: 'Book', slots: '09:00, 10:00, 14:00', ahead: 7, closed: [0], deposit: 'Wedding cakes=50000' },
  gal: { title: 'Gallery', items: [{ u: 'https://x.com/g1.jpg', c: 'One' }, { u: 'https://x.com/g2.jpg', c: 'Two' }, { u: 'https://x.com/g3.jpg' }] }, ts: { title: 'Reviews', items: [{ n: 'Ann', q: 'Great' }] }, faq: { title: 'FAQ', items: [{ q: 'Delivery?', a: 'Yes' }] },
  ct: { title: 'Contact' }, f: {}, adm: { h: Core.hashPass('k1', PASS) }, ep: '', ...over });
function boot(site, opts = {}) {
  const e = makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>', opts);
  e.doc.getElementById('site-data').textContent = JSON.stringify(site);
  e.load('core.js'); e.load('app.js'); return e;
}
const sheetText = (e) => { const o = e.$$('.ov'); return o.length ? o[o.length - 1].textContent : ''; };
const db = (e, k = 'orders') => JSON.parse(e.localStorage.getItem('se_k1_db') || '{}')[k] || [];

t('renders every enabled section, nav links, announcement, slider and product grid', (e = boot(base())) => {
  for (const id of ['home', 'about', 'services', 'catalog', 'gallery', 'testimonials', 'faq', 'contact']) assert.ok(e.doc.getElementById(id), 'section ' + id);
  assert.ok(!e.doc.getElementById('book') && !e.doc.getElementById('quote'), 'book/quote hidden in shop mode');
  assert.equal(e.$$('.slide').length, 2); assert.equal(e.$$('#grid .pc').length, 4); assert.ok(e.$('.ann').textContent.includes('Free delivery')); assert.equal(e.$$('.nl a').length, 7);
  assert.equal(e.errors.length, 0, e.errors.join('|'));
});
t('slider: next/prev/dots/pause work and wrap around', (e = boot(base())) => {
  const on = () => e.$$('.slide').findIndex((s) => s.classList.contains('on'));
  assert.equal(on(), 0); e.click(e.$('[data-act=next]')); assert.equal(on(), 1); e.click(e.$('[data-act=next]')); assert.equal(on(), 0); e.click(e.$('[data-act=prev]')); assert.equal(on(), 1);
  e.click(e.$$('[data-act=dot]')[0]); assert.equal(on(), 0); e.click(e.$('[data-act=pause]')); assert.equal(e.$('#pp').textContent, '▶'); assert.equal(e.errors.length, 0);
});
t('catalog: category chips, search, sort, sold-out, favourites', async (e = boot(base())) => {
  e.click(e.$$('.chip').find((c) => c.dataset.v === 'Cakes')); assert.equal(e.$$('#grid .pc').length, 1);
  e.click(e.$$('.chip').find((c) => c.dataset.v === 'All')); e.type(e.$('#q'), 'bre'); await e.sleep(200); assert.equal(e.$$('#grid .pc').length, 1); e.type(e.$('#q'), '');
  await e.sleep(200); e.type(e.$('#sort'), 'high'); assert.equal(e.$$('#grid h3')[0].textContent, 'Cake'); assert.ok(e.$$('#grid .tag').length === 1 && e.$$('#grid .tag')[0].textContent === 'Sold out');
  e.click(e.$('[data-act=fav][data-id=p1]')); assert.deepEqual(JSON.parse(e.localStorage.getItem('se_k1_fav')), ['p1']); e.click(e.$('[data-act=favonly]')); assert.equal(e.$$('#grid .pc').length, 1);
  e.type(e.$('#q'), 'zzzz'); await e.sleep(200); assert.ok(e.$('#grid .empty')); assert.equal(e.errors.length, 0);
});
t('product sheet opens, thumbnails switch, related items, Esc closes', (e = boot(base())) => {
  e.click(e.$('.pc[data-id=p1]')); assert.ok(sheetText(e).includes('Bread') && sheetText(e).includes('UGX 4,000')); assert.ok(e.$('.ov .ph'));
  e.click(e.$('.ov [data-act=add]')); assert.equal(e.$('#cartn').textContent, '1'); e.doc.fire('keydown', e.doc.body, { key: 'Escape' }); assert.ok(!e.$('.ov') || !e.$('.ov').classList.contains('open'), 'Esc closes sheet');
});
t('FULL SHOP JOURNEY: add → promo → delivery fee → validate → order → WhatsApp → track', async (e = boot(base())) => {
  e.click(e.$('.pc[data-id=p1] [data-act=add]')); e.click(e.$('.pc[data-id=p1] [data-act=add]')); e.click(e.$('.pc[data-id=p4] [data-act=add]')); assert.equal(e.$('#cartn').textContent, '3');
  e.click(e.$('.pc[data-id=p3] [data-act=add]')); assert.equal(e.$('#cartn').textContent, '3', 'sold-out item rejected');
  e.click(e.$('[data-act=cart]')); assert.ok(sheetText(e).includes('Bread') && sheetText(e).includes('UGX 10,500'), 'subtotal 2×4000+2500');
  e.type(e.$('#ck_promo'), 'welcome10'); e.click(e.$('[data-act=promo]')); assert.ok(sheetText(e).includes('−UGX 1,050') && sheetText(e).includes('UGX 9,450'));
  e.click(e.$('[data-act=inc][data-id=p4]')); assert.ok(sheetText(e).includes('UGX 13,000'));
  e.click(e.$('[data-act=dec][data-id=p4]')); e.click(e.$('[data-act=dec][data-id=p4]')); assert.ok(!sheetText(e).includes('Muffin'), 'qty 0 removes row');
  e.type(e.$('#ck_dl'), 'delivery'); assert.ok(sheetText(e).includes('UGX 5,000'), 'delivery fee added');
  e.click(e.$('[data-act=place]')); assert.equal(db(e).length, 0, 'blocked: no name/phone/address'); e.type(e.$('#ck_name'), 'Ann'); e.type(e.$('#ck_phone'), '12'); e.click(e.$('[data-act=place]')); assert.equal(db(e).length, 0, 'bad phone blocked');
  e.type(e.$('#ck_phone'), '0700 555 666'); e.type(e.$('#ck_addr'), 'Ndejje, near the church'); e.type(e.$('#ck_pay'), 'mtn'); e.click(e.$('[data-act=place]'));
  const o = db(e)[0]; assert.ok(o && /^ORD-/.test(o.ref)); assert.equal(o.phone, '256700555666'); assert.equal(o.total, 8000 - 800 + 5000); assert.equal(o.items[0].q, 2); assert.equal(o.st, 'Pending');
  assert.ok(sheetText(e).includes('Order placed') && sheetText(e).includes('0770111222') && sheetText(e).includes(o.ref), 'payment instructions + ref');
  const wa = e.$$('.ov a.wa').pop().href; assert.ok(wa.startsWith('https://wa.me/256700123456?text=') && decodeURIComponent(wa).includes(o.ref) && decodeURIComponent(wa).includes('2 × Bread'));
  assert.equal(JSON.parse(e.localStorage.getItem('se_k1_cart')).length, 0, 'cart cleared'); assert.equal(e.$('#cartn').style.display, 'none');
  e.click(e.$('[data-act=track]')); e.type(e.$('#tr_r'), o.ref); e.type(e.$('#tr_p'), '0000'); e.click(e.$('[data-act=trackgo]')); assert.ok(!e.$('#tr_o').textContent.includes('Bread'), 'wrong phone → no data');
  e.type(e.$('#tr_p'), '0700555666'); e.click(e.$('[data-act=trackgo]')); assert.ok(e.$('#tr_o').textContent.includes('Pending') && e.$('#tr_o').textContent.includes('Bread'));
  assert.equal(e.errors.length, 0, e.errors.join('|'));
});
t('stock limits: cannot add more than available (Cake stock 2)', (e = boot(base())) => {
  for (let i = 0; i < 6; i++) e.click(e.$('.pc[data-id=p2] [data-act=add]')); assert.equal(e.$('#cartn').textContent, '2'); assert.equal(JSON.parse(e.localStorage.getItem('se_k1_cart'))[0].q, 2);
});
t('corrupted localStorage (cart/db/fav garbage) never crashes the site', (e) => {
  const mk = () => makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>'); e = mk();
  for (const k of ['cart', 'fav', 'db', 'own', 'lg', 'th', 'q']) e.localStorage.setItem('se_k1_' + k, '{{not json');
  e.doc.getElementById('site-data').textContent = JSON.stringify(base()); e.load('core.js'); e.load('app.js'); assert.equal(e.$$('#grid .pc').length, 4);
  const e2 = mk(); e2.localStorage.setItem('se_k1_cart', JSON.stringify([{ id: 'p1', q: 'x' }, null, 5, { id: 'zzz', q: 1 }, { id: 'p1', q: 1e9 }])); e2.localStorage.setItem('se_k1_db', JSON.stringify({ orders: 'nope', bookings: null }));
  e2.doc.getElementById('site-data').textContent = JSON.stringify(base()); e2.load('core.js'); e2.load('app.js'); assert.equal(e2.errors.length, 0, e2.errors.join('|')); assert.equal(e2.$('#cartn').textContent, '20', 'clamped to stock 20');
});
t('storage blocked entirely (private mode): site still works from memory', (e = boot(base(), { storageBlocked: true })) => {
  e.click(e.$('.pc[data-id=p1] [data-act=add]')); assert.equal(e.$('#cartn').textContent, '1'); assert.equal(e.errors.length, 0, e.errors.join('|'));
});
t('BOOKING mode: day strip, slots, validation, deposit, double-booking prevented', (e = boot(base({ mode: 'book' }))) => {
  assert.ok(e.doc.getElementById('book') && !e.doc.getElementById('catalog')); assert.ok(e.$$('#days button').length >= 5); assert.ok(!e.$$('#days small').some((s) => s.textContent === 'Sun'), 'closed Sundays hidden');
  e.click(e.$('[data-act=book]')); assert.equal(db(e, 'bookings').length, 0, 'needs name/phone/slot');
  const day = e.$$('#days button')[e.$$('#days button').length - 1]; e.click(day); e.click(e.$$('#slots button').find((b) => !b.attrs.disabled));
  e.type(e.$('#bk_s'), 'Wedding cakes'); e.type(e.$('#bk_n'), 'Bob'); e.type(e.$('#bk_p'), '0700111222'); e.click(e.$('[data-act=book]'));
  const b = db(e, 'bookings')[0]; assert.ok(b && /^BKG-/.test(b.ref) && b.dep === 50000 && b.svc === 'Wedding cakes'); assert.ok(sheetText(e).includes('Deposit') && sheetText(e).includes('UGX 50,000'));
  e.click(e.$$('[data-act=close]').pop()); const taken = e.$$('#slots button').filter((x) => 'disabled' in x.attrs && x.textContent === b.time); assert.equal(taken.length, 1, 'booked slot now disabled'); assert.equal(e.errors.length, 0, e.errors.join('|'));
});
t('QUOTE mode + contact form + newsletter + enquiry validation', (e = boot(base({ mode: 'quote' }))) => {
  assert.ok(e.doc.getElementById('quote')); e.click(e.$('[data-act=quote]')); assert.equal(db(e, 'enquiries').length, 0);
  e.type(e.$('#qt_n'), 'Cy'); e.type(e.$('#qt_p'), 'cy@mail.com'); e.type(e.$('#qt_m'), 'Need 50 cupcakes'); e.click(e.$('[data-act=quote]')); assert.equal(db(e, 'enquiries')[0].kind, 'Quote'); e.click(e.$$('[data-act=close]').pop());
  e.type(e.$('#ct_n'), 'Di'); e.type(e.$('#ct_p'), '0700123123'); e.type(e.$('#ct_m'), 'Hello there'); e.click(e.$('[data-act=contact]')); assert.equal(db(e, 'enquiries').length, 2);
  e.type(e.$('#nl'), 'bad'); e.click(e.$('[data-act=news]')); assert.equal(db(e, 'subs').length, 0); e.type(e.$('#nl'), 'ok@x.co'); e.click(e.$('[data-act=news]')); e.click(e.$('[data-act=news]')); assert.deepEqual(db(e, 'subs'), ['ok@x.co']);
});
t('theme + language toggles persist and re-render', (e = boot(base())) => {
  e.click(e.$('[data-act=theme]')); assert.ok(['dark', 'light'].includes(e.doc.documentElement.getAttribute('data-theme'))); e.click(e.$('[data-act=lang]')); assert.ok(e.$('.nl').textContent.includes('Duka'), 'Swahili nav');
  assert.equal(e.doc.documentElement.attrs.lang, 'sw'); assert.equal(JSON.parse(e.localStorage.getItem('se_k1_lg')), 'sw');
});
t('lightbox: open from gallery, next/prev wrap, close', (e = boot(base())) => {
  e.click(e.$$('.mas figure')[0]); assert.ok(e.$('.lb img').attrs.src.includes('g1')); e.click(e.$('[data-act=lbn]')); assert.ok(e.$('.lb img').attrs.src.includes('g2')); e.click(e.$('[data-act=lbp]')); e.click(e.$('[data-act=lbp]')); assert.ok(e.$('.lb img').attrs.src.includes('g3'));
  e.doc.fire('keydown', e.doc.body, { key: 'ArrowRight' }); assert.ok(e.$('.lb img').attrs.src.includes('g1')); e.click(e.$('[data-act=lbx]')); assert.ok(e.$('.lb') === null);
});
t('product WITHOUT pictures: tapping its image area is harmless (no lightbox, no error)', (e = boot(base())) => {
  e.click(e.$('.pc[data-id=p2]')); e.click(e.$('.ov [data-act=plb]')); assert.ok(e.$('.lb') === null); assert.equal(e.errors.length, 0, e.errors.join('|'));
});
t('OWNER ADMIN: lockout, login, dashboard, product CRUD → public site, order status, CSV, settings, publish, passcode change, backup/restore, reset', async (e = boot(base())) => {
  e.loc.hash = '#admin'; assert.ok(e.$('#pw'), 'login screen');
  for (let i = 0; i < 5; i++) { e.type(e.$('#pw'), 'wrong' + i); e.click(e.$('[data-act=login]')); } e.type(e.$('#pw'), PASS); e.click(e.$('[data-act=login]')); assert.ok(e.$('#pw'), 'correct passcode REJECTED during 30s lockout');
  e.localStorage.setItem('se_k1_lk', JSON.stringify({ n: 0, t: 0 })); e.click(e.$('[data-act=login]')); assert.ok(e.$('.kp'), 'dashboard after login');
  e.click(e.$$('.sb [data-act=at]').find((b) => b.dataset.v === 'prod')); e.click(e.$('[data-act=pnew]')); e.type(e.$('#pf_n'), 'Donut <b>X</b>'); e.type(e.$('#pf_c'), 'Bakery'); e.type(e.$('#pf_p'), '1500'); e.type(e.$('#pf_s'), '12'); e.type(e.$('#pf_i'), 'https://x.com/d.jpg'); e.click(e.$('[data-act=psave]'));
  assert.ok(e.$('.am').textContent.includes('Donut'), 'listed in admin'); e.loc.hash = '#home'; assert.equal(e.$$('#grid .pc').length, 5, 'new product visible on public site'); assert.ok(e.$$('#grid h3').some((h) => h.textContent === 'Donut <b>X</b>'), 'name shown as TEXT, not markup');
  e.click(e.$('.pc[data-id=p1] [data-act=add]')); e.click(e.$('[data-act=cart]')); e.type(e.$('#ck_name'), '=cmd|calc'); e.type(e.$('#ck_phone'), '0700999888'); e.click(e.$('[data-act=place]')); e.click(e.$$('[data-act=close]').pop());
  e.loc.hash = '#admin'; e.click(e.$$('.sb [data-act=at]').find((b) => b.dataset.v === 'ord')); assert.ok(e.$('.am').textContent.includes('=cmd|calc')); e.type(e.$('.am select[data-ch=ostat]'), 'Paid'); assert.equal(db(e)[0].st, 'Paid');
  e.click(e.$('[data-act=rcpt]')); assert.ok(sheetText(e).includes('Total')); e.click(e.$('[data-act=print]')); assert.equal(e.sb.printed, 1); e.click(e.$$('[data-act=close]').pop());
  e.click(e.$$('.sb [data-act=at]').find((b) => b.dataset.v === 'set')); e.type(e.$('#s_name'), 'Pima & Sons'); e.type(e.$('#s_fee'), '7000'); e.click(e.$('[data-act=sset]')); e.loc.hash = '#home'; assert.ok(e.$('.logo').textContent.includes('Pima'));
  e.loc.hash = '#admin'; e.click(e.$$('.sb [data-act=at]').find((b) => b.dataset.v === 'set')); let published; e.sb.URL = { createObjectURL: (b) => { published = b; return 'blob:x'; }, revokeObjectURL() {} }; e.click(e.$('[data-act=publish]'));
  const pub = JSON.parse(await published.text()); assert.ok(pub.updatedAt > 1760000000000 && pub.b.name === 'Pima & Sons' && pub.cat.products.length === 5 && !('preview' in pub), 'published file carries edits');
  e.click(e.$$('.sb [data-act=at]').find((b) => b.dataset.v === 'sec')); e.type(e.$('#pw1'), 'short'); e.click(e.$('[data-act=pw]')); e.type(e.$('#pw1'), 'a-better-passcode'); e.click(e.$('[data-act=pw]'));
  e.click(e.$('[data-act=logout]')); e.loc.hash = '#admin'; e.type(e.$('#pw'), PASS); e.click(e.$('[data-act=login]')); assert.ok(e.$('#pw'), 'old passcode no longer works'); e.type(e.$('#pw'), 'a-better-passcode'); e.click(e.$('[data-act=login]')); assert.ok(!e.$('#pw') && e.$('.am'), 'new passcode works');
  e.click(e.$$('.sb [data-act=at]').find((b) => b.dataset.v === 'sec')); e.click(e.$('[data-act=bkx]')); assert.equal(e.errors.length, 0, e.errors.join('|'));
});
t('published site-data.json (newer) overrides embedded content; stale local edits are dropped', async () => {
  const pub = base(); pub.updatedAt = 1770000000000; pub.b.name = 'Published Name'; pub.cat.products = [{ id: 'z1', name: 'Only', price: 100, stock: 5, category: 'X' }];
  const e = makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>', { protocol: 'https:', fetch: async () => ({ ok: true, json: async () => pub }) });
  e.localStorage.setItem('se_k1_own', JSON.stringify({ at: 1765000000000, patch: { b: { name: 'Stale local edit' } } })); e.doc.getElementById('site-data').textContent = JSON.stringify(base()); e.load('core.js'); e.load('app.js');
  await e.sleep(60); assert.ok(e.$('.logo').textContent.includes('Published Name'), 'published wins over older local edit'); assert.equal(e.$$('#grid .pc').length, 1);
  const bad = makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>', { protocol: 'https:', fetch: async () => ({ ok: true, json: async () => ({ key: 'OTHER', updatedAt: 9e15 }) }) }); bad.doc.getElementById('site-data').textContent = JSON.stringify(base()); bad.load('core.js'); bad.load('app.js'); await bad.sleep(60); assert.equal(bad.$$('#grid .pc').length, 4, 'foreign/invalid published file ignored');
});
t('order delivery to an https endpoint: sent, retried on failure, dropped after 5 failures', async () => {
  const calls = []; let ok = false; const e = makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>', { protocol: 'https:', fetch: async (u, o) => { if (u === 'site-data.json') return { ok: false }; calls.push(JSON.parse(o.body)); return { ok }; } });
  e.doc.getElementById('site-data').textContent = JSON.stringify(base({ ep: 'https://formspree.io/f/abc' })); e.load('core.js'); e.load('app.js');
  e.click(e.$('.pc[data-id=p1] [data-act=add]')); e.click(e.$('[data-act=cart]')); e.type(e.$('#ck_name'), 'Ann'); e.type(e.$('#ck_phone'), '0700555666'); e.click(e.$('[data-act=place]')); await e.sleep(30);
  assert.equal(calls[0].kind, 'order'); assert.equal(calls[0].site, 'Mama Pima Bakery'); assert.equal(JSON.parse(e.localStorage.getItem('se_k1_q')).length, 1, 'kept for retry'); ok = true; e.sb.fire('online'); await e.sleep(30); assert.equal(JSON.parse(e.localStorage.getItem('se_k1_q')).length, 0, 'delivered after retry');
  const http = makeEnv('<div id="app"></div><script type="application/json" id="site-data"></script>'); http.doc.getElementById('site-data').textContent = JSON.stringify(base({ ep: 'http://insecure.example/x' })); http.load('core.js'); http.load('app.js'); http.click(http.$('.pc[data-id=p1] [data-act=add]')); http.click(http.$('[data-act=cart]')); http.type(http.$('#ck_name'), 'Ann'); http.type(http.$('#ck_phone'), '0700555666'); http.click(http.$('[data-act=place]')); assert.equal(http.localStorage.getItem('se_k1_q'), null, 'insecure endpoint never used');
});
t('XSS: hostile content in EVERY field stays inert text', (e) => {
  const X = '"><img src=x onerror=alert(1)><script>alert(2)</script>', site = base(); site.b.name = X; site.b.tag = X; site.b.announce = X; site.hero.slides[0].t = X; site.cat.products[0].name = X; site.cat.products[0].description = X; site.cat.products[0].category = X; site.sv.items[0].t = X; site.gal.items[0].c = X; site.faq.items[0].q = X; site.ts.items[0].q = X;
  site.cat.products[0].images = ['javascript:alert(1)', 'https://x.com/a" onerror="alert(3)', '//evil.com/x.png']; site.hero.slides[0].u = 'javascript:alert(1)'; site.hero.slides[0].link = 'javascript:alert(4)';
  e = boot(site); e.click(e.$('.pc[data-id=p1]'));
  const all = e.doc.documentElement.all('*'); const bad = all.filter((n) => /^(script|iframe|object|embed)$/.test(n.tag) && n.parent && n.parent.attrs.id !== undefined || ('onerror' in n.attrs && !/^this\.style\.display='none'$/.test(n.attrs.onerror)) || Object.keys(n.attrs).some((k) => /^on/.test(k) && k !== 'onerror'));
  assert.equal(bad.length, 0, 'unexpected active content: ' + bad.map((n) => n.tag + JSON.stringify(n.attrs).slice(0, 80)).join(' | '));
  assert.ok(!e.doc.documentElement.all('img').some((i) => /javascript:|evil\.com|onerror/.test(i.attrs.src || '')), 'dangerous image URLs dropped');
  assert.ok(!e.doc.documentElement.all('a').some((a) => /^javascript:/i.test(a.attrs.href || '')), 'no javascript: links');
});
t('PERFORMANCE: 3,000 products render and filter fast', async () => {
  const site = base(); site.cat.products = Array.from({ length: 3000 }, (_, i) => ({ id: 'q' + i, name: 'Product ' + i, category: 'Cat' + (i % 12), price: 1000 + i, stock: 10, description: 'lorem '.repeat(20), images: ['https://x.com/' + i + '.jpg'] }));
  let s = Date.now(); const e = boot(site); const bootMs = Date.now() - s; assert.equal(e.$$('#grid .pc').length, 3000);
  s = Date.now(); e.click(e.$$('.chip')[3]); const chipMs = Date.now() - s; s = Date.now(); e.type(e.$('#q'), 'product 29'); await e.sleep(200); const searchMs = Date.now() - s - 200;
  assert.ok(bootMs < 4000 && chipMs < 1500 && searchMs < 1500, `slow: boot ${bootMs} chip ${chipMs} search ${searchMs}`); console.log(`      (boot ${bootMs}ms · chip ${chipMs}ms · search ${searchMs}ms for 3,000 products)`); assert.equal(e.errors.length, 0);
});
t('FUZZ: 6,000 random clicks/inputs/changes across public site + admin never throw', async () => {
  const e = boot(base({ mode: 'shop' })); const words = ['', 'x', '0700123456', '<script>', '=1+1', '9999999999', '-5', 'WELCOME10', 'Ann', '\u0000', 'a'.repeat(3000)];
  const R = (n) => Math.floor(Math.random() * n); let admin = false;
  for (let i = 0; i < 6000; i++) {
    if (i === 3000) { e.localStorage.setItem('se_k1_lk', '{"n":0,"t":0}'); e.loc.hash = '#admin'; if (e.$('#pw')) { e.type(e.$('#pw'), PASS); e.click(e.$('[data-act=login]')); } admin = true; }
    const acts = e.$$('[data-act]'); const inputs = e.$$('input, textarea, select');
    try { const r = R(10); if (r < 6 && acts.length) { const a = acts[R(acts.length)]; if (!/^(reset|publish|bkx|csv|print|logout|yes)$/.test(a.dataset.act) || R(40) === 0) e.click(a); } else if (inputs.length) { const n = inputs[R(inputs.length)]; if (n.attrs.type !== 'file') e.type(n, words[R(words.length)]); } else if (r === 9) e.doc.fire('keydown', e.doc.body, { key: ['Escape', 'ArrowLeft', 'ArrowRight', 'Enter'][R(4)] }); } catch (x) { assert.fail('iteration ' + i + ' threw: ' + x.stack); }
    if (i % 1500 === 0 && admin) { e.loc.hash = '#home'; e.loc.hash = '#admin'; }
  }
  assert.equal(e.errors.length, 0, 'engine reported errors: ' + e.errors.slice(0, 3).join(' | '));
});
(async () => { const only = process.env.ONLY; for (const [name, fn] of queue) { if (only && !name.includes(only)) continue; try { await fn(); pass++; console.log('PASS ', name); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', String(e.stack || e).split('\n').slice(0, 5).join('\n      ')); } } console.log(`\n${pass} passed, ${failed} failed`); process.exit(failed ? 1 : 0); })();
