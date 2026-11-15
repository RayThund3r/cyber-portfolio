// Transpiles the server code under test → tests/.build-server (keeps the src/ layout so the "@/…" alias can be mapped).
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url), root = join(here, '..', 'src'), out = join(here, '.build-server');
let ts; for (const p of [undefined, join(here, '..'), '/home/claude/.npm-global/lib/node_modules']) { try { ts = require(p ? require.resolve('typescript', { paths: [p] }) : 'typescript'); break; } catch { /* next */ } }
if (!ts) { console.error('typescript is required'); process.exit(1); }
rmSync(out, { recursive: true, force: true });
const walk = (d) => readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : f.endsWith('.ts') ? [f] : []; });
const want = ['server', 'lib', 'data', join('app', 'api')].map((x) => join(root, x));
let n = 0;
for (const f of want.flatMap(walk)) {
  const dest = join(out, relative(root, f).replace(/\.ts$/, '.js')); mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, ts.transpileModule(readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: f }).outputText); n++;
}
console.log(`server code transpiled: ${n} files → tests/.build-server`);
