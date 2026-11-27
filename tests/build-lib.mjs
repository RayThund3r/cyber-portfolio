// Transpiles src/lib/builder/*.ts → tests/.build/*.js (no type-check; uses the project's own TypeScript).
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
let ts; for (const p of [undefined, join(here, '..'), '/home/claude/.npm-global/lib/node_modules']) { try { ts = require(p ? require.resolve('typescript', { paths: [p] }) : 'typescript'); break; } catch { /* try next */ } }
if (!ts) { console.error('typescript is required (npm i -D typescript)'); process.exit(1); }
const src = join(here, '..', 'src', 'lib', 'builder'), out = join(here, '.build');
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
for (const f of readdirSync(src).filter((x) => x.endsWith('.ts'))) {
  const r = ts.transpileModule(readFileSync(join(src, f), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: false }, fileName: f });
  writeFileSync(join(out, f.replace(/\.ts$/, '.js')), r.outputText.replace(/require\((['"])\.\.\/icons\1\)/g, "require('./icons')"));
}
{ const f = join(here, '..', 'src', 'lib', 'icons.ts'); writeFileSync(join(out, 'icons.js'), ts.transpileModule(readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: 'icons.ts' }).outputText); }
console.log('builder library transpiled →', out);
