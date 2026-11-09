// Minimal DOM for running the site engine in Node (no external deps). Supports exactly what the engine uses.
const vm = require('vm'), fs = require('fs'), path = require('path');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const dec = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: '\u00a0' }[k]));
const kebab = (k) => 'data-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

class Text { constructor(t) { this.text = t; this.nodeType = 3; this.parent = null; } }
class El {
  constructor(tag, doc) { this.tag = tag.toLowerCase(); this.tagName = this.tag.toUpperCase(); this.attrs = {}; this.children = []; this.parent = null; this.listeners = {}; this.style = {}; this.nodeType = 1; this.doc = doc; this._value = undefined; this.checked = false; this.files = []; this.scrollTop = 0; }
  get parentNode() { return this.parent; }
  get id() { return this.attrs.id || ''; } set id(v) { this.attrs.id = v; }
  get className() { return this.attrs.class || ''; } set className(v) { this.attrs.class = String(v); }
  get classList() { const s = this; const get = () => (s.attrs.class || '').split(/\s+/).filter(Boolean), set = (a) => { s.attrs.class = a.join(' '); };
    return { add: (...c) => { const a = get(); c.forEach((x) => a.includes(x) || a.push(x)); set(a); }, remove: (...c) => set(get().filter((x) => !c.includes(x))), contains: (c) => get().includes(c), toggle: (c, f) => { const h = get().includes(c), w = f === undefined ? !h : !!f; if (w && !h) set([...get(), c]); if (!w && h) set(get().filter((x) => x !== c)); return w; } }; }
  get dataset() { const s = this; return new Proxy({}, { get: (_, k) => { const v = s.attrs[kebab(String(k))]; return v === undefined ? undefined : v; }, set: (_, k, v) => { s.attrs[kebab(String(k))] = String(v); return true; }, has: (_, k) => kebab(String(k)) in s.attrs }); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } setAttribute(k, v) { this.attrs[k] = String(v); } removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; }
  get href() { return this.attrs.href || ''; }
  get lang() { return this.attrs.lang || ''; } set lang(v) { this.attrs.lang = String(v); }
  get textContent() { return this.children.map((c) => (c.nodeType === 3 ? c.text : c.textContent)).join(''); }
  set textContent(t) { this.children.forEach((c) => (c.parent = null)); const x = new Text(String(t)); x.parent = this; this.children = [x]; }
  get innerHTML() { return this.children.map((c) => (c.nodeType === 3 ? c.text.replace(/&/g, '&amp;').replace(/</g, '&lt;') : c.outer())).join(''); }
  set innerHTML(h) { this.children.forEach((c) => (c.parent = null)); this.children = []; parse(String(h), this, this.doc); }
  outer() { const a = Object.entries(this.attrs).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join(''); return VOID.has(this.tag) ? `<${this.tag}${a}>` : `<${this.tag}${a}>${this.innerHTML}</${this.tag}>`; }
  get value() { if (this._value !== undefined) return this._value; if (this.tag === 'textarea') return this.textContent; if (this.tag === 'select') { const o = this.all('option'); const s = o.find((x) => 'selected' in x.attrs) || o[0]; return s ? (s.attrs.value !== undefined ? s.attrs.value : s.textContent) : ''; } return this.attrs.value || ''; }
  set value(v) { this._value = String(v); }
  appendChild(c) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; }
  remove() { if (this.parent) this.parent.removeChild(this); }
  contains(n) { for (let x = n; x; x = x.parent) if (x === this) return true; return false; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); } removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); }
  focus() { this.doc.activeElement = this; } blur() {} click() { this.doc.fire('click', this); } get offsetWidth() { return 100; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100 }; }
  closest(sel) { for (let x = this; x && x.nodeType === 1; x = x.parent) if (matchAny(x, sel)) return x; return null; }
  matches(sel) { return matchAny(this, sel); }
  querySelector(sel) { return this.all(sel)[0] || null; }
  querySelectorAll(sel) { return this.all(sel); }
  all(sel) { const out = []; const walk = (n) => { for (const c of n.children) if (c.nodeType === 1) { if (matchAny(c, sel)) out.push(c); walk(c); } }; walk(this); return out; }
  animate() { return { cancel() {} }; }
}
function compound(s) { const c = { tag: null, id: null, cls: [], attrs: [], nots: [] }; let m;
  s = s.replace(/:not\(([^)]+)\)/g, (_, x) => { c.nots.push(compound(x)); return ''; });
  const re = /^([a-zA-Z][\w-]*|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g;
  while ((m = re.exec(s))) { if (m[1]) c.tag = m[1].toLowerCase(); else if (m[2]) c.id = m[2]; else if (m[3]) c.cls.push(m[3]); else if (m[4]) c.attrs.push([m[4], m[5] ?? m[6] ?? m[7]]); }
  return c; }
function mc(n, c) { if (c.tag && c.tag !== '*' && n.tag !== c.tag) return false; if (c.id && n.attrs.id !== c.id) return false; const cl = (n.attrs.class || '').split(/\s+/); if (c.cls.some((x) => !cl.includes(x))) return false;
  if (c.attrs.some(([k, v]) => !(k in n.attrs) || (v !== undefined && n.attrs[k] !== v))) return false; if (c.nots.some((x) => mc(n, x))) return false; return true; }
function matchOne(n, parts) { if (!mc(n, parts[parts.length - 1])) return false; let i = parts.length - 2, a = n.parent; while (i >= 0 && a && a.nodeType === 1) { if (mc(a, parts[i])) i--; a = a.parent; } return i < 0; }
const cache = new Map();
function matchAny(n, sel) { let p = cache.get(sel); if (!p) { p = sel.split(',').map((x) => x.trim().split(/\s+/).map(compound)); cache.set(sel, p); } return p.some((parts) => matchOne(n, parts)); }

function parse(html, parent, doc) {
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|</g;
  let stack = [parent], m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) { const t = m[1].toLowerCase(); for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === t) { stack.length = i; break; } }
    else if (m[2]) { const e = new El(m[2], doc); const ar = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
      while ((a = ar.exec(m[3] || ''))) e.attrs[a[1].toLowerCase()] = dec(a[2] ?? a[3] ?? a[4] ?? ''); if ('checked' in e.attrs) e.checked = true;
      e.parent = top; top.children.push(e); if (!VOID.has(e.tag) && !m[4]) stack.push(e); }
    else { const t = new Text(dec(m[5] ?? '<')); t.parent = top; top.children.push(t); }
  }
}

function makeEnv(html, opts = {}) {
  const doc = new El('#document'); doc.doc = doc;
  const htmlEl = new El('html', doc), head = new El('head', doc), body = new El('body', doc);
  doc.children = [htmlEl]; htmlEl.parent = doc; [head, body].forEach((x) => { x.parent = htmlEl; htmlEl.children.push(x); });
  parse(html, body, doc);
  doc.documentElement = htmlEl; doc.head = head; doc.body = body; doc.title = ''; doc.hidden = false; doc.activeElement = body; doc.readyState = 'complete';
  doc.createElement = (t) => new El(t, doc);
  doc.getElementById = (id) => body.all('#' + id)[0] || null;
  doc.querySelector = (s) => htmlEl.all(s)[0] || null; doc.querySelectorAll = (s) => htmlEl.all(s);
  doc.fire = (type, target, extra = {}) => { const ev = Object.assign({ type, target, defaultPrevented: false, preventDefault() { ev.defaultPrevented = true; }, stopPropagation() { ev.stopped = true; } }, extra);
    for (let x = target; x && !ev.stopped; x = x.parent) (x.listeners[type] || []).slice().forEach((f) => f(ev)); return ev; };
  const store = new Map(); let quota = opts.quota ?? Infinity;
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { if (opts.storageBlocked) throw new Error('blocked'); if ([...store.values()].join('').length + String(v).length > quota) throw new Error('QuotaExceededError'); store.set(k, String(v)); }, removeItem: (k) => store.delete(k), _store: store };
  const winL = {}; const loc = { _h: opts.hash || '', protocol: opts.protocol || 'http:', get hash() { return this._h; }, set hash(v) { this._h = v ? (v[0] === '#' ? v : '#' + v) : ''; (winL.hashchange || []).forEach((f) => f({ type: 'hashchange' })); } };
  const errors = [], logs = [];
  const sb = { document: doc, localStorage, location: loc, navigator: { onLine: true, userAgent: 'test' }, console: { error: (...a) => errors.push(a.join(' ')), log: (...a) => logs.push(a.join(' ')), warn() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: (f) => setTimeout(f, 0), URL, Blob, Promise, JSON, Math, Date, Object, Array, String, Number, RegExp, Error, Proxy, AbortController, FormData: undefined, encodeURIComponent, decodeURIComponent, isFinite, isNaN, parseInt, parseFloat, Set, Map,
    fetch: opts.fetch || (async () => ({ ok: false })), pageYOffset: 0, innerWidth: 1280, matchMedia: () => ({ matches: !!opts.reduced, addEventListener() {}, addListener() {} }),
    addEventListener: (t, f) => (winL[t] ||= []).push(f), scrollTo(x, y) { sb.pageYOffset = typeof x === 'object' ? x.top || 0 : y || 0; }, print() { sb.printed = (sb.printed || 0) + 1; }, Image: class { }, FileReader: class { } };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.fire = (t, ev = {}) => (winL[t] || []).forEach((f) => f(ev)); sb.winL = winL;
  const ctx = vm.createContext(sb);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'engine', f), 'utf8'), ctx, { filename: f });
  return { doc, sb, ctx, load, errors, logs, localStorage, body, loc,
    $: (s) => doc.querySelector(s), $$: (s) => doc.querySelectorAll(s),
    click: (el) => { if (!el) throw new Error('click: element not found'); return doc.fire('click', el); },
    type: (el, v) => { if (!el) throw new Error('type: element not found'); el.value = v; doc.fire('input', el); doc.fire('change', el); },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
}
module.exports = { makeEnv, El };
