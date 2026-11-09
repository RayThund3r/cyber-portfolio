// Run once (needs internet):  node scripts/vendor-bootstrap.mjs
// Downloads Bootstrap into public/vendor/bootstrap so downloaded customer sites work fully offline.
// Without it, exported sites load Bootstrap from the jsDelivr CDN (still fine, just needs internet).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const V = '5.3.3';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'vendor', 'bootstrap');
await mkdir(dir, { recursive: true });
for (const [file, url] of [
  ['bootstrap.min.css', `https://cdn.jsdelivr.net/npm/bootstrap@${V}/dist/css/bootstrap.min.css`],
  ['bootstrap.bundle.min.js', `https://cdn.jsdelivr.net/npm/bootstrap@${V}/dist/js/bootstrap.bundle.min.js`],
]) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  await writeFile(join(dir, file), Buffer.from(await r.arrayBuffer()));
  console.log('saved', file);
}
console.log(`Bootstrap ${V} ready in public/vendor/bootstrap`);
