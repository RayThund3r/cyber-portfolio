// One command for every automated check:  node tests/run-all.mjs        (add --stress to include two 15 s / 60-user load tests)
import { spawnSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (label, args, env = {}) => {
  const t = Date.now(); const r = spawnSync('node', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || ''); const pass = (out.match(/^PASS /gm) || []).length, fail = (out.match(/^FAIL |CRASH/gm) || []).length;
  const summary = out.split('\n').reverse().find((l) => /\d+ (core tests )?passed/.test(l));
  console.log(`${r.status === 0 ? '✅' : '❌'} ${label.padEnd(38)} ${summary ? summary.trim().padEnd(26) : `${pass} checks`.padEnd(26)} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  if (r.status !== 0) console.log(out.split('\n').filter((l) => /FAIL|CRASH|Error/.test(l)).slice(0, 8).map((l) => '     ' + l).join('\n'));
  return r.status === 0;
};
console.log('Building…');
let ok = [run('compile engine → generator', ['scripts/build-engine.mjs']), run('transpile builder library', ['tests/build-lib.mjs']), run('transpile server code', ['tests/build-server.mjs'])].every(Boolean);
if (!ok) process.exit(1);
console.log('\nTests:');
const results = [
  run('engine core (property tests)', ['tests/engine.core.test.mjs']),
  run('engine end-to-end (DOM)', ['--max-old-space-size=900', 'tests/engine.app.test.mjs']),
  run('engine ⇄ cloud inbox (real server code)', ['--max-old-space-size=900', 'tests/engine.cloud.test.mjs']),
  run('builder / Pro pipeline', ['--max-old-space-size=900', 'tests/builder.pro.test.mjs']),
  run('server: storage / tickets / fuzz', ['tests/server.storage.test.cjs']),
  run('server: legacy migration', ['tests/server.migrate.test.cjs']),
  run('server: Pro order → payment → zip', ['tests/server.pro.test.cjs']),
  run('server: ai providers', ['tests/server.providers.test.cjs']),
  run('builder layouts', ['tests/builder.layouts.test.cjs']),
  run('server: launch pad', ['tests/server.launch.test.cjs']),
  run('server: assistant knowledge', ['tests/server.chatkb.test.cjs']),
  run('server: voice text', ['tests/server.voice.test.cjs']),
  run('server: file reading', ['tests/server.files.test.cjs']),
  run('server: chat hand-off text', ['tests/server.handoff.test.cjs']),
  run('server: site settings', ['tests/server.settings.test.cjs']),
  run('server: site content', ['tests/server.content.test.cjs']),
  run('server: saved admin login', ['tests/server.creds.test.cjs']),
  run('server: world knowledge', ['tests/server.world.test.cjs']),
  run('server: web answers', ['tests/server.webanswer.test.cjs']),
  run('server: stress', ['tests/server.stress.test.cjs']),
  run('server: attack battery', ['tests/server.attack.test.cjs']),
  run('server: restore after wipe', ['tests/server.restore.test.cjs']),
  run('server: cloud inbox', ['tests/server.cloud.test.cjs']),
  run('server: AI route', ['tests/server.ai.test.cjs']),
];
ok = results.every(Boolean);
if (process.argv.includes('--stress')) {
  console.log('\nStress (local harness):');
  const h = spawn('node', ['tests/http-harness.cjs', '8799'], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2000));
  ok = run('load test: builder, 60 users × 15 s', ['scripts/stress.mjs', 'http://localhost:8799', '--users', '60', '--seconds', '15']) && ok;
  ok = run('load test: cloud inbox, 60 users × 15 s', ['scripts/stress.mjs', 'http://localhost:8799', '--cloud', '--users', '60', '--seconds', '15']) && ok;
  h.kill();
}
console.log(ok ? '\nALL GREEN ✅' : '\nSOMETHING FAILED ❌'); process.exit(ok ? 0 : 1);
