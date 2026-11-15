// Load / stress test for the website builder API.
//   node scripts/stress.mjs http://localhost:3000 [--users 100] [--seconds 20]
// Each virtual user behaves like a real visitor: browse templates → start a project → edit & autosave many times →
// upload a picture → track an order → rates/analytics pings. Latency percentiles, throughput and error rate are reported.
// Each user sends its own X-Forwarded-For so per-IP rate limits treat them as separate visitors (works when your server
// trusts that header, which is the default). Exit code 1 if the error rate is above 1%, p95 latency is above 3s, or the abuse limiter does not trigger.
import { createHash } from 'node:crypto';
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? Number(process.argv[i + 1]) : d; };
const USERS = arg('users', 50), SECONDS = arg('seconds', 15);
const CLOUD = process.argv.includes('--cloud');   // --cloud = load-test the cloud inbox instead of the builder
const argS = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const SITE_ID = argS('site', 'stressdemo'), SITE_PASS = argS('pass', 'stress-pass');   // a registered Pro site (the local harness registers 'stressdemo')
const sha = (x) => createHash('sha256').update(x).digest('hex'); const TOKEN = sha(`${SITE_ID}:cloud:${SITE_PASS}`);
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const stats = new Map(); let total = 0, bad = 0; const end = Date.now() + SECONDS * 1000;
const rec = (name, ms, status, expected) => { const s = stats.get(name) || { ms: [], codes: {}, errors: 0 }; s.ms.push(ms); s.codes[status] = (s.codes[status] || 0) + 1; if (!expected.includes(status)) { s.errors++; bad++; } stats.set(name, s); total++; };
async function call(user, name, path, body, expected = [200], method = body === undefined ? 'GET' : 'POST') {
  const t = performance.now(); let status = 0;
  try { const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': user.ip, origin: base }, body: body === undefined ? undefined : JSON.stringify(body) }); status = r.status; const text = await r.text(); try { return { status, data: JSON.parse(text) }; } catch { return { status, data: null }; } }
  catch { status = 0; return { status, data: null }; } finally { rec(name, performance.now() - t, status, expected); }
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const FUTURE = (d) => { const t = new Date(Date.now() + d * 864e5); return t.toISOString().slice(0, 10); };
async function cloudVisitor() {
  while (Date.now() < end) {
    const n = ++journey; const u = { ip: `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}` }; const date = FUTURE(2 + (n % 20)), time = `${String(8 + (n % 12)).padStart(2, '0')}:${n % 2 ? '00' : '30'}`;
    const site = (action, extra, expected = [200], name) => call(u, name || `cloud ${action}`, '/api/site', { id: SITE_ID, action, ...extra }, expected);
    await call(u, 'cloud GET slots', `/api/site?id=${SITE_ID}&date=${date}`, undefined, [200]);
    const phone = '07' + String(10000000 + (n % 89999999)), ref = 'ORD-S' + n.toString(36).toUpperCase().padStart(5, '0');
    const o = await site('submit', { kind: 'order', data: { ref, name: 'Stress ' + n, phone, items: [{ id: 'p1', n: 'Bread', p: 4000, q: 2 }], fee: 3000, pay: 'mtn' } }, [200], 'cloud submit order');
    await site('submit', { kind: 'booking', data: { name: 'Stress ' + n, phone, svc: 'Cut', date, time } }, [200, 409], 'cloud submit booking (409 = slot taken, expected)');
    await site('submit', { kind: 'enquiry', data: { name: 'Stress ' + n, contact: phone, msg: 'Please quote for 50 units' } }, [200], 'cloud submit enquiry');
    await site('submit', { kind: 'sub', data: { email: `s${n}@stress.test` } }, [200], 'cloud submit subscriber');
    await site('track', { ref: o.data?.ref || ref, phone }, [200], 'cloud track own order');
    await site('track', { ref, phone: '0700000000' }, [404], 'cloud track WRONG phone (404 expected)');
    if (n % 5 === 0) { const l = await site('owner.list', { token: TOKEN }, [200], 'cloud OWNER list (whole inbox)'); const first = l.data?.orders?.[0]; if (first) await site('owner.update', { token: TOKEN, kind: 'order', ref: first.ref, status: 'Paid' }, [200], 'cloud OWNER update status'); }
    await site('owner.list', { token: 'f'.repeat(64) }, [401, 429], 'cloud wrong owner token (401 expected)');
  }
}
let journey = 0;
async function visitor(i) {
  while (Date.now() < end) {
    const n = ++journey; const u = { ip: `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}` }; // every journey = a brand-new visitor
    const tpls = (await call(u, 'GET templates', '/api/builder/templates')).data?.templates || []; if (!tpls.length) continue;
    await call(u, 'GET rates', '/api/rates'); await call(u, 'POST analytics', '/api/ev', { t: 'view', p: '/builder' }, [200, 204]);
    const c = await call(u, 'POST create project', '/api/builder', { action: 'create', templateId: pick(tpls).id }); if (!c.data?.id) continue;
    const { id, key } = c.data; const l = await call(u, 'POST load project', '/api/builder', { action: 'load', id, key }); if (!l.data?.config) continue;
    let cfg = l.data.config, rev = l.data.rev;
    await call(u, 'POST upload picture', '/api/builder', { action: 'upload', id, key, mime: 'image/png', data: PNG });
    for (let k = 0; k < 6 && Date.now() < end; k++) { // autosave bursts, like typing
      if (cfg.kind === 'pro') cfg.pro.business.name = 'Stress ' + Math.random().toString(36).slice(2, 6); else cfg.brand.name = 'Stress ' + Math.random().toString(36).slice(2, 6);
      const s = await call(u, 'POST autosave', '/api/builder', { action: 'save', id, key, config: cfg, baseRev: rev }, [200]); if (s.data?.rev) rev = s.data.rev;
    }
    await call(u, 'POST wrong key (must 404)', '/api/builder', { action: 'load', id, key: 'x'.repeat(20) }, [404]);
    await call(u, 'POST order (priced/unpriced)', '/api/builder', { action: 'order', id, key, name: 'Stress', email: '', phone: '0700123456' }, [200, 409]);
    await call(u, 'POST download unpaid (must 402)', '/api/builder/download', { project: id, key }, [402]);
    await call(u, 'POST track bad ref (must 404)', '/api/track', { ticket: 'SYS-NOPE', contact: '0700000000' }, [404]);
    await call(u, 'POST malformed JSON (must 400)', '/api/builder', undefined, [400, 405], 'POST');
  }
}
const q = (a, p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
console.log(`Stress test (${CLOUD ? 'cloud inbox' : 'builder'}) → ${base}\n${USERS} virtual users · ${SECONDS}s\n`);
const t0 = Date.now(); await Promise.all(Array.from({ length: USERS }, (_, i) => (CLOUD ? cloudVisitor() : visitor(i)))); const dur = (Date.now() - t0) / 1000;
// Abuse probe: ONE address hammering 'create project' must get throttled (the limiter protects your server and disk).
let throttled = 0; if (CLOUD) {
  // cloud abuse probes: one address flooding submissions, and one address guessing owner tokens
  const flooder = { ip: '203.0.113.50' }; for (let i = 0; i < 45; i++) { const r = await call(flooder, 'ABUSE one IP floods cloud submissions (429 after 30)', '/api/site', { id: SITE_ID, action: 'submit', kind: 'sub', data: { email: `f${i}@abuse.test` } }, [200, 429]); if (r.status === 429) throttled++; }
  const guesser = { ip: '203.0.113.51' }; let locked = 0; for (let i = 0; i < 14; i++) { const r = await call(guesser, 'ABUSE one IP guesses owner tokens (locked after 10)', '/api/site', { id: SITE_ID, action: 'owner.list', token: sha('guess' + i) }, [401, 429]); if (r.status === 429) locked++; }
  const right = await call(guesser, 'ABUSE …correct token while locked is STILL refused', '/api/site', { id: SITE_ID, action: 'owner.list', token: TOKEN }, [429]); if (locked < 3 || right.status !== 429) throttled = 0;
} else { const abuser = { ip: '203.0.113.77' }; for (let i = 0; i < 20; i++) { const r = await call(abuser, 'ABUSE one IP create ×20 (429 expected)', '/api/builder', { action: 'create', templateId: 'blank' }, [200, 429]); if (r.status === 429) throttled++; } }
const rows = [...stats.entries()].map(([n, s]) => { const m = s.ms.sort((a, b) => a - b); return { Endpoint: n, Requests: m.length, 'p50 ms': Math.round(q(m, 50)), 'p95 ms': Math.round(q(m, 95)), 'p99 ms': Math.round(q(m, 99)), Max: Math.round(m[m.length - 1]), Unexpected: s.errors, Codes: Object.entries(s.codes).map(([c, k]) => `${c}×${k}`).join(' ') }; });
console.table(rows);
const all = [...stats.values()].flatMap((s) => s.ms).sort((a, b) => a - b), rate = (bad / total) * 100;
console.log(`\ntotal ${total} requests in ${dur.toFixed(1)}s = ${(total / dur).toFixed(0)} req/s · overall p95 ${Math.round(q(all, 95))} ms · unexpected-response rate ${rate.toFixed(2)}%`);
console.log(`abuse protection: ${throttled} requests from abusive addresses were throttled/locked — ${throttled >= 1 ? 'working' : 'NOT WORKING'}`);
const fail = rate > 1 || q(all, 95) > 3000 || throttled < 1; console.log(fail ? 'RESULT: ❌ FAILED thresholds (error rate > 1%, p95 > 3000 ms, or abuse limiter inactive)' : 'RESULT: ✅ PASSED'); process.exit(fail ? 1 : 0);
