// The editor's double-buffered preview state machine. Run: node tests/build-lib.mjs && node tests/builder.frames.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { frameReducer: R, initialFrames: I } = createRequire(import.meta.url)('./.build/frames.js');
let pass = 0, failed = 0; const t = (n, f) => { try { f(); pass++; console.log('PASS ', n); } catch (e) { failed++; console.log('FAIL ', n, '\n     ', e.message); } };
const run = (evs, s = I) => evs.reduce((st, e) => R(st, e), s);

t('first page goes straight to the visible frame', () => { const s = run([{ t: 'doc', doc: 'A' }]); assert.deepEqual(s, { docs: ['A', ''], front: 0 }); });
t('THE BLANK-FRAME BUG: an empty frame\'s load event (fires at mount) must NOT swap the canvas to a blank page', () => {
  assert.deepEqual(run([{ t: 'load', i: 1 }]), I, 'before any page');
  const s = run([{ t: 'doc', doc: 'A' }, { t: 'load', i: 1 }, { t: 'load', i: 0 }, { t: 'load', i: 1 }]); assert.equal(s.front, 0); assert.equal(s.docs[s.front], 'A', 'still showing the page');
});
t('update loads in the hidden frame; swap happens only when it has loaded; old page is released', () => {
  let s = run([{ t: 'doc', doc: 'A' }, { t: 'doc', doc: 'B' }]); assert.deepEqual(s, { docs: ['A', 'B'], front: 0 }, 'B waits in the back'); assert.equal(R(s, { t: 'load', i: 0 }).front, 0, 'front re-load changes nothing');
  s = R(s, { t: 'load', i: 1 }); assert.deepEqual(s, { docs: ['', 'B'], front: 1 }, 'swapped, A released');
  s = run([{ t: 'doc', doc: 'C' }, { t: 'load', i: 0 }], s); assert.deepEqual(s, { docs: ['C', ''], front: 0 }, 'next update ping-pongs back to frame 0');
});
t('ping-pong over 200 updates: the visible frame ALWAYS holds the latest loaded page and is never empty', () => {
  let s = run([{ t: 'doc', doc: 'v0' }]); for (let n = 1; n <= 200; n++) { s = R(s, { t: 'doc', doc: 'v' + n }); assert.ok(s.docs[s.front], 'front empty at ' + n); const back = 1 - s.front; s = R(s, { t: 'load', i: back }); assert.equal(s.docs[s.front], 'v' + n); assert.equal(s.docs[1 - s.front], '', 'old page released'); }
});
t('rapid edits: a newer doc replaces a pending one in the back frame (only the latest ever shows)', () => {
  let s = run([{ t: 'doc', doc: 'A' }, { t: 'doc', doc: 'B' }, { t: 'doc', doc: 'C' }, { t: 'doc', doc: 'D' }]); assert.deepEqual(s.docs, ['A', 'D']); s = R(s, { t: 'load', i: 1 }); assert.equal(s.docs[s.front], 'D');
});
t('undo back to what is already showing cancels the pending page (so a stale load can\'t swap an old page in)', () => {
  let s = run([{ t: 'doc', doc: 'A' }, { t: 'doc', doc: 'B' }, { t: 'doc', doc: 'A' }]); assert.deepEqual(s, { docs: ['A', ''], front: 0 }); assert.equal(R(s, { t: 'load', i: 1 }).front, 0, 'the cancelled frame\'s load is ignored');
});
t('duplicate docs are no-ops (no needless reloads)', () => { const s = run([{ t: 'doc', doc: 'A' }, { t: 'doc', doc: 'B' }]); assert.equal(R(s, { t: 'doc', doc: 'B' }), s); assert.equal(R(run([{ t: 'doc', doc: 'A' }]), { t: 'doc', doc: 'A' }).docs[0], 'A'); });
t('FUZZ 20,000 random events: the visible frame is never empty once a page exists; never throws', () => {
  let s = I, seen = false; for (let n = 0; n < 20000; n++) { const e = Math.random() < 0.5 ? { t: 'doc', doc: 'd' + Math.floor(Math.random() * 6) } : { t: 'load', i: Math.random() < 0.5 ? 0 : 1 }; if (e.t === 'doc') seen = true; s = R(s, e); if (seen) assert.ok(s.docs[s.front], 'blank canvas after ' + n + ' events: ' + JSON.stringify(s)); }
});
console.log(`\n${pass} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
