// Serves the REAL compiled API route handlers over HTTP (no Next.js needed) so scripts/stress.mjs can be exercised offline.
//   node tests/build-server.mjs && node tests/http-harness.cjs 8787
process.env.CLOUD_SITE_HOURLY_LIMIT = process.env.CLOUD_SITE_HOURLY_LIMIT || '1000000000'; // load tests must not hit the per-shop hourly cap (the cap itself is tested in server.cloud.test.cjs)
const http = require('http'); const H = require('./server-setup.cjs');
global.fetch = async (u) => { if (String(u).includes('er-api')) return { ok: true, json: async () => ({ result: 'success', time_last_update_unix: 1760000000, rates: { UGX: 3700, KES: 129, USD: 1, EUR: 0.92 } }) }; throw new Error('offline'); };
const R = (p) => H.req('app/api/' + p + '/route');
const routes = { '/api/builder': R('builder'), '/api/builder/templates': R('builder/templates'), '/api/builder/download': R('builder/download'), '/api/rates': R('rates'), '/api/ev': R('ev'), '/api/track': R('track'), '/api/pay': R('pay'), '/api/contact': R('contact'), '/api/slots': R('slots'), '/api/site': R('site') };
// demo cloud site for scripts/stress.mjs:  id "stressdemo", owner token = sha256("stressdemo:cloud:stress-pass")
(async () => { const C = H.req('server/cloud'), crypto = require('crypto'); const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
  await C.registerSite({ id: 'stressdemo', projectId: 'PRJ-STRESS', name: 'Stress Demo', ownerEmail: '', verifier: sha('v:' + sha('stressdemo:cloud:stress-pass')) }); })();
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'); const mod = routes[url.pathname]; const m = req.method;
  if (!mod || !mod[m]) { res.writeHead(404); return res.end('{}'); }
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
  try {
    const r = await mod[m](new Request(url, { method: m, headers: { ...req.headers }, body: m === 'GET' ? undefined : body }));
    const isBin = r.body instanceof Uint8Array; res.writeHead(r.status, r.headers); res.end(isBin ? Buffer.from(r.body) : r.body === null ? '' : JSON.stringify(r.body));
  } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: String(e.message) })); }
}).listen(+process.argv[2] || 8787, () => console.log('harness listening on', process.argv[2] || 8787, 'data dir', H.DATA));
