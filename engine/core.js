/* Site engine — CORE (pure logic, no DOM). Conservative ES2017 so old Android browsers work.
   Everything here is unit-tested in Node (tests/engine.core.test.mjs). */
var Core = (function () {
  'use strict';

  /* ---------- SHA-256 (pure JS: crypto.subtle does not exist on plain-http hosting) ---------- */
  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function utf8(str) {
    var out = [], i, c;
    str = String(str);
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) { var d = str.charCodeAt(i + 1); if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
      if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd; // lone surrogate → U+FFFD, exactly like TextEncoder / Node
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function sha256(str) {
    var b = utf8(str), l = b.length, h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], i, j, w = new Array(64);
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    var hi = Math.floor((l * 8) / 4294967296), lo = (l * 8) >>> 0;
    b.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (i = 0; i < b.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = ((b[i + j * 4] << 24) | (b[i + j * 4 + 1] << 16) | (b[i + j * 4 + 2] << 8) | b[i + j * 4 + 3]) | 0;
      for (j = 16; j < 64; j++) {
        var s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (j = 0; j < 64; j++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K256[j] + w[j]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + bb) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var hex = '';
    for (i = 0; i < 8; i++) hex += ('00000000' + (h[i] >>> 0).toString(16)).slice(-8);
    return hex;
  }
  /** Passcode hash. Same formula is used by the builder (to store only a hash) and by the in-site admin (to check). */
  function hashPass(siteKey, pass) { return sha256(siteKey + ':owner:' + pass); }
  function safeEq(a, b) { a = String(a); b = String(b); var r = a.length ^ b.length, i; for (i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return r === 0; }

  /* ---------- text / numbers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : (d || 0); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function money(n, cur) { n = Math.round(num(n)); var neg = n < 0; n = Math.abs(n); return (neg ? '−' : '') + (cur || 'UGX') + ' ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'site'; }

  /** Allow only safe URLs. images=true additionally allows small inline pictures. */
  function url(u, images) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (u.slice(0, 2) === '//') return ''; // protocol-relative URLs would leave the site
    if (/^(#|\/(?!\/)|\.\/|[a-z0-9_\-./]+$)/i.test(u) && !/^[a-z][a-z0-9+.\-]*:/i.test(u)) return u;
    if (/^https?:\/\/[^\s"'<>]+$/i.test(u)) return u;
    if (/^(mailto|tel):[^\s"'<>]+$/i.test(u)) return u;
    if (images && /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(u) && u.length < 1500000) return u;
    return '';
  }

  /* ---------- phone / WhatsApp ---------- */
  function normPhone(p, cc) {
    p = String(p || '').replace(/[^\d]/g, ''); cc = cc || '256';
    if (!p) return '';
    if (p.indexOf('00') === 0) p = p.slice(2);
    else if (p.charAt(0) === '0') p = cc + p.slice(1);
    return p;
  }
  function phoneOk(p) { var d = normPhone(p); return d.length >= 9 && d.length <= 15; }
  function waUrl(num, msg) { return 'https://wa.me/' + normPhone(num) + '?text=' + encodeURIComponent(String(msg || '').slice(0, 1800)); }

  /* ---------- promo codes: "WELCOME10=10%" or "SAVE5000=5000" (one per line) ---------- */
  function parsePromos(text) {
    var out = {};
    String(text || '').split(/\r?\n/).forEach(function (l) {
      var i = l.lastIndexOf('='); if (i < 1) return;
      var code = l.slice(0, i).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''), v = l.slice(i + 1).trim();
      if (!code) return;
      var m = /^(\d+(?:\.\d+)?)\s*(%?)$/.exec(v); if (!m) return;
      var n = parseFloat(m[1]); if (!(n > 0)) return;
      out[code] = m[2] ? { t: 'pct', v: Math.min(100, n) } : { t: 'amt', v: n };
    });
    return out;
  }
  function applyPromo(code, promos, subtotal) {
    code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    var p = promos && Object.prototype.hasOwnProperty.call(promos, code) ? promos[code] : null;
    if (!p || !(subtotal > 0)) return { code: '', discount: 0 };
    var d = p.t === 'pct' ? Math.round((subtotal * p.v) / 100) : Math.round(p.v);
    return { code: code, discount: clamp(d, 0, subtotal) };
  }

  /** "Weddings=500000" lines → { Weddings: 500000 } */
  function parseKV(text) {
    var out = {};
    String(text || '').split(/\r?\n/).forEach(function (l) {
      var i = l.lastIndexOf('='); if (i < 1) return;
      var k = l.slice(0, i).trim(), v = parseInt(l.slice(i + 1).replace(/[^\d]/g, ''), 10);
      if (k && !BADK[k] && v >= 0) out[k] = v;
    });
    return out;
  }
  var BADK = { __proto__: 1, constructor: 1, prototype: 1 };

  /* ---------- cart ---------- */
  function stockOf(p) { var s = Number(p && p.stock); return isFinite(s) && s >= 0 ? s : 9999; }
  function cartRows(cart, products) {
    var map = {}, rows = [];
    (products || []).forEach(function (p) { map[p.id] = p; });
    (cart || []).forEach(function (c) {
      var p = map[c && c.id]; if (!p) return;
      var st = stockOf(p); if (st <= 0) return;
      var q = clamp(Math.floor(num(c.q, 1)), 1, Math.min(st, 99));
      for (var i = 0; i < rows.length; i++) if (rows[i].p.id === p.id) { rows[i].q = clamp(rows[i].q + q, 1, Math.min(st, 99)); return; }
      rows.push({ p: p, q: q });
    });
    return rows;
  }
  function cartTotals(rows, discount, fee) {
    var sub = 0; rows.forEach(function (r) { sub += Math.max(0, num(r.p.price)) * r.q; });
    discount = clamp(Math.round(num(discount)), 0, sub); fee = Math.max(0, Math.round(num(fee)));
    return { sub: sub, disc: discount, fee: fee, total: Math.max(0, sub - discount + fee) };
  }
  function cartAdd(cart, id, q) {
    cart = (cart || []).slice(); q = Math.floor(num(q, 1));
    for (var i = 0; i < cart.length; i++) if (cart[i].id === id) { cart[i] = { id: id, q: cart[i].q + q }; return cart; }
    cart.push({ id: id, q: q }); return cart;
  }

  /* ---------- product list: search / category / sort / favourites ---------- */
  function filterProducts(list, o) {
    o = o || {}; var q = String(o.q || '').toLowerCase().trim(), out = (list || []).filter(function (p) {
      if (o.cat && o.cat !== 'All' && p.category !== o.cat) return false;
      if (o.favs && o.favs.indexOf(p.id) < 0) return false;
      return !q || (String(p.name) + ' ' + String(p.category) + ' ' + String(p.description)).toLowerCase().indexOf(q) >= 0;
    });
    if (o.sort === 'low') out = out.slice().sort(function (a, b) { return num(a.price) - num(b.price); });
    else if (o.sort === 'high') out = out.slice().sort(function (a, b) { return num(b.price) - num(a.price); });
    else if (o.sort === 'name') out = out.slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    return out;
  }
  function categories(list) { var seen = {}, out = ['All']; (list || []).forEach(function (p) { var c = String(p.category || '').trim(); if (c && !seen[c]) { seen[c] = 1; out.push(c); } }); return out; }

  /* ---------- booking: slots + days ---------- */
  function parseSlots(text) {
    var seen = {}, out = [];
    String(text || '').split(/[,\n;]+/).forEach(function (t) {
      var m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(t); if (!m) return;
      var h = parseInt(m[1], 10), mi = m[2] ? parseInt(m[2], 10) : 0, ap = m[3] && m[3].toLowerCase();
      if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
      if (h > 23 || mi > 59) return;
      var k = ('0' + h).slice(-2) + ':' + ('0' + mi).slice(-2); if (!seen[k]) { seen[k] = 1; out.push(k); }
    });
    return out.sort();
  }
  function dateKey(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  /** Open days within `ahead` calendar days from `from`, skipping closed weekdays (0=Sun…6=Sat). */
  function nextDays(from, ahead, closed) {
    var out = [], i, d; closed = closed || []; ahead = clamp(Math.floor(num(ahead, 14)), 1, 120);
    for (i = 0; i < ahead; i++) { d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i); if (closed.indexOf(d.getDay()) < 0) out.push({ key: dateKey(d), date: d }); }
    return out;
  }
  function slotPast(key, time, now) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key), t = /^(\d{2}):(\d{2})$/.exec(time); if (!p || !t) return true;
    return new Date(+p[1], +p[2] - 1, +p[3], +t[1], +t[2]).getTime() <= now.getTime();
  }

  /* ---------- ids / refs ---------- */
  var A36 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function ref(prefix, now, rnd, used) {
    rnd = rnd || Math.random; used = used || {}; var r, n = 0;
    do { r = prefix + '-' + (Math.floor(now / 1000) % 1679616).toString(36).toUpperCase() + A36.charAt(Math.floor(rnd() * 32)) + A36.charAt(Math.floor(rnd() * 32)); n++; } while (used[r] && n < 50);
    return r;
  }

  /* ---------- CSV (with spreadsheet formula-injection guard) ---------- */
  function csv(rows, cols) {
    function cell(v) { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var out = [cols.map(function (c) { return cell(c.h); }).join(',')];
    rows.forEach(function (r) { out.push(cols.map(function (c) { return cell(typeof c.v === 'function' ? c.v(r) : r[c.v]); }).join(',')); });
    return out.join('\r\n');
  }

  /* ---------- data merge (published site-data.json  ←  owner's local edits) ---------- */
  var BAD = { __proto__: 1, constructor: 1, prototype: 1 };
  function merge(base, patch) {
    if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch;
    var out = {}, k;
    if (base && typeof base === 'object' && !Array.isArray(base)) for (k in base) if (!BAD[k] && Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (k in patch) if (!BAD[k] && Object.prototype.hasOwnProperty.call(patch, k)) out[k] = (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) ? merge(out[k], patch[k]) : patch[k];
    return out;
  }

  /* ---------- analytics (last 60 days, per device) ---------- */
  function bumpVisit(v, key) {
    v = v && typeof v === 'object' ? v : {}; v[key] = (v[key] || 0) + 1;
    var ks = Object.keys(v).sort(); while (ks.length > 60) delete v[ks.shift()];
    return v;
  }

  return { sha256: sha256, hashPass: hashPass, safeEq: safeEq, esc: esc, num: num, clamp: clamp, money: money, slug: slug, url: url, normPhone: normPhone, phoneOk: phoneOk, waUrl: waUrl,
    parsePromos: parsePromos, parseKV: parseKV, applyPromo: applyPromo, cartRows: cartRows, cartTotals: cartTotals, cartAdd: cartAdd, stockOf: stockOf, filterProducts: filterProducts, categories: categories,
    parseSlots: parseSlots, dateKey: dateKey, nextDays: nextDays, slotPast: slotPast, ref: ref, csv: csv, merge: merge, bumpVisit: bumpVisit };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Core;
