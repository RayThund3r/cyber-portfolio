// AI Providers: encrypted keys, on/off, order, caps, SSRF guard, fallback when a service fails, master switch.
const H = require('./server-setup.cjs'); const { ok } = H; const fs = require('fs');
const P = H.req('server/llmProviders');
const sse = (txt) => new Response(new ReadableStream({ start(c) { const e = new TextEncoder(); c.enqueue(e.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: txt } }] })}\n\ndata: [DONE]\n\n`)); c.close(); } }), { status: 200 });
const calls = []; let plan = {};
global.fetch = async (url, init) => { const host = new URL(url).host; calls.push({ host, body: JSON.parse(init.body), auth: init.headers.Authorization }); const r = plan[host]; if (r && r.status) return new Response(r.body || 'err', { status: r.status }); return sse('hi from ' + host); };
const drain = async (res) => { let t = ''; const r = res.body.getReader(); const d = new TextDecoder(); for (;;) { const { done, value } = await r.read(); if (done) break; t += d.decode(value); } return t; };
(async () => {
  ok('no providers at first', (await P.candidates()).length === 0 && !(await P.anyAvailable()).available);
  let e1 = null; try { await P.saveProvider({ id: 'groq', enabled: true }); } catch (e) { e1 = e; }
  ok('cannot switch on without a key', e1 && e1.status === 400);
  await P.saveProvider({ id: 'groq', key: 'gsk_test_key_AAAA1111', enabled: true, model: 'llama-x', dailyCap: 2 });
  await P.saveProvider({ id: 'mistral', key: 'mistral_key_BBBB2222', enabled: true });
  const raw = fs.readdirSync(H.DATA).map((f) => fs.readFileSync(H.DATA + '/' + f, 'utf8')).join('');
  ok('keys are encrypted at rest', !raw.includes('gsk_test_key_AAAA1111') && !raw.includes('mistral_key_BBBB2222'));
  ok('key round-trips', (await P.candidates())[0].target.key === 'gsk_test_key_AAAA1111');
  let e2 = null; try { await P.saveProvider({ id: 'groq', key: 'a b' }); } catch (e) { e2 = e; }
  ok('junk key rejected', e2 && e2.status === 400);
  const ac = new AbortController();
  let r = await P.streamWithFallback([{ role: 'user', content: 'x' }], ac.signal);
  ok('first enabled provider answers, hosted API gets no llama-only fields', r.via === 'groq' && !('repeat_penalty' in calls[0].body) && calls[0].auth === 'Bearer gsk_test_key_AAAA1111' && (await drain(r.res)).includes('hi from api.groq.com'));
  plan['api.groq.com'] = { status: 429, body: 'rate limited' };
  r = await P.streamWithFallback([{ role: 'user', content: 'x' }], ac.signal);
  ok('rate-limited provider falls through to the next', r.via === 'mistral');
  ok('failing provider rests (skipped) afterwards', (await P.candidates()).every((c) => c.id !== 'groq'));
  await new Promise((r) => setTimeout(r, 80)); const use = await P.usageToday();
  ok('usage counts ok/fail', use.by.groq.ok >= 1 && use.by.groq.fail === 1 && use.by.mistral.ok === 1);
  P.clearCooldowns(); plan = {};
  await P.setOrder(['mistral', 'groq']);
  ok('priority order respected', (await P.candidates())[0].id === 'mistral');
  await P.saveProvider({ id: 'mistral', dailyCap: 1 });
  await P.streamWithFallback([{ role: 'user', content: 'x' }], ac.signal);
  await new Promise((r) => setTimeout(r, 80));
  ok('daily cap stops a provider once reached', (await P.candidates()).every((c) => c.id !== 'mistral'));
  const t = await P.testProvider('groq'); ok('test button works', t.ok && /hi from/.test(t.text));
  plan['api.groq.com'] = { status: 401, body: 'bad key' }; const t2 = await P.testProvider('groq');
  ok('test button explains refused key', !t2.ok && /refused/.test(t2.error), t2.error);
  plan = {};
  ok('SSRF guard: http / private hosts refused', ['http://api.x.com/v1', 'https://localhost/v1', 'https://127.0.0.1/v1', 'https://192.168.1.5/v1', 'https://10.0.0.2/v1', 'https://169.254.169.254/latest', 'https://u:p@x.com/v1', 'nonsense'].every((u) => P.cleanBaseUrl(u) === null) && P.cleanBaseUrl('https://api.example.com/v1/') === 'https://api.example.com/v1');
  let e3 = null; try { await P.addCustom('Bad', 'https://127.0.0.1/v1'); } catch (e) { e3 = e; }
  ok('custom endpoint with private address refused', e3 && e3.status === 400);
  const cid = await P.addCustom('My AI', 'https://api.example.com/v1'); await P.saveProvider({ id: cid, key: 'custom_key_CCCC3333', model: 'm1', enabled: true });
  ok('custom endpoint works, /chat/completions added', (await P.candidates()).some((c) => c.id === cid && c.target.url === 'https://api.example.com/v1/chat/completions'));
  await P.removeCustom(cid); ok('custom endpoint can be removed', !(await P.getDb()).items[cid]);
  await P.setMaster(false); ok('master switch turns everything off', (await P.candidates()).length === 0);
  await P.setMaster(true);
  await P.saveProvider({ id: 'groq', clearKey: true, enabled: false }); ok('removing a key works', !(await P.candidates()).some((c) => c.id === 'groq'));
  plan = { 'api.mistral.ai': { status: 500 } }; P.clearCooldowns(); await P.saveProvider({ id: 'mistral', dailyCap: 0 });
  let e4 = null; try { await P.streamWithFallback([{ role: 'user', content: 'x' }], ac.signal); } catch (e) { e4 = e; }
  ok('when every provider fails it throws (chat then uses built-in engine)', !!e4);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
