// Test harness for the server code: temp data dir, stubs for Next/Resend, and the "@/" alias.
const os = require('os'), fs = require('fs'), path = require('path'), Module = require('module');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sys-test-')); process.env.NODE_ENV = 'test';
const BUILD = path.join(__dirname, '.build-server'); const orig = Module._resolveFilename, origLoad = Module._load;
class NR { constructor(body, init = {}) { this.body = body; this.status = init.status || 200; this.headers = init.headers || {}; } static json(body, init = {}) { return new NR(body, { status: init.status, headers: Object.assign({ 'content-type': 'application/json' }, init.headers) }); } }
const stubs = { 'server-only': {}, resend: { Resend: class { constructor() {} emails = { send: async (m) => { (global.__mails ||= []).push(m); return { error: null }; } }; } }, 'next/headers': { cookies: async () => ({ get() {}, set() {}, delete() {} }) }, 'next/server': { NextResponse: NR }, 'next/cache': { revalidatePath() {} } };
Module._resolveFilename = function (r, ...a) { if (r in stubs) return r; if (r.startsWith('@/')) r = path.join(BUILD, r.slice(2)); return orig.call(this, r, ...a); };
Module._load = function (r, ...a) { if (r in stubs) return stubs[r]; return origLoad.call(this, r, ...a); };
module.exports = { BUILD, DATA: process.env.DATA_DIR, req: (p) => require(path.join(BUILD, p)),
  ok: (n, c, extra = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' ' + extra : '')); if (!c) process.exitCode = 1; } };
