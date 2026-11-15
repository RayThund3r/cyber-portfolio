// Cloud inbox: validation, atomic slot claims, owner auth, isolation, floods, email. Run: node tests/build-server.mjs && node tests/server.cloud.test.cjs
process.env.CONTACT_FROM = 'Test <t@example.com>'; process.env.RESEND_API_KEY = 're_test';
const H = require('./server-setup.cjs'); const { ok } = H; const crypto = require('crypto');
const C = H.req('server/cloud'); const route = H.req('app/api/site/route'); const { rateLimit } = H.req('server/util');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const tokenOf = (id, pass) => sha(`${id}:cloud:${pass}`), verifierOf = (t) => sha('v:' + t);
let ipn = 0; const nextIp = () => `198.51.${(++ipn >> 8) & 255}.${ipn & 255}`;
const post = async (body, ip = nextIp()) => route.POST(new Request('http://x/api/site', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const get = async (q, ip = nextIp()) => route.GET(new Request('http://x/api/site?' + q, { headers: { 'x-forwarded-for': ip } }));
const reg = (id, pass = 'owner-pass-1', extra = {}) => C.registerSite({ id, projectId: 'PRJ-' + id, name: 'Shop ' + id, ownerEmail: '', verifier: verifierOf(tokenOf(id, pass)), ...extra });
const future = (d = 3) => { const t = new Date(Date.now() + d * 864e5); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`; };
const order = (o = {}) => ({ name: 'Ann Ouma', phone: '0700 555 666', items: [{ id: 'p1', n: 'Bread', p: 4000, q: 2 }, { id: 'p2', n: 'Cake', p: 50000, q: 1 }], disc: 5000, fee: 3000, dl: 'delivery', addr: 'Ndejje', pay: 'mtn', ...o });
const sub = (id, kind, data, ip) => post({ id, action: 'submit', kind, data }, ip);
(async () => {
  // ── registration ──
  ok('register: new site OK; bad id / bad verifier rejected', (await reg('shopaaaa')).ok === true && (await C.registerSite({ id: '../x', projectId: 'p', name: '', ownerEmail: '', verifier: 'a'.repeat(64) })).ok === false && (await C.registerSite({ id: 'shopbbbb', projectId: 'p', name: '', ownerEmail: '', verifier: 'nothex' })).ok === false);
  ok('register: idempotent for the same project; id taken by ANOTHER project is refused', (await reg('shopaaaa')).ok === true && (await C.registerSite({ id: 'shopaaaa', projectId: 'PRJ-OTHER', name: '', ownerEmail: '', verifier: 'b'.repeat(64) })).reason === 'id_taken');
  // ── HTTP basics ──
  let r = await route.OPTIONS(); ok('CORS preflight: 204 + wildcard origin + no-store', r.status === 204 && r.headers['Access-Control-Allow-Origin'] === '*' && r.headers['Cache-Control'] === 'no-store');
  ok('unknown site → 404; traversal id → 404; bad JSON → 400; oversized → 413; unknown action → 400', (await post({ id: 'nosuchsite', action: 'submit' })).status === 404 && (await post({ id: '../../etc', action: 'submit' })).status === 404 && (await post('{nope')).status === 400 && (await post({ id: 'shopaaaa', action: 'submit', kind: 'order', data: { x: 'a'.repeat(50000) } })).status === 413 && (await post({ id: 'shopaaaa', action: 'wat' })).status === 400);
  process.env.CLOUD_INBOX = 'off'; ok('platform kill switch: CLOUD_INBOX=off → 503 for everything', (await post({ id: 'shopaaaa', action: 'submit' })).status === 503 && (await get('id=shopaaaa&date=2026-01-01')).status === 503); delete process.env.CLOUD_INBOX;
  // ── orders ──
  r = await sub('shopaaaa', 'order', order()); const ref1 = r.body.ref;
  ok('order stored; server assigns ref; total RECOMPUTED (8000+50000−5000+3000 = 56000)', r.status === 200 && /^ORD-[A-Z0-9]{7}$/.test(ref1));
  const tok = tokenOf('shopaaaa', 'owner-pass-1'); let list = (await post({ id: 'shopaaaa', action: 'owner.list', token: tok })).body;
  ok('owner sees it with server-computed total, normalised phone, Pending', list.orders.length === 1 && list.orders[0].total === 56000 && list.orders[0].phone === '256700555666' && list.orders[0].st === 'Pending');
  r = await sub('shopaaaa', 'order', order({ total: 1, sub: 1, items: [{ n: 'Hack', p: -500, q: 1e9 }, { n: '', p: 5, q: 1 }] })); list = (await post({ id: 'shopaaaa', action: 'owner.list', token: tok })).body;
  ok('forged total / negative price / huge quantity are neutralised (price→0, qty→99)', r.status === 200 && list.orders.find((o) => o.ref === r.body.ref).total === 3000 && list.orders.find((o) => o.ref === r.body.ref).items.length === 1 && list.orders.find((o) => o.ref === r.body.ref).items[0].q === 99);
  ok('invalid orders refused (no items / short name / bad phone / not an object)', (await sub('shopaaaa', 'order', order({ items: [] }))).status === 400 && (await sub('shopaaaa', 'order', order({ name: 'A' }))).status === 400 && (await sub('shopaaaa', 'order', order({ phone: '12' }))).status === 400 && (await post({ id: 'shopaaaa', action: 'submit', kind: 'order', data: 'str' })).status === 400 && (await sub('shopaaaa', 'bogus', {})).status === 400);
  r = await sub('shopaaaa', 'order', order({ ref: 'ORD-CLIENT1' })); const dup = await sub('shopaaaa', 'order', order({ ref: 'ORD-CLIENT1' })); const clash = await sub('shopaaaa', 'order', order({ ref: 'ORD-CLIENT1', phone: '0700111222', name: 'Someone Else' }));
  ok("client's own ref honoured; a network retry is idempotent; a ref clash gets a fresh server ref", r.body.ref === 'ORD-CLIENT1' && dup.body.duplicate === true && dup.body.ref === 'ORD-CLIENT1' && clash.body.ref !== 'ORD-CLIENT1' && /^ORD-/.test(clash.body.ref));
  const X = '<img src=x onerror=alert(1)>"\'&'; r = await sub('shopaaaa', 'order', order({ name: X + ' Bob', note: X, items: [{ n: X, p: 1, q: 1 }] })); list = (await post({ id: 'shopaaaa', action: 'owner.list', token: tok })).body;
  ok('hostile text is stored as plain text (the engine escapes it on display), control chars stripped', list.orders.find((o) => o.ref === r.body.ref).note === X && !/[\u0000-\u001f]/.test(JSON.stringify(list.orders.map((o) => o.name))));
  // ── bookings (atomic slot claims) ──
  const day = future(3); const bk = (o = {}) => ({ name: 'Bob Okello', phone: '0700123123', svc: 'Haircut', date: day, time: '10:00', ...o });
  r = await sub('shopaaaa', 'booking', bk()); const bref = r.body.ref;
  ok('booking accepted', r.status === 200 && /^BKG-/.test(bref));
  ok('same slot again → 409 slot_taken', (await sub('shopaaaa', 'booking', bk({ name: 'Other Person', phone: '0700999000' }))).status === 409);
  ok('re-sending the SAME booking (network retry) is idempotent, not a conflict', (await sub('shopaaaa', 'booking', bk({ ref: bref }))).body.duplicate === true);
  ok('invalid slots refused (bad time, past, >135 days, junk date)', (await sub('shopaaaa', 'booking', bk({ time: '25:00' }))).status === 400 && (await sub('shopaaaa', 'booking', bk({ date: '2020-01-01' }))).status === 400 && (await sub('shopaaaa', 'booking', bk({ date: future(400) }))).status === 400 && (await sub('shopaaaa', 'booking', bk({ date: '2026-13-45' }))).status === 400);
  r = await get(`id=shopaaaa&date=${day}`); ok('visitors can see taken slots (times only, no personal data)', r.status === 200 && JSON.stringify(r.body.taken) === '["10:00"]' && !JSON.stringify(r.body).includes('Bob'));
  const slot2 = future(4); const winners = (await Promise.all(Array.from({ length: 60 }, (_, i) => sub('shopaaaa', 'booking', bk({ date: slot2, time: '14:00', name: 'Racer ' + i, phone: '07001230' + String(10 + i) }), nextIp())))).filter((x) => x.status === 200);
  ok('60 visitors booking the SAME slot at the same instant → exactly ONE wins', winners.length === 1, `(${winners.length})`);
  const tok2 = tok; await post({ id: 'shopaaaa', action: 'owner.update', token: tok2, kind: 'booking', ref: bref, status: 'Cancelled' });
  ok('cancelling frees the slot', JSON.stringify((await get(`id=shopaaaa&date=${day}`)).body.taken) === '[]');
  r = await sub('shopaaaa', 'booking', bk({ name: 'New Person', phone: '0700777888' })); ok('freed slot can be booked again', r.status === 200);
  r = await post({ id: 'shopaaaa', action: 'owner.update', token: tok2, kind: 'booking', ref: bref, status: 'Confirmed' }); ok('un-cancelling a booking whose slot was re-booked is refused (409) and stays cancelled', r.status === 409);
  // ── enquiries / subscribers ──
  r = await sub('shopaaaa', 'enquiry', { name: 'Cy Mugisha', contact: 'cy@mail.com', msg: 'Need 50 cupcakes', kind: 'Quote', svc: 'Catering' }); ok('enquiry stored', r.status === 200 && /^ENQ-/.test(r.body.ref) && (await sub('shopaaaa', 'enquiry', { name: 'C', contact: 'x', msg: '' })).status === 400);
  await sub('shopaaaa', 'sub', { email: 'A@B.co' }); await sub('shopaaaa', 'sub', { email: 'a@b.co' }); ok('subscribers de-duplicated (case-insensitive); bad email refused', (await post({ id: 'shopaaaa', action: 'owner.list', token: tok })).body.subs.length === 1 && (await sub('shopaaaa', 'sub', { email: 'nope' })).status === 400);
  // ── tracking ──
  r = await post({ id: 'shopaaaa', action: 'track', ref: ref1.toLowerCase(), phone: '256700555666' }); const wrong = await post({ id: 'shopaaaa', action: 'track', ref: ref1, phone: '0700000000' }); const none = await post({ id: 'shopaaaa', action: 'track', ref: 'ORD-ZZZZZZZ', phone: '0700555666' });
  ok('track: right phone → status (any phone format); wrong phone and unknown ref look IDENTICAL', r.status === 200 && r.body.st === 'Pending' && wrong.status === 404 && none.status === 404 && JSON.stringify(wrong.body) === JSON.stringify(none.body) && !JSON.stringify(r.body).includes('Ouma'));
  await post({ id: 'shopaaaa', action: 'owner.update', token: tok, kind: 'order', ref: ref1, status: 'Paid' }); ok("owner's status change is what the customer then sees", (await post({ id: 'shopaaaa', action: 'track', ref: ref1, phone: '0700555666' })).body.st === 'Paid');
  // ── owner auth ──
  ok('no token / wrong token → 401; token of the wrong shape → 401', (await post({ id: 'shopaaaa', action: 'owner.list' })).status === 401 && (await post({ id: 'shopaaaa', action: 'owner.list', token: tokenOf('shopaaaa', 'WRONG') })).status === 401 && (await post({ id: 'shopaaaa', action: 'owner.list', token: { $ne: 1 } })).status === 401);
  const hostile = '203.0.113.9'; let last; for (let i = 0; i < 11; i++) last = await post({ id: 'shopaaaa', action: 'owner.list', token: tokenOf('shopaaaa', 'guess' + i) }, hostile);
  ok('brute force: after 10 failures the address is LOCKED — even the correct token is refused for 10 minutes', last.status === 429 && (await post({ id: 'shopaaaa', action: 'owner.list', token: tok }, hostile)).status === 429 && (await post({ id: 'shopaaaa', action: 'owner.list', token: tok })).status === 200);
  ok('owner.update validates kind / ref / status; unknown record → 404', (await post({ id: 'shopaaaa', action: 'owner.update', token: tok, kind: 'order', ref: ref1, status: 'Hacked' })).status === 400 && (await post({ id: 'shopaaaa', action: 'owner.update', token: tok, kind: 'order', ref: '../../x', status: 'Paid' })).status === 400 && (await post({ id: 'shopaaaa', action: 'owner.update', token: tok, kind: 'order', ref: 'ORD-NOPE000', status: 'Paid' })).status === 404 && (await post({ id: 'shopaaaa', action: 'owner.update', token: tok, kind: 'sub', ref: ref1, status: 'x' })).status === 400);
  const del = await post({ id: 'shopaaaa', action: 'owner.delete', token: tok, kind: 'order', ref: 'ORD-CLIENT1' }); ok('owner can delete a record', del.status === 200 && !(await post({ id: 'shopaaaa', action: 'owner.list', token: tok })).body.orders.some((o) => o.ref === 'ORD-CLIENT1'));
  // rotation
  const newTok = tokenOf('shopaaaa', 'brand-new-pass'); r = await post({ id: 'shopaaaa', action: 'owner.rotate', token: tok, verifier: verifierOf(newTok) });
  ok('passcode rotation: old token dies, new token works', r.status === 200 && (await post({ id: 'shopaaaa', action: 'owner.list', token: tok })).status === 401 && (await post({ id: 'shopaaaa', action: 'owner.list', token: newTok })).status === 200);
  await reg('shopaaaa', 'owner-pass-1'); ok('re-download with an UNCHANGED builder passcode does NOT undo an in-admin rotation', (await post({ id: 'shopaaaa', action: 'owner.list', token: newTok })).status === 200);
  await reg('shopaaaa', 'builder-changed'); ok('…but a passcode changed in the builder DOES take effect', (await post({ id: 'shopaaaa', action: 'owner.list', token: tokenOf('shopaaaa', 'builder-changed') })).status === 200 && (await post({ id: 'shopaaaa', action: 'owner.list', token: newTok })).status === 401);
  // ── isolation ──
  await reg('shopcccc'); await sub('shopcccc', 'order', order({ name: 'Only In C' }));
  ok("one shop's owner token can NOT read another shop's data", (await post({ id: 'shopcccc', action: 'owner.list', token: tokenOf('shopaaaa', 'builder-changed') })).status === 401 && (await post({ id: 'shopcccc', action: 'owner.list', token: tokenOf('shopcccc', 'owner-pass-1') })).body.orders.every((o) => o.name === 'Only In C'));
  // ── concurrency across sites ──
  await reg('shopdddd'); await reg('shopeeee'); const sites = ['shopcccc', 'shopdddd', 'shopeeee']; const t0 = Date.now();
  const rs = await Promise.all(Array.from({ length: 300 }, (_, i) => sub(sites[i % 3], 'order', order({ name: 'Load ' + i }), nextIp()))); const okN = rs.filter((x) => x.status === 200).length;
  const counts = await Promise.all(sites.map(async (s) => (await post({ id: s, action: 'owner.list', token: tokenOf(s, 'owner-pass-1') })).body.orders.length));
  ok('300 concurrent submissions across 3 shops: none lost, none leaked between shops', okN === 300 && counts[0] === 101 && counts[1] === 100 && counts[2] === 100, `(${Date.now() - t0}ms · ${counts})`);
  const ups = await Promise.all((await post({ id: 'shopdddd', action: 'owner.list', token: tokenOf('shopdddd', 'owner-pass-1') })).body.orders.slice(0, 60).map((o) => post({ id: 'shopdddd', action: 'owner.update', token: tokenOf('shopdddd', 'owner-pass-1'), kind: 'order', ref: o.ref, status: 'Paid' })));
  ok('60 parallel status updates all succeed', ups.every((x) => x.status === 200));
  // ── floods ──
  const flood = '192.0.2.200'; let throttled = 0; for (let i = 0; i < 35; i++) { const x = await sub('shopeeee', 'sub', { email: `f${i}@x.co` }, flood); if (x.status === 429) throttled++; }
  ok('one address flooding submissions is throttled after 30 per 10 minutes', throttled === 5, `(${throttled})`);
  // ── email to the shop owner ──
  await reg('shopffff', 'p', { ownerEmail: 'owner@shop.ug' }); global.__mails = []; await sub('shopffff', 'order', order({ name: '<b>Evil</b> Ann', items: [{ n: '<script>x</script>', p: 1000, q: 1 }] })); await new Promise((r) => setTimeout(r, 50));
  ok('owner gets an email for a new order; hostile text is HTML-escaped in it', global.__mails.length === 1 && global.__mails[0].to === 'owner@shop.ug' && !/<script>x/.test(global.__mails[0].html) && /&lt;script&gt;/.test(global.__mails[0].html) && /New order ORD-/.test(global.__mails[0].subject));
  global.__mails = []; await sub('shopaaaa', 'order', order()); await sub('shopffff', 'sub', { email: 'z@z.co' }); await new Promise((r) => setTimeout(r, 50)); ok('no email when the shop has no owner email, and none for newsletter sign-ups', global.__mails.length === 0);
  await reg('shopgggg');
  const floodSite = await post({ id: 'shopgggg', action: 'submit', kind: 'sub', data: { email: 'q@q.co' } }); let siteLimited = 0; for (let i = 0; i < 420; i++) { const x = await sub('shopgggg', 'sub', { email: `s${i}@x.co` }, nextIp()); if (x.status === 429) siteLimited++; }
  ok('a whole-shop flood (any number of addresses) is capped at 400 submissions per hour', floodSite.status === 200 && siteLimited >= 19, `(${siteLimited} throttled)`);
  // ── owner reads under concurrency: shared rebuilds must never serve data from before a write ──
  await reg('shophhhh'); const siteH = await C.getSite('shophhhh'); let stale = 0, checks = 0;
  for (let round = 0; round < 25; round++) {
    const ops = []; for (let w = 0; w < 4; w++) ops.push((async () => { const r = await C.submit(siteH, 'order', { name: `W${round}-${w}`, phone: '0700123' + String(100 + round * 4 + w), items: [{ id: 'p', n: 'x', p: 1, q: 1 }] }); const l = (await C.ownerList('shophhhh')).body; checks++; if (!l.orders.some((o) => o.ref === r.body.ref)) stale++; })());
    for (let k = 0; k < 8; k++) ops.push(C.ownerList('shophhhh')); await Promise.all(ops);
  }
  ok('read-your-writes: 100 race checks between writers and 200 simultaneous owner refreshes — never a stale list', stale === 0 && checks === 100, `(${stale} stale)`);
  const lists = await Promise.all(Array.from({ length: 20 }, () => C.ownerList('shophhhh'))); ok('20 simultaneous owner refreshes return identical, complete lists', lists.every((l) => l.body.orders.length === 100 && JSON.stringify(l.body.orders) === JSON.stringify(lists[0].body.orders)));
  // ── caps ──
  await reg('shopgggg'); const siteG = await C.getSite('shopgggg'); const many = []; for (let i = 0; i < 3030; i++) many.push(() => C.submit(siteG, 'enquiry', { name: 'Enq ' + i, contact: 'c' + i + '@x.co', msg: 'hello ' + i })); // module level: the per-site flood limit lives in the route
  for (let i = 0; i < many.length; i += 150) await Promise.all(many.slice(i, i + 150).map((f) => f())); await C.prune('shopgggg', 'enquiry'); const after = (await post({ id: 'shopgggg', action: 'owner.list', token: tokenOf('shopgggg', 'owner-pass-1') })).body.enquiries;
  ok('storage cap: a shop is pruned to 3,000 per kind (oldest removed first)', after.length === 3000 && after[0].at >= after[after.length - 1].at, `(${after.length})`);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
