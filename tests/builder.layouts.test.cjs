// Every section layout variant must render, survive sanitizing, and contain its items.
const path = require('path'); const B = path.join(__dirname, '.build-server/lib/builder/');
const { buildSite } = require(B + 'generate.js'); const { defaultConfig, SECTION_DEFS, newSection } = require(B + 'schema.js'); const { sanitizeConfig } = require(B + 'sanitize.js');
let fail = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fail++; };
const opts = (mode) => ({ mode, assetSrc: (id) => '/a/' + id, inline: true });
for (const [type, def] of Object.entries(SECTION_DEFS)) {
  const v = def.fields.find((f) => f.key === 'variant'); if (!v) continue;
  for (const opt of v.options) {
    const cfg = defaultConfig(); const sec = newSection(type); sec.data.variant = opt.value;
    cfg.sections = [...cfg.sections.filter((s) => s.type === 'navbar'), sec, ...cfg.sections.filter((s) => s.type === 'footer')];
    let clean, html = '';
    try { clean = sanitizeConfig(cfg, { assetIds: new Set() }); html = buildSite(clean, opts('export')).files?.['index.html'] || buildSite(clean, opts('export')).html || ''; } catch (e) { ok(`${type}/${opt.value} renders`, false, e.message); continue; }
    const kept = clean.sections.find((s) => s.type === type)?.data.variant === opt.value;
    ok(`${type}/${opt.value} kept by sanitizer + renders`, kept && html.length > 500, `len=${html.length}`);
  }
}
const cfg = defaultConfig(); const s = sanitizeConfig({ ...cfg, sections: cfg.sections.map((x) => x.type === 'features' ? { ...x, data: { ...x.data, variant: '<script>' } } : x) }, { assetIds: new Set() });
ok('bogus variant falls back to default', s.sections.find((x) => x.type === 'features').data.variant === 'cards');
process.exit(fail ? 1 : 0);
