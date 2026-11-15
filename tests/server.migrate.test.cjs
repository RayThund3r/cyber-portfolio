// Projects saved by the previous version (pictures inside the project file) migrate automatically.
const H = require('./server-setup.cjs'); const { ok } = H; const fs = require('fs'); const P = H.req('server/projects');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64').toString('base64');
(async () => {
  const { id, key } = await P.createProject('business'); const f = `${H.DATA}/projects/${id}.json`; const j = JSON.parse(fs.readFileSync(f));
  j.assets = { abcd1234: { mime: 'image/png', data: png } }; delete j.rev; j.config.brand.logo = 'asset:abcd1234'; fs.writeFileSync(f, JSON.stringify(j));
  const p = await P.authProject(id, key);
  ok('legacy project opens with its picture', !!p && p.assets.abcd1234.bytes > 0 && !('data' in p.assets.abcd1234));
  ok('picture moved to its own file', !!(await P.readAsset(id, 'abcd1234')) && fs.existsSync(`${H.DATA}/assets/${id}/abcd1234.json`));
  ok('project file no longer contains the base64', !fs.readFileSync(f, 'utf8').includes(png));
  const urls = await P.assetDataUrls(p); ok('editor receives the picture as a data URL', urls.abcd1234.startsWith('data:image/png;base64,'));
  const s = await P.saveProject(id, key, { config: p.config }); ok('saving works after migration', s.rev === 1);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
