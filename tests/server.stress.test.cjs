// Stress: lots of parallel, hostile and malformed traffic. Nothing may 500, hang, lose an update or corrupt a record.
const H = require('./server-setup.cjs'); const { ok } = H;
const J = (u, b, h = {}) => new Request('http://site.test' + u, { method: 'POST', headers: { 'content-type': 'application/json', host: 'site.test', origin: 'http://site.test', ...h }, body: typeof b === 'string' ? b : JSON.stringify(b) });
(async () => {
  const B = H.req('app/api/builder/route'), P = H.req('server/projects'), A = H.req('server/aiAccess');
  const call = async (b, ip) => { const r = await B.POST(J('/api/builder', b, { 'x-forwarded-for': ip })); return { s: r.status, b: r.body }; };
  const c = await P.createProject('business'); const base = (await P.authProject(c.id, c.key));
  /* parallel saves with the same revision: exactly one may win, the rest must be told "conflict" (no lost update, no 500) */
  const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => call({ action: 'save', id: c.id, key: c.key, baseRev: base.rev, config: base.config }, `3.3.${i}.1`)));
  const wins = rs.filter((r) => r.s === 200).length, conf = rs.filter((r) => r.s === 409).length, bad = rs.filter((r) => r.s >= 500).length;
  const after = await P.authProject(c.id, c.key);
  ok('40 racing saves on one revision: one winner, rest conflict, no 500s', wins === 1 && conf === 39 && bad === 0 && after.rev === base.rev + 1, `wins=${wins} conf=${conf} 5xx=${bad} rev ${base.rev}->${after.rev}`);
  /* parallel redemptions of one single-device pass from many devices: never more devices than allowed */
  const cfg = await A.getConfig(); const pass = A.makePass(null, { messages: 5, days: 1 });
  await H.req('server/store').update('ai-access-passes', { passes: {}, byDevice: {}, requests: [] }, (d) => { d.passes[pass.code] = pass; });
  const devs = Array.from({ length: 30 }, (_, i) => ({ id: 'dev' + i, fresh: false, cookie: '' }));
  const outs = await Promise.all(devs.map((d) => A.redeem(pass.code, d)));
  const okc = outs.filter((o) => o.ok).length;
  ok('30 devices racing to redeem one pass: never above the device limit', okc >= 1 && okc <= cfg.maxDevicesPerPass, `accepted=${okc} limit=${cfg.maxDevicesPerPass}`);
  /* malformed bodies */
  const junk = ['', '{', '[]', 'null', '"x"', '{"action":[]}', '{"action":{"toString":1}}', '{"action":"load","id":{"a":1},"key":[1]}', '{"action":"save","id":"PRJ-AAAAAA"}', '\u0000\u0001', '{"action":"create","templateId":{"x":1}}', '{"action":"order","id":1,"key":2,"contact":{"name":{}}}'];
  let five = 0; for (const j of junk) { const r = await B.POST(J('/api/builder', j, { 'x-forwarded-for': '4.4.4.' + (five + 1) })); if (r.status >= 500) five++; }
  ok('malformed bodies never produce a server error', five === 0, `5xx=${five}`);
  /* unicode / giant strings in names */
  const r = await call({ action: 'create', templateId: 'business', name: '🔥'.repeat(5000) + '‮<script>' }, '5.5.5.5');
  ok('giant/odd names are clipped, not stored raw', r.s === 200 || r.s === 400);
  if (r.s === 200) { const pr = await P.authProject(r.b.id, r.b.key); ok('stored name is short and has no control chars', pr.name.length <= 60 && !/[\u0000-\u001f‮]/.test(pr.name), pr.name.length + ''); }
  /* request flood: the limiter answers 429, never crashes */
  let limited = 0; for (let i = 0; i < 300; i++) { const rr = await B.POST(J('/api/builder', { action: 'create', templateId: 'business' }, { 'x-forwarded-for': '6.6.6.6' })); if (rr.status === 429) limited++; }
  ok('300-request flood from one address is rate limited', limited >= 250, `limited=${limited}`);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
