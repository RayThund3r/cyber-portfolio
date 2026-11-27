// Source scan: no emoji anywhere in the app, the chat texts, the builder data or the generated-site engine.
const fs = require('fs'), path = require('path');
const EMOJI = /(?:[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[⭐⬆⬇⏰⏱⏳⌚✅❌❓❗❤↩↪⧉✎])️?/u;
const ROOTS = ['src', 'engine'];
// allowed: the emoji->icon table itself, the speech cleaner's patterns, and the studio engine's glyph keys (turned into SVG icons at run time)
const ALLOW = [/lib\/icons\.ts$/, /speechText\.ts$/, /studio\/engineData\.ts$/];
let files = 0, bad = [];
const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(tsx|ts|js|css)$/.test(n)) scan(p); } };
const scan = (p) => {
  if (ALLOW.some((r) => r.test(p))) return;
  files++;
  fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    const m = EMOJI.exec(l);
    if (m) bad.push(`${p}:${i + 1} ${m[0]} ${t.slice(0, 80)}`);
  });
};
ROOTS.forEach((r) => fs.existsSync(r) && walk(r));
console.log(`scanned ${files} files`);
bad.forEach((b) => console.log('EMOJI ' + b));
console.log(bad.length ? `FAIL ${bad.length} emoji in the interface` : 'PASS no emoji in the interface');
process.exit(bad.length ? 1 : 0);
