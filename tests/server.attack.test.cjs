// Red-team battery: every probe is an attack; a PASS means the attack FAILED.
const H = require('./server-setup.cjs'); const { ok } = H;
const J = (u, b, h = {}) => new Request('http://site.test' + u, { method: 'POST', headers: { 'content-type': 'application/json', host: 'site.test', origin: 'http://site.test', ...h }, body: typeof b === 'string' ? b : JSON.stringify(b) });
const call = async (mod, req) => { const r = await mod.POST(req); return { s: r.status, b: r.body, h: r.headers }; };
(async () => {
  const P = H.req('server/projects'), S = H.req('server/store'), B = H.req('app/api/builder/route'), EV = H.req('app/api/ev/route');
  const ip = (n) => ({ 'x-forwarded-for': `9.9.${n >> 8 & 255}.${n & 255}` });
  let n = 1;

  /* 1. prototype-key injection through analytics */
  for (const q of ['__proto__', 'constructor', 'hasownproperty', 'valueof', 'prototype']) await call(EV, J('/api/ev', { t: 'unanswered', q }, ip(n++)));
  await new Promise((r) => setTimeout(r, 50));
  ok('analytics: prototype keys cannot pollute Object.prototype', ({}).n === undefined && ({}).last === undefined && Object.keys(Object.prototype).length === 0);
  const st = await S.readStats(); ok('analytics: stats stay a clean object', Object.getPrototypeOf(st.unanswered) === Object.prototype && typeof st.unanswered.constructor !== 'string');

  /* 2. asset-limit race: many parallel uploads must not exceed the per-site limits */
  const c = await P.createProject('business');
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500 * 1024, 1)]).toString('base64');
  const ups = await Promise.all(Array.from({ length: 90 }, () => P.addAsset(c.id, c.key, 'image/jpeg', jpg)));
  const p1 = await P.authProject(c.id, c.key); const cnt = Object.keys(p1.assets).length, bytes = Object.values(p1.assets).reduce((a, x) => a + x.bytes, 0);
  ok('uploads: parallel flood cannot exceed 60 pictures / 14 MB', cnt <= 60 && bytes <= 14 * 1024 * 1024, `count=${cnt} bytes=${bytes}`);

  /* 3. restore must share the creation limit (no second faucet for new projects) */
  let created = 0; const key = 'k'.repeat(20);
  for (let i = 0; i < 60; i++) { const r = await call(B, J('/api/builder', { action: 'restore', id: 'PRJ-' + String(100000 + i), key, config: { sections: [{ type: 'hero', id: 'a' }] } }, ip(5000))); if (r.s === 200) created++; }
  ok('restore: one address cannot mint unlimited projects', created <= 30, `created=${created}`);

  /* 4. deep-nesting / giant JSON */
  const deep = '['.repeat(100000) + ']'.repeat(100000);
  const r4 = await call(B, J('/api/builder', `{"action":"save","id":"${c.id}","key":"${c.key}","config":${deep}}`, ip(n++)));
  ok('deeply nested JSON is rejected, not a crash', r4.s >= 400 && r4.s < 500, 'status ' + r4.s);
  const r4b = await call(B, J('/api/builder', { action: 'save', id: c.id, key: c.key, config: JSON.parse('{"a":'.repeat(3000) + '1' + '}'.repeat(3000)) }, ip(n++)));
  ok('deeply nested config object does not 500', r4b.s !== 500, 'status ' + r4b.s);

  /* 5. prototype pollution through config / template ids */
  await call(B, J('/api/builder', JSON.stringify({ action: 'save', id: c.id, key: c.key, config: JSON.parse('{"__proto__":{"polluted":"yes"},"brand":{"__proto__":{"polluted":"yes"}},"sections":[{"type":"hero","__proto__":{"polluted":"yes"}}]}') }), ip(n++)));
  ok('config: __proto__ keys cannot pollute', ({}).polluted === undefined);
  const r5 = await call(B, J('/api/builder', { action: 'create', templateId: '__proto__' }, ip(n++))); ok('create with templateId __proto__ is refused or blank, never a crash', r5.s !== 500, 'status ' + r5.s);
  const r5b = await call(B, J('/api/builder', { action: 'create', templateId: 'constructor' }, ip(n++))); ok('create with templateId constructor safe', r5b.s !== 500);

  /* 6. wrong-key guessing cannot be bypassed by spoofing the address header */
  let blocked = false; for (let i = 0; i < 40; i++) { const r = await call(B, J('/api/builder', { action: 'load', id: c.id, key: 'wrong' + i }, { 'x-forwarded-for': `1.1.1.${i}, 7.7.7.7` })); if (r.s === 429) { blocked = true; break; } }
  ok('key guessing: locked after a few wrong keys even when X-Forwarded-For is rotated', blocked);
  const r6 = await call(B, J('/api/builder', { action: 'load', id: c.id, key: c.key }, ip(n++))); ok('...and the right key is also held off during the lock (no oracle)', r6.s === 429);

  /* 7. cross-site and odd methods */
  const x = await call(B, J('/api/builder', { action: 'create', templateId: 'business' }, { origin: 'http://evil.test', ...ip(n++) })); ok('cross-origin POST refused', x.s === 403);
  const xn = await call(B, J('/api/builder', { action: 'create', templateId: 'business' }, { origin: 'null', ...ip(n++) })); ok('Origin: null refused', xn.s === 403);
  const U0 = H.req('server/util'); const fake = (h) => ({ headers: { get: (k) => h[k.toLowerCase()] ?? null } });
  ok('browser cross-site request without Origin refused', U0.sameOrigin(fake({ 'sec-fetch-site': 'cross-site', host: 'site.test' })) === false && U0.sameOrigin(fake({ 'sec-fetch-site': 'same-origin', host: 'site.test' })) === true && U0.sameOrigin(fake({ host: 'site.test' })) === true);

  /* 8. ids with traversal never reach the store */
  for (const id of ['../admin', 'PRJ-../..', 'a/b', '%2e%2e', 'PRJ-ABC\u0000D']) { const r = await call(B, J('/api/builder', { action: 'load', id, key: 'x'.repeat(20) }, ip(n++))); if (r.s === 500) ok('traversal id ' + JSON.stringify(id), false); }
  ok('path-traversal ids never crash', true);
  let escaped = false; try { await S.readJson('../etc/passwd', null); escaped = true; } catch { /* checkName throws */ }
  ok('store refuses traversal names', !escaped);

  /* 9. rate-limit map cannot be grown without bound */
  const U = H.req('server/util'); for (let i = 0; i < 40000; i++) U.rateLimit('spray:' + i, 5, 3600_000);
  ok('rate limiter memory is capped', U.__bucketCount ? U.__bucketCount() <= 12000 : false, U.__bucketCount ? String(U.__bucketCount()) : 'no counter exported');
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
