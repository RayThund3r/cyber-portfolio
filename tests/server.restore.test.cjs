// Restore: a site the server forgot (e.g. disk wiped) is put back from the browser's copy, under the same id + key, and can't hijack anyone else's.
const H = require('./server-setup.cjs'); const { ok } = H; const fs = require('fs');
const P = H.req('server/projects'), S = H.req('server/store');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
(async () => {
  const c = await P.createProject('business'); const up = await P.addAsset(c.id, c.key, 'image/png', png);
  const p = await P.authProject(c.id, c.key); const cfg = JSON.parse(JSON.stringify(p.config)); cfg.name = cfg.name; await P.saveProject(c.id, c.key, { config: cfg });
  const keep = JSON.parse(JSON.stringify((await P.authProject(c.id, c.key)).config));
  // simulate the wipe
  await S.removeJson('projects/' + c.id);
  ok('server really forgot the site', (await P.authProject(c.id, c.key)) === null);
  const r = await P.restoreProject(c.id, c.key, { templateId: 'business', name: 'My shop', config: keep, assetIds: [up.id] });
  ok('restore succeeds', r.ok === true && r.existed === false, JSON.stringify(r));
  const back = await P.authProject(c.id, c.key);
  ok('same id + same key work again, name kept', !!back && back.name === 'My shop' && back.templateId === 'business');
  ok('wrong key still rejected', (await P.authProject(c.id, 'x'.repeat(20))) === null);
  const a = await P.restoreAsset(c.id, c.key, up.id, 'image/png', png);
  ok('picture comes back under its ORIGINAL id', a.id === up.id && !!(await P.authProject(c.id, c.key)).assets[up.id]);
  ok('restoring a picture twice is harmless', (await P.restoreAsset(c.id, c.key, up.id, 'image/png', png)).id === up.id);
  ok('restoring an existing site with the same key is a no-op success', (await P.restoreProject(c.id, c.key, { config: keep })).existed === true);
  const hij = await P.restoreProject(c.id, 'Z'.repeat(20), { config: keep });
  ok('someone else cannot take over an existing id (409)', hij.status === 409, JSON.stringify(hij));
  ok('bad id / short key rejected', (await P.restoreProject('nope', c.key, { config: keep })).status === 400 && (await P.restoreProject('PRJ-ABCDEF', 'short', { config: keep })).status === 400);
  ok('garbage config rejected, nothing created', (await P.restoreProject('PRJ-QQQQQQ', 'k'.repeat(20), { config: 'oops' })).status === 400 && (await P.restoreProject('PRJ-QQQQQQ', 'k'.repeat(20), { config: {} })).status === 400 && (await P.loadProject('PRJ-QQQQQQ')) === null);
  ok('bad picture rejected', !!(await P.restoreAsset(c.id, c.key, 'abcd1234', 'image/png', 'AAAA')).error);
  // concurrent restores: exactly one record, no crash
  const k = 'k'.repeat(20); const rs = await Promise.all([1, 2, 3].map(() => P.restoreProject('PRJ-RACE22', k, { config: keep })));
  ok('racing restores all succeed with the same key', rs.every((x) => x.ok), JSON.stringify(rs));
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
