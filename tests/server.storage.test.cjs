// Storage, concurrency, pricing, Office extraction, zip-bomb guard and a 4,000-case fuzz. Run: node tests/build-server.mjs && node tests/server.storage.test.cjs
const H = require('./server-setup.cjs'); const { ok } = H; const fs = require('fs');
const P = H.req('server/projects'), S = H.req('server/store'), R = H.req('server/rates');
const { makeZip } = H.req('server/zip'); const { extractOfficeText } = H.req('server/docx');
const { sanitizeConfig } = H.req('lib/builder/sanitize'); const { buildSite } = H.req('lib/builder/generate'); const { defaultConfig, newSection } = H.req('lib/builder/schema');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64').toString('base64');
(async () => {
  let calls = 0; global.fetch = async (u) => { calls++; if (String(u).includes('er-api')) return { ok: true, json: async () => ({ result: 'success', time_last_update_unix: 1760000000, rates: { UGX: 3650, KES: 129, USD: 1, EUR: 0.92 } }) }; throw new Error('net'); };
  let r = await R.getRates(); ok('rates live', r.source === 'live' && r.rates.UGX === 3650); await R.getRates(); ok('rates cached for an hour (1 fetch)', calls === 1);
  const price = await P.priceNow('business'); ok('business $39 × 3650 → UGX 142,000', price === 142000, `(${price})`);
  const c = await P.createProject('business'); const { id, key } = c;
  ok('wrong key rejected', (await P.authProject(id, 'x'.repeat(20))) === null);
  const up = await P.addAsset(id, key, 'image/png', png); ok('asset stored as its own file', fs.existsSync(`${H.DATA}/assets/${id}/${up.id}.json`) && !fs.readFileSync(`${H.DATA}/projects/${id}.json`, 'utf8').includes(png));
  ok('fake image (SVG with script) refused', 'error' in (await P.addAsset(id, key, 'image/png', Buffer.from('<svg onload=alert(1)>').toString('base64'))));
  let p = await P.authProject(id, key); const cfg = JSON.parse(JSON.stringify(p.config));
  const s1 = await P.saveProject(id, key, { config: cfg, baseRev: p.rev }); ok('save → rev 1', s1.rev === 1);
  const s2 = await P.saveProject(id, key, { config: cfg, baseRev: 0 }); ok('stale tab → conflict (409, current rev reported)', s2.status === 409 && s2.rev === 1);
  const s3 = await P.saveProject(id, key, { config: cfg, baseRev: 0, force: true }); ok('force overwrite → rev 2', s3.rev === 2);
  const dup = await P.duplicateProject(id, key); const pd = await P.authProject(dup.id, dup.key); ok('duplicate has copied picture + its own new key', pd && Object.keys(pd.assets).length === 1 && dup.key !== key && !!(await P.readAsset(dup.id, Object.keys(pd.assets)[0])));
  ok('old key cannot open the copy', (await P.authProject(dup.id, key)) === null);
  ok('delete one picture', (await P.deleteAsset(id, key, up.id)).ok === true && !fs.existsSync(`${H.DATA}/assets/${id}/${up.id}.json`));
  await P.deleteProject(dup.id); ok('delete project removes it and its pictures', !fs.existsSync(`${H.DATA}/assets/${dup.id}`) && !fs.existsSync(`${H.DATA}/projects/${dup.id}.json`));
  const t0 = Date.now(); const base = (await P.authProject(id, key)).rev;
  const saves = Array.from({ length: 300 }, (_, i) => { const cc = JSON.parse(JSON.stringify(cfg)); cc.brand.name = 'Site ' + i; return P.saveProject(id, key, { config: cc, force: true }); });
  const creates = Array.from({ length: 150 }, () => P.createProject('portfolio'));
  const res = await Promise.all([...saves, ...creates]); const after = await P.authProject(id, key);
  ok('300 concurrent saves: none lost, file intact', res.slice(0, 300).filter((x) => x.rev).length === 300 && after.rev === base + 300 && JSON.parse(fs.readFileSync(`${H.DATA}/projects/${id}.json`)).rev === base + 300, `(${Date.now() - t0}ms)`);
  const ids = res.slice(300).map((x) => x.id); ok('150 concurrent creates: unique ids, all readable', new Set(ids).size === 150 && (await Promise.all(ids.map((i) => P.loadProject(i)))).every(Boolean));
  const big = defaultConfig(); big.sections.splice(1, 0, ...Array.from({ length: 60 }, () => newSection('gallery'))); const t1 = Date.now(); const sc = sanitizeConfig(big); buildSite(sc, { mode: 'preview', assetSrc: (i) => i });
  ok('max-size classic site: sanitize + render fast, capped at 40 sections', sc.sections.length <= 40 && Date.now() - t1 < 400, `(${Date.now() - t1}ms)`);
  const docx = makeZip([{ name: 'word/document.xml', data: Buffer.from('<w:document><w:p><w:r><w:t>Mama Pima Bakery &amp; Cafe</w:t></w:r></w:p><w:p><w:r><w:t>Open 7am &lt;daily&gt;</w:t></w:r></w:p></w:document>') }]);
  ok('docx text extracted', extractOfficeText(docx) === 'Mama Pima Bakery & Cafe\nOpen 7am <daily>');
  let blocked = false; try { extractOfficeText(makeZip([{ name: 'word/document.xml', data: Buffer.alloc(40 * 1024 * 1024, 'a') }])); } catch { blocked = true; } ok('zip bomb blocked', blocked);
  let garbage = false; try { extractOfficeText(Buffer.from('not a zip')); } catch { garbage = true; } ok('garbage file rejected cleanly', garbage);
  const { PRESETS } = H.req('lib/builder/templates'); const junk = ['<script>alert(1)</script>', '"onerror="x', 'javascript:alert(1)', null, undefined, 1e99, -1, [], {}, '\u0000\u0001', 'x'.repeat(5000), true, { __proto__: { a: 1 } }, '</style><script>', 'asset:zzzzzzzz', 'https://ok.com/a.png', NaN];
  const rndI = (n) => Math.floor(Math.random() * n); let fails = 0, leaks = 0;
  const mutate = (o) => { if (o && typeof o === 'object') { for (const k of Object.keys(o)) { if (Math.random() < 0.18) o[k] = junk[rndI(junk.length)]; else mutate(o[k]); } } };
  for (let i = 0; i < 4000; i++) { const cfg0 = JSON.parse(JSON.stringify(PRESETS[rndI(PRESETS.length)].config)); mutate(cfg0);
    try { const a = sanitizeConfig(cfg0); const b = sanitizeConfig(a); if (JSON.stringify(a) !== JSON.stringify(b)) fails++;
      for (const m of ['preview', 'view', 'export']) { const html = buildSite(a, { mode: m, assetSrc: (x) => x }).html; const body = (html.split('<body>')[1] || '').replace(/<script[\s\S]*?<\/script>/g, ''); if (!a.sections.some((s) => s.type === 'html') && (/<script>alert/.test(body) || /href="javascript:/i.test(body))) leaks++; } } catch (e) { fails++; if (fails < 3) console.log('   fuzz error:', e.message); } }
  ok('fuzz 4,000 (classic + Pro templates): no crashes, sanitize idempotent', fails === 0, `(failures ${fails})`); ok('fuzz 4,000: no script / javascript: leaks outside the owner\'s own HTML block', leaks === 0, `(leaks ${leaks})`);

  // ───── ticket store: one file per ticket, migration, concurrency, safety ─────
  {
    const fs2 = require('fs'); const T = (n) => `${H.DATA}/tickets/${n}.json`;
    const mk = (i) => S.createTicket({ kind: 'repair', name: 'N' + i, email: '', phone: '0700000000', details: 'd' + i, slot: { date: '2026-12-01', time: ['09:00', '10:00'][i % 2] } });
    const t1 = await mk(1); ok('ticket = its own small file (no global tickets.json)', fs2.existsSync(T(t1.id)) && !fs2.existsSync(`${H.DATA}/tickets.json`));
    ok('findTicket tolerant of case/whitespace; unsafe or unknown ids are simply "not found"', (await S.findTicket(' ' + t1.id.toLowerCase() + ' '))?.id === t1.id && (await S.findTicket('../../etc/passwd')) === undefined && (await S.findTicket('SYS-NOPE00')) === undefined && (await S.findTicket('')) === undefined);
    ok('mutate: updates + timestamps; unknown id → undefined; throwing mutator writes nothing', (await S.mutateTicket(t1.id, (t) => { t.status = 'DIAGNOSING'; }))?.status === 'DIAGNOSING' && (await S.mutateTicket('SYS-NOPE00', () => {})) === undefined && await (async () => { try { await S.mutateTicket(t1.id, (t) => { t.status = 'READY'; throw new Error('boom'); }); } catch { /* expected */ } return (await S.findTicket(t1.id)).status === 'DIAGNOSING'; })());
    const t0 = Date.now(); const many = await Promise.all(Array.from({ length: 400 }, (_, i) => mk(i)));
    ok('400 concurrent creates: all distinct, all on disk', new Set(many.map((t) => t.id)).size === 400 && fs2.readdirSync(`${H.DATA}/tickets`).filter((f) => f.endsWith('.json')).length === 401, `(${Date.now() - t0}ms)`);
    const target = many[0].id; const t2 = Date.now();
    await Promise.all(Array.from({ length: 200 }, (_, i) => S.mutateTicket(target, (t) => { t.history.push({ at: 'x', status: 'RECEIVED', note: 'n' + i }); })));
    ok('200 concurrent updates of ONE ticket: none lost (per-ticket lock)', (await S.findTicket(target)).history.length === 201, `(${Date.now() - t2}ms)`);
    await Promise.all(many.slice(1, 201).map((t, i) => S.mutateTicket(t.id, (x) => { x.adminNotes = 'n' + i; })));
    ok('updates to DIFFERENT tickets run in parallel and stay isolated', (await S.findTicket(many[5].id)).adminNotes === 'n4' && (await S.findTicket(many[250].id)).adminNotes === undefined);
    const list = await S.listTickets(); ok('listTickets: all tickets, newest first', list.length === 401 && list.every((t, i, a) => !i || a[i - 1].createdAt >= t.createdAt));
    const counts = await S.slotCounts('2026-12-01'); ok('slotCounts correct and ignores CANCELLED', counts['09:00'] + counts['10:00'] === 401 - 0 && (await S.mutateTicket(many[1].id, (t) => { t.status = 'CANCELLED'; })) && true);
    await new Promise((r) => setTimeout(r, 1600)); const c2 = await S.slotCounts('2026-12-01'); ok('cancelled ticket frees its slot (cache refreshes)', c2['09:00'] + c2['10:00'] === 400);
    // legacy migration: an old tickets.json becomes per-ticket files, original kept as a backup
    const old = [{ id: 'SYS-LEGACY1', kind: 'design', name: 'Old', email: '', phone: '1', details: 'x', status: 'RECEIVED', payments: [], history: [], createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }];
    fs2.writeFileSync(`${H.DATA}/tickets.json`, JSON.stringify(old)); const mod = H.req('server/store'); // same module instance: force a fresh migration by clearing the "done" flag through a new process-like call
    const { execFileSync } = require('child_process'); const dir = fs2.mkdtempSync(require('os').tmpdir() + '/mig-'); fs2.writeFileSync(dir + '/tickets.json', JSON.stringify(old));
    const out = execFileSync('node', ['-e', `process.env.DATA_DIR=${JSON.stringify(dir)};const H=require(${JSON.stringify(__dirname + '/server-setup.cjs')});process.env.DATA_DIR=${JSON.stringify(dir)};const S=H.req('server/store');S.findTicket('SYS-LEGACY1').then(async t=>{const fs=require('fs');console.log(JSON.stringify({found:t&&t.name,file:fs.existsSync(${JSON.stringify(dir)}+'/tickets/SYS-LEGACY1.json'),backup:fs.existsSync(${JSON.stringify(dir)}+'/tickets-legacy.json'),old:fs.existsSync(${JSON.stringify(dir)}+'/tickets.json')}))})`], { encoding: 'utf8' });
    const m = JSON.parse(out.trim().split('\n').pop()); ok('legacy tickets.json migrated automatically (backup kept, old file retired)', m.found === 'Old' && m.file && m.backup && !m.old, out.trim().split('\n').pop());
  }
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
