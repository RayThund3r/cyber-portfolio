/* Site engine — APP (rendering + interactions). One delegated listener per event type; no patch layers.
   Data flow:  embedded #site-data  →  optional site-data.json (published by the owner)  →  owner's local edits (if newer). */
(function () {
  'use strict';
  var $ = function (s, e) { return (e || document).querySelector(s); };
  var $$ = function (s, e) { return Array.prototype.slice.call((e || document).querySelectorAll(s)); };
  var esc = Core.esc, num = Core.num;

  var BASE;
  try { BASE = JSON.parse($('#site-data').textContent); } catch (e) { BASE = null; }
  if (!BASE) { document.body.textContent = 'This site could not load its data. Please refresh.'; return; }

  /* ---------- storage (never throws; falls back to memory when blocked) ---------- */
  var KEY = String(BASE.key || 'site'), NS = 'se_' + KEY + '_', mem = {};
  var ls = {
    g: function (k, d) { try { var v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return mem.hasOwnProperty(k) ? mem[k] : d; } },
    s: function (k, v) { mem[k] = v; try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  var DB = ls.g('db', null) || {};
  ['orders', 'bookings', 'enquiries', 'subs'].forEach(function (k) { if (!Array.isArray(DB[k])) DB[k] = []; });
  if (!DB.visits || typeof DB.visits !== 'object') DB.visits = {};
  var OWN = ls.g('own', null), CART = ls.g('cart', []), FAV = ls.g('fav', []), LG = ls.g('lg', 'en'), TH = ls.g('th', null);
  if (!Array.isArray(CART)) CART = []; if (!Array.isArray(FAV)) FAV = [];
  var saveDB = function () { if (!ls.s('db', DB)) toast(t('Storage is full or blocked — export a backup soon.')); };

  /* ---------- effective content ---------- */
  var SITE, PRODUCTS = [], PROMOS = {}, DEP = {};
  function arr(v) { return Array.isArray(v) ? v : []; }
  function compute() {
    var s = BASE;
    if (OWN && OWN.patch && num(OWN.at) > num(BASE.updatedAt)) s = Core.merge(BASE, OWN.patch);
    s.b = s.b || {}; s.hero = s.hero || { slides: [] }; s.f = s.f || {}; s.cat = s.cat || { products: [], pay: {} }; s.cat.pay = s.cat.pay || {}; s.bk = s.bk || {};
    s.sec = arr(s.sec);
    PRODUCTS = arr(s.cat.products).filter(function (p) { return p && p.name; }).map(function (p, i) { p.id = String(p.id || 'p' + i); p.price = Math.max(0, num(p.price)); return p; });
    PROMOS = Core.parsePromos(s.cat.promos); DEP = Core.parseKV(s.bk.deposit);
    SITE = s;
  }
  compute();
  var cur = function () { return SITE.cur || 'UGX'; }, M = function (n) { return Core.money(n, cur()); };
  var imgOf = function (p) { var a = arr(p.images).map(function (u) { return Core.url(u, true); }).filter(Boolean); return a; };
  var MODE = function () { return SITE.mode || 'none'; };
  var on = function (k) { return SITE.f[k] !== false; };

  /* ---------- translations (UI chrome only; your own text stays as you wrote it) ---------- */
  var SW = { 'Home': 'Mwanzo', 'About': 'Kuhusu', 'Services': 'Huduma', 'Shop': 'Duka', 'Gallery': 'Picha', 'Reviews': 'Maoni', 'FAQ': 'Maswali', 'Book': 'Weka nafasi', 'Get a quote': 'Omba bei', 'Contact': 'Mawasiliano',
    'Add': 'Weka', 'Add to cart': 'Weka kikapuni', 'Your order': 'Oda yako', 'Cart is empty': 'Kikapu ni tupu', 'Search…': 'Tafuta…', 'All': 'Zote', 'Sold out': 'Imeisha', 'Subtotal': 'Jumla ndogo', 'Discount': 'Punguzo',
    'Delivery': 'Usafirishaji', 'Total': 'Jumla', 'Promo code': 'Nambari ya punguzo', 'Apply': 'Tumia', 'Your name': 'Jina lako', 'Phone / WhatsApp': 'Simu / WhatsApp', 'Pickup': 'Chukua mwenyewe', 'Deliver to me': 'Niletewe',
    'Address': 'Anwani', 'Payment': 'Malipo', 'Note (optional)': 'Maelezo (si lazima)', 'Place order': 'Weka oda', 'Order placed': 'Oda imewekwa', 'Send on WhatsApp': 'Tuma kwa WhatsApp', 'Track order': 'Fuatilia oda',
    'Close': 'Funga', 'Message': 'Ujumbe', 'Send message': 'Tuma ujumbe', 'Thank you! We will reply soon.': 'Asante! Tutakujibu hivi karibuni.', 'Choose a day': 'Chagua siku', 'Choose a time': 'Chagua saa', 'Confirm booking': 'Thibitisha',
    'Send request': 'Tuma ombi', 'Subscribe': 'Jiunge', 'Your email': 'Barua pepe yako', 'Favourites': 'Vipendwa', 'Sort': 'Panga', 'Price: low → high': 'Bei: ndogo → kubwa', 'Price: high → low': 'Bei: kubwa → ndogo', 'Name A–Z': 'Jina A–Z',
    'Pay on pickup / delivery': 'Lipa unapochukua / unapopokea', 'Reference': 'Kumbukumbu', 'Status': 'Hali', 'Cash': 'Pesa taslimu', 'Back to top': 'Juu', 'Pending': 'Inasubiri', 'Paid': 'Imelipwa', 'Ready': 'Tayari', 'Delivered': 'Imefikishwa', 'Cancelled': 'Imeghairiwa', 'Confirmed': 'Imethibitishwa' };
  var t = function (s) { return LG === 'sw' && SW[s] ? SW[s] : s; };

  /* ---------- theme ---------- */
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setTheme(v) { var r = document.documentElement; if (v === 'light' || v === 'dark') r.setAttribute('data-theme', v); else r.removeAttribute('data-theme'); }
  setTheme(TH || (SITE.theme === 'light' || SITE.theme === 'dark' ? SITE.theme : null));
  var isDark = function () { var d = document.documentElement.getAttribute('data-theme'); return d ? d === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); };

  /* ---------- tiny UI helpers ---------- */
  var toastT;
  function toast(m) { var e = $('.toast') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast' })); e.setAttribute('role', 'status'); e.textContent = m; requestAnimationFrame(function () { e.classList.add('on'); }); clearTimeout(toastT); toastT = setTimeout(function () { e.classList.remove('on'); }, 3200); }
  var SHEET = null, lastFocus = null;
  function openSheet(html, wide) {
    closeSheet(true); lastFocus = document.activeElement;
    var ov = document.createElement('div'); ov.className = 'ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="sh' + (wide ? ' wide' : '') + '"><i class="grab"></i><button class="x" data-act="close" aria-label="' + esc(t('Close')) + '">✕</button><div id="shb">' + html + '</div></div>';
    document.body.appendChild(ov); document.body.style.overflow = 'hidden'; SHEET = ov;
    requestAnimationFrame(function () { ov.classList.add('open'); var f = $('input,select,textarea,button:not(.x)', ov); if (f && f.focus) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
  }
  function setSheet(html) { var b = $('#shb'); if (b) b.innerHTML = html; }
  function closeSheet(now) { var ov = SHEET; if (!ov) return; SHEET = null; document.body.style.overflow = ''; ov.style.pointerEvents = 'none'; ov.classList.remove('open'); var rm = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }; if (now || reduced) rm(); else setTimeout(rm, 450); try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  function confirmDlg(msg, yes, label) { openSheet('<h3>' + esc(msg) + '</h3><div class="act" style="margin-top:18px"><button class="btn red" data-act="yes">' + esc(label || 'Yes') + '</button><button class="btn ghost" data-act="close">' + esc(t('Close')) + '</button></div>'); CONFIRM = yes; }
  var CONFIRM = null;
  var val = function (id) { var e = document.getElementById(id); return e ? String(e.value == null ? '' : e.value).trim() : ''; };
  var wa = function (msg) { return SITE.b.wa ? Core.waUrl(SITE.b.wa, msg) : ''; };

  /* ---------- delivery of orders / bookings / enquiries to the owner (optional endpoint e.g. Formspree) ---------- */
  var flushing = false;
  function deliver(kind, obj) { if (!Core.url(SITE.ep) || !/^https:/i.test(SITE.ep)) return; var q = ls.g('q', []); q.push({ k: kind, o: obj, n: 0 }); ls.s('q', q.slice(-100)); flush(); }
  function flush() {
    if (flushing || !SITE.ep) return; var q = ls.g('q', []); if (!q.length || !window.fetch) return; flushing = true;
    var it = q[0], done = function (ok) { var cur2 = ls.g('q', []); if (ok) cur2.shift(); else { it.n++; if (it.n >= 5) cur2.shift(); else cur2[0] = it; } ls.s('q', cur2); flushing = false; if (ok && cur2.length) flush(); };
    var body = JSON.stringify(Object.assign({ kind: it.k, site: SITE.b.name }, it.o));
    var to = new Promise(function (r) { setTimeout(function () { r(false); }, 12000); });
    Promise.race([fetch(SITE.ep, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: body }).then(function (r) { return r.ok; }, function () { return false; }), to]).then(done);
  }

  /* ---------- views ---------- */
  var LABEL = { about: 'About', services: 'Services', catalog: 'Shop', gallery: 'Gallery', testimonials: 'Reviews', faq: 'FAQ', book: 'Book', quote: 'Get a quote', contact: 'Contact' };
  function secIds() {
    var m = MODE(), out = [];
    SITE.sec.forEach(function (id) {
      if (id === 'hero') return;
      if (id === 'catalog' && m !== 'shop') return;
      if (id === 'book' && m !== 'book') return;
      if (id === 'quote' && m !== 'quote') return;
      out.push(id);
    });
    return out;
  }
  var rv = function (i) { return ' class="rv" style="--d:' + Math.min(i || 0, 6) * 0.07 + 's"'; };
  var head = function (eyebrow, title, intro) { return '<div class="hd rv">' + (eyebrow ? '<span class="eyebrow">' + esc(eyebrow) + '</span>' : '') + '<h2>' + esc(title) + '</h2>' + (intro ? '<p>' + esc(intro) + '</p>' : '') + '</div>'; };
  var pic = function (u) { u = Core.url(u, true); return u ? '<img src="' + esc(u) + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' : ''; };

  function vNav() {
    var b = SITE.b, links = secIds().map(function (id) { return '<a href="#' + id + '">' + esc(t(LABEL[id] || id)) + '</a>'; }).join('');
    var logo = Core.url(isDark() && b.logoDark ? b.logoDark : b.logo, true);
    var mark = logo ? '<img src="' + esc(logo) + '" alt="' + esc(b.name) + '">' : '<span class="mono">' + esc((b.mono || b.name || 'S').slice(0, 2).toUpperCase()) + '</span>';
    var cta = MODE() === 'book' ? ['#book', 'Book'] : MODE() === 'quote' ? ['#quote', 'Get a quote'] : MODE() === 'shop' ? ['#catalog', 'Shop'] : ['#contact', 'Contact'];
    return (b.announce ? '<div class="ann">' + esc(b.announce) + '</div>' : '') +
      '<header class="nav"><div class="w nv"><a class="logo" href="#home" aria-label="' + esc(b.name) + '">' + mark + (logo ? '' : '<span class="t">' + esc(b.name) + '</span>') + '</a><nav class="nl" aria-label="Main">' + links + '</nav>' +
      '<div class="na">' + (on('lang') ? '<button class="ib" data-act="lang" aria-label="Language" title="English / Kiswahili">' + (LG === 'sw' ? 'SW' : 'EN') + '</button>' : '') +
      (on('theme') ? '<button class="ib" data-act="theme" aria-label="Theme">' + (isDark() ? '☀' : '☾') + '</button>' : '') +
      '<a class="btn sm" href="' + cta[0] + '">' + esc(t(cta[1])) + '</a><button class="ib" id="mb" data-act="menu" aria-label="Menu" aria-expanded="false">☰</button></div></div>' +
      '<div class="menu" id="menu">' + links + '<a href="' + cta[0] + '">' + esc(t(cta[1])) + ' →</a></div></header>';
  }

  function vHero() {
    var h = SITE.hero, b = SITE.b, sl = arr(h.slides).filter(function (s) { return s && (s.t || s.u); });
    if (!sl.length) sl = [{ t: b.name, s: b.tag, c: '' }];
    var many = sl.length > 1, cta = MODE() === 'book' ? '#book' : MODE() === 'quote' ? '#quote' : MODE() === 'shop' ? '#catalog' : '#contact';
    var slides = sl.map(function (s, i) {
      var link = Core.url(s.link) || cta;
      return '<div class="slide' + (i ? '' : ' on') + '"><div class="bg">' + pic(s.u) + '</div><div class="cap"><div class="w"><span class="eyebrow">' + esc(b.name) + '</span><h1>' + esc(s.t) + '</h1><p>' + esc(s.s || '') + '</p>' + (s.cta ? '<a class="btn" href="' + esc(link) + '">' + esc(s.cta) + '</a>' : '') + '</div></div></div>';
    }).join('');
    return '<section id="home" style="padding:0"><div class="sl" data-fx="' + esc(h.fx || 'fade') + '" style="--slt:' + Math.max(2, num(h.sec, 5.5)) + 's">' + slides +
      (many ? '<button class="ar l" data-act="prev" aria-label="Previous">‹</button><button class="ar r" data-act="next" aria-label="Next">›</button><div class="ctl"><div class="dots">' + sl.map(function (_, i) { return '<i data-act="dot" data-i="' + i + '"' + (i ? '' : ' class="on"') + '></i>'; }).join('') + '</div><button id="pp" data-act="pause" aria-label="Pause">❚❚</button></div><div class="prog"><i></i></div>' : '') + '</div></section>';
  }

  function vAbout() {
    var a = SITE.about || {}, b = SITE.b;
    var stats = arr(a.stats).filter(function (s) { return s && s.v; }).map(function (s) { return '<div><b>' + esc(s.v) + '</b><span>' + esc(s.l || '') + '</span></div>'; }).join('');
    return '<section id="about"><div class="w ab"><div' + rv() + '>' + (a.eyebrow ? '<span class="eyebrow">' + esc(a.eyebrow) + '</span>' : '') + '<h2 style="font-size:clamp(28px,4.4vw,44px);margin:8px 0 14px">' + esc(a.title || b.name) + '</h2>' +
      String(b.about || '').split(/\n{2,}/).map(function (p) { return '<p style="color:var(--mut)">' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') + (stats ? '<div class="st">' + stats + '</div>' : '') + '</div>' +
      (Core.url(a.img, true) ? '<div class="pic rv" style="--d:.1s">' + pic(a.img) + '</div>' : '') + '</div></section>';
  }

  function vServices() {
    var sv = SITE.sv || {}, items = arr(sv.items).filter(function (s) { return s && s.t; });
    return '<section id="services"><div class="w">' + head(sv.eyebrow, sv.title || 'Services', sv.intro) + '<div class="sv">' + items.map(function (s, i) {
      return '<div' + rv(i) + '><em>' + ('0' + (i + 1)).slice(-2) + '</em><h3>' + esc(s.t) + '</h3><p>' + esc(s.d || '') + '</p>' + (s.p ? '<span class="pr">' + esc(s.p) + '</span>' : '') + '</div>'; }).join('') + '</div></div></section>';
  }

  /* catalog */
  var FILT = { q: '', cat: 'All', sort: '', fav: false };
  function card(p, i) {
    var im = imgOf(p), sold = Core.stockOf(p) <= 0, fav = FAV.indexOf(p.id) >= 0;
    return '<article class="pc rv" style="--d:' + (i % 8) * 0.04 + 's" data-act="open" data-id="' + esc(p.id) + '"><div class="ph">' + (im[0] ? '<img src="' + esc(im[0]) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' : '') +
      (sold ? '<span class="tag">' + esc(t('Sold out')) + '</span>' : '') + (on('fav') ? '<button class="heart" data-act="fav" data-id="' + esc(p.id) + '" aria-label="Favourite" aria-pressed="' + fav + '">' + (fav ? '♥' : '♡') + '</button>' : '') + '</div>' +
      '<div class="pi"><small>' + esc(p.category || '') + '</small><h3>' + esc(p.name) + '</h3><span class="pr">' + esc(M(p.price)) + '</span><button class="btn sm"' + (sold ? ' disabled' : '') + ' data-act="add" data-id="' + esc(p.id) + '">' + esc(t('Add')) + '</button></div></article>';
  }
  function gridHTML() {
    var list = Core.filterProducts(PRODUCTS, { q: FILT.q, cat: FILT.cat, sort: FILT.sort, favs: FILT.fav ? FAV : null });
    return list.length ? list.map(card).join('') : '<p class="empty">' + esc(FILT.fav ? t('Favourites') + ': 0' : '—') + '</p>';
  }
  function vCatalog() {
    var c = SITE.cat, cats = Core.categories(PRODUCTS);
    return '<section id="catalog"><div class="w">' + head(c.eyebrow, c.title || 'Shop', c.intro) + '<div class="tools"><input class="srch" id="q" data-in="q" type="search" placeholder="' + esc(t('Search…')) + '" aria-label="' + esc(t('Search…')) + '" value="' + esc(FILT.q) + '">' +
      '<select class="sel" id="sort" data-ch="sort" aria-label="' + esc(t('Sort')) + '"><option value="">' + esc(t('Sort')) + '</option><option value="low"' + (FILT.sort === 'low' ? ' selected' : '') + '>' + esc(t('Price: low → high')) + '</option><option value="high"' + (FILT.sort === 'high' ? ' selected' : '') + '>' + esc(t('Price: high → low')) + '</option><option value="name"' + (FILT.sort === 'name' ? ' selected' : '') + '>' + esc(t('Name A–Z')) + '</option></select>' +
      (on('fav') ? '<button class="chip' + (FILT.fav ? ' on' : '') + '" data-act="favonly">♥ ' + esc(t('Favourites')) + '</button>' : '') + '</div>' +
      '<div class="chips" id="chips">' + cats.map(function (k) { return '<button class="chip' + (k === FILT.cat ? ' on' : '') + '" data-act="cat" data-v="' + esc(k) + '">' + esc(k === 'All' ? t('All') : k) + '</button>'; }).join('') + '</div><div class="grid" id="grid">' + gridHTML() + '</div></div></section>';
  }

  function vGallery() {
    var g = SITE.gal || {}, items = arr(g.items).filter(function (x) { return x && Core.url(x.u, true); });
    return '<section id="gallery"><div class="w">' + head(g.eyebrow, g.title || 'Gallery', g.intro) + '<div class="mas">' + items.map(function (x, i) { return '<figure' + rv(i % 4) + ' data-act="lb" data-i="' + i + '"><img src="' + esc(Core.url(x.u, true)) + '" alt="' + esc(x.c || '') + '" loading="lazy" decoding="async">' + (x.c ? '<figcaption>' + esc(x.c) + '</figcaption>' : '') + '</figure>'; }).join('') + '</div></div></section>';
  }
  function vTesti() {
    var s = SITE.ts || {}, items = arr(s.items).filter(function (x) { return x && x.q; });
    return '<section id="testimonials"><div class="w">' + head(s.eyebrow, s.title || 'Reviews') + '<div class="tm">' + items.map(function (x, i) { return '<blockquote' + rv(i) + '><p>“' + esc(x.q) + '”</p><cite>— ' + esc(x.n || '') + '</cite></blockquote>'; }).join('') + '</div></div></section>';
  }
  function vFaq() {
    var f = SITE.faq || {}, items = arr(f.items).filter(function (x) { return x && x.q; });
    return '<section id="faq"><div class="w" style="max-width:820px">' + head(f.eyebrow, f.title || 'FAQ') + '<div class="rv">' + items.map(function (x) { return '<details><summary>' + esc(x.q) + '</summary><p>' + esc(x.a || '') + '</p></details>'; }).join('') + '</div></div></section>';
  }

  /* booking + quote */
  var BK = { day: '', time: '', svc: '' };
  function svcNames() { var n = arr((SITE.sv || {}).items).map(function (s) { return s && s.t; }).filter(Boolean); return n.length ? n : [SITE.b.name]; }
  function takenSet() { var m = {}; DB.bookings.forEach(function (b) { if (b.st !== 'Cancelled') m[b.date + ' ' + b.time] = 1; }); return m; }
  function daysHTML() {
    var k = SITE.bk, days = Core.nextDays(new Date(), k.ahead || 14, arr(k.closed).map(Number));
    if (!BK.day || !days.some(function (d) { return d.key === BK.day; })) BK.day = days[0] ? days[0].key : '';
    var wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return '<div class="dstrip" role="group" aria-label="' + esc(t('Choose a day')) + '">' + days.map(function (d) { return '<button type="button" class="' + (d.key === BK.day ? 'on' : '') + '" data-act="day" data-v="' + d.key + '"><small>' + wk[d.date.getDay()] + '</small><b>' + d.date.getDate() + '</b></button>'; }).join('') + '</div>';
  }
  function slotsHTML() {
    var slots = Core.parseSlots(SITE.bk.slots), taken = takenSet(), now = new Date();
    if (BK.time && (taken[BK.day + ' ' + BK.time] || Core.slotPast(BK.day, BK.time, now))) BK.time = '';
    return '<div class="slots" role="group" aria-label="' + esc(t('Choose a time')) + '">' + slots.map(function (s) {
      var bad = taken[BK.day + ' ' + s] || Core.slotPast(BK.day, s, now); return '<button type="button" class="' + (s === BK.time ? 'on' : '') + '" data-act="slot" data-v="' + s + '"' + (bad ? ' disabled' : '') + '>' + s + '</button>'; }).join('') + '</div>';
  }
  function vBook() {
    var k = SITE.bk, names = svcNames();
    return '<section id="book"><div class="w ct"><div>' + head(k.eyebrow, k.title || 'Book', k.intro) + '<div class="note">' + esc(SITE.b.hours || '') + '</div></div><div class="fm rv" id="bkf">' +
      '<label>' + esc(t('Services')) + '<select id="bk_s">' + names.map(function (n) { return '<option' + (n === BK.svc ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label>' +
      '<label>' + esc(t('Choose a day')) + '</label><div id="days">' + daysHTML() + '</div><label>' + esc(t('Choose a time')) + '</label><div id="slots">' + slotsHTML() + '</div>' +
      '<label>' + esc(t('Your name')) + '<input id="bk_n" autocomplete="name"></label><label>' + esc(t('Phone / WhatsApp')) + '<input id="bk_p" type="tel" autocomplete="tel"></label><label>' + esc(t('Note (optional)')) + '<textarea id="bk_m" rows="2"></textarea></label>' +
      '<button class="btn full" data-act="book">' + esc(t('Confirm booking')) + '</button></div></div></section>';
  }
  function vQuote() {
    var k = SITE.bk, names = svcNames();
    return '<section id="quote"><div class="w ct"><div>' + head(k.eyebrow, k.title || 'Get a quote', k.intro) + '<div class="note">' + esc(SITE.b.hours || '') + '</div></div><div class="fm rv">' +
      '<label>' + esc(t('Services')) + '<select id="qt_s">' + names.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select></label>' +
      '<label>' + esc(t('Your name')) + '<input id="qt_n" autocomplete="name"></label><label>' + esc(t('Phone / WhatsApp')) + '<input id="qt_p" type="tel" autocomplete="tel"></label><label>' + esc(t('Message')) + '<textarea id="qt_m" rows="4"></textarea></label>' +
      '<button class="btn full" data-act="quote">' + esc(t('Send request')) + '</button></div></div></section>';
  }
  function vContact() {
    var c = SITE.ct || {}, b = SITE.b, li = function (k, v, h) { return v ? '<li><b>' + esc(t(k)) + '</b>' + (h ? '<a href="' + esc(h) + '">' + esc(v) + '</a>' : esc(v)) + '</li>' : ''; };
    return '<section id="contact"><div class="w ct"><div>' + head(c.eyebrow, c.title || 'Contact', c.intro) + '<ul>' + li('Phone', b.phone, 'tel:' + String(b.phone || '').replace(/[^\d+]/g, '')) + li('Email', b.email, 'mailto:' + b.email) + li('Address', b.addr) + li('Hours', b.hours) +
      (b.ig ? li('Instagram', b.ig, Core.url(b.ig.indexOf('http') === 0 ? b.ig : 'https://instagram.com/' + b.ig.replace(/^@/, ''))) : '') + '</ul></div><div class="fm rv"><label>' + esc(t('Your name')) + '<input id="ct_n" autocomplete="name"></label><label>' + esc(t('Phone / WhatsApp')) + '<input id="ct_p" autocomplete="tel"></label><label>' + esc(t('Message')) + '<textarea id="ct_m" rows="4"></textarea></label><button class="btn full" data-act="contact">' + esc(t('Send message')) + '</button></div></div></section>';
  }
  function vFooter() {
    var b = SITE.b;
    return '<footer><div class="w"><div><div class="logo" style="margin-bottom:8px"><b style="font-family:var(--hf);color:var(--tx);font-size:18px">' + esc(b.name) + '</b></div><div>' + esc(b.tag || '') + '</div><div style="margin-top:10px">© ' + new Date().getFullYear() + ' ' + esc(b.name) + '</div>' +
      (on('admin') && BASE.adm && BASE.adm.h ? '<div style="margin-top:6px"><a href="#admin">Owner login</a></div>' : '') + '</div>' +
      (on('news') ? '<div><b style="color:var(--tx)">' + esc(t('Subscribe')) + '</b><div class="nlf"><input id="nl" type="email" placeholder="' + esc(t('Your email')) + '" aria-label="' + esc(t('Your email')) + '"><button class="btn sm" data-act="news">' + esc(t('Subscribe')) + '</button></div></div>' : '') + '</div></footer>';
  }
  var V = { about: vAbout, services: vServices, catalog: vCatalog, gallery: vGallery, testimonials: vTesti, faq: vFaq, book: vBook, quote: vQuote, contact: vContact };

  function cartCount() { return Core.cartRows(CART, PRODUCTS).reduce(function (a, r) { return a + r.q; }, 0); }
  function fabs() {
    var n = cartCount();
    return (MODE() === 'shop' ? '<button class="fab cart" data-act="cart" aria-label="' + esc(t('Your order')) + '">🛒' + (n ? '<b id="cartn">' + n + '</b>' : '<b id="cartn" style="display:none">0</b>') + '</button>' : '') +
      (SITE.b.wa ? '<a class="fab wa" href="' + esc(wa('Hello ' + SITE.b.name + ', ')) + '" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>' : '') + '<button class="topb" data-act="top" aria-label="' + esc(t('Back to top')) + '">↑</button>';
  }

  var app = $('#app');
  function render() {
    document.documentElement.lang = LG === 'sw' ? 'sw' : (BASE.lang || 'en');
    document.body.className = (document.body.className || '').replace(/\bf-\w+/g, '').trim() + ' ' + ['wa', 'top'].filter(function (k) { return !on(k); }).map(function (k) { return 'f-no' + k; }).join(' ');
    var y = window.pageYOffset;
    app.innerHTML = vNav() + '<main>' + vHero() + secIds().map(function (id) { return V[id] ? V[id]() : ''; }).join('') + '</main>' + vFooter() + fabs();
    after(); if (y) window.scrollTo(0, y);
  }

  /* ---------- slider ---------- */
  var SL = { i: 0, n: 0, t: null, paused: false };
  function slGo(i) {
    var sl = $('.sl'); if (!sl || !SL.n) return; SL.i = (i + SL.n) % SL.n;
    $$('.slide', sl).forEach(function (s, k) { s.classList.toggle('on', k === SL.i); }); $$('.dots i', sl).forEach(function (d, k) { d.classList.toggle('on', k === SL.i); });
    var p = $('.prog i', sl); if (p) { p.classList.remove('go'); void p.offsetWidth; if (!SL.paused && !reduced && on('auto')) p.classList.add('go'); }
  }
  function slAuto() {
    clearInterval(SL.t); var h = SITE.hero || {}; if (SL.n < 2 || SL.paused || reduced || h.auto === false) return;
    SL.t = setInterval(function () { if (!document.hidden) slGo(SL.i + 1); }, Math.max(2, num(h.sec, 5.5)) * 1000);
  }
  function slInit() {
    var sl = $('.sl'); SL.n = sl ? $$('.slide', sl).length : 0; SL.i = 0; if (!sl) return; slGo(0); slAuto();
    var x0 = null; sl.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    sl.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45) { slGo(SL.i + (dx < 0 ? 1 : -1)); slAuto(); } }, { passive: true });
  }

  /* ---------- reveal on scroll ---------- */
  var io;
  function reveal() {
    var els = $$('.rv:not(.in)'); if (io) io.disconnect();
    if (!('IntersectionObserver' in window) || reduced) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(function (e) { io.observe(e); });
  }
  function after() { slInit(); reveal(); onScroll(); }
  function onScroll() { var n = $('.nav'), b = $('.topb'); if (n) n.classList.toggle('sc', window.pageYOffset > 12); if (b) b.classList.toggle('on', window.pageYOffset > 700); }

  /* ---------- lightbox ---------- */
  var LB = null;
  function lbOpen(list, i) {
    if (!list || !list.length) return; // nothing to show (e.g. a product with no pictures)
    lbClose(); LB = { list: list, i: Core.clamp(Math.floor(num(i)), 0, list.length - 1), el: document.createElement('div') }; LB.el.className = 'lb'; LB.el.setAttribute('role', 'dialog'); LB.el.setAttribute('aria-modal', 'true');
    document.body.appendChild(LB.el); document.body.style.overflow = 'hidden'; lbShow();
    var x0 = null; LB.el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    LB.el.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) lbMove(dx < 0 ? 1 : -1); }, { passive: true });
  }
  function lbShow() { if (!LB) return; var it = LB.list[LB.i]; if (!it) return lbClose(); LB.el.innerHTML = '<button class="x" data-act="lbx" aria-label="' + esc(t('Close')) + '">✕</button>' + (LB.list.length > 1 ? '<button class="ar l" data-act="lbp" aria-label="Previous">‹</button><button class="ar r" data-act="lbn" aria-label="Next">›</button>' : '') + '<img src="' + esc(it.u) + '" alt="' + esc(it.c || '') + '"><div class="lbc">' + esc(it.c || '') + (LB.list.length > 1 ? ' · ' + (LB.i + 1) + '/' + LB.list.length : '') + '</div>'; }
  function lbMove(d) { if (LB) { LB.i = (LB.i + d + LB.list.length) % LB.list.length; lbShow(); } }
  function lbClose() { if (!LB) return; if (LB.el.parentNode) LB.el.parentNode.removeChild(LB.el); LB = null; if (!SHEET) document.body.style.overflow = ''; }

  /* ---------- product sheet, cart, checkout ---------- */
  var CK = { name: '', phone: '', dl: 'pickup', addr: '', pay: '', note: '', promo: '', code: '' };
  var findP = function (id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; };
  function openProduct(id, k) {
    var p = findP(id); if (!p) return; var im = imgOf(p), sold = Core.stockOf(p) <= 0, fav = FAV.indexOf(p.id) >= 0, rel = PRODUCTS.filter(function (x) { return x.id !== p.id && x.category === p.category; }).slice(0, 3); k = k || 0;
    openSheet('<div class="ph" data-act="plb" data-id="' + esc(p.id) + '" data-i="' + k + '">' + (im[k] ? '<img src="' + esc(im[k]) + '" alt="' + esc(p.name) + '">' : '') + '</div>' +
      (im.length > 1 ? '<div class="thumbs">' + im.map(function (u, i) { return '<button class="' + (i === k ? 'on' : '') + '" data-act="thumb" data-id="' + esc(p.id) + '" data-i="' + i + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(u) + '" alt=""></button>'; }).join('') + '</div>' : '') +
      '<small style="color:var(--mut);text-transform:uppercase;letter-spacing:.08em">' + esc(p.category || '') + '</small><h3>' + esc(p.name) + '</h3><div class="pr" style="font-size:22px;margin:6px 0">' + esc(M(p.price)) + '</div><p>' + esc(p.description || '').replace(/\n/g, '<br>') + '</p>' +
      '<div class="act" style="margin-top:14px"><button class="btn" data-act="add" data-id="' + esc(p.id) + '"' + (sold ? ' disabled' : '') + '>' + esc(sold ? t('Sold out') : t('Add to cart')) + '</button>' + (on('fav') ? '<button class="btn ghost" data-act="fav" data-id="' + esc(p.id) + '" data-keep="1">' + (fav ? '♥' : '♡') + '</button>' : '') +
      (SITE.b.wa ? '<a class="btn wa" target="_blank" rel="noopener" href="' + esc(wa('Hello, I am interested in: ' + p.name + ' (' + M(p.price) + ')')) + '">💬</a>' : '') + '</div>' +
      (rel.length ? '<h4 style="margin:22px 0 8px">More like this</h4>' + rel.map(function (r) { return '<div class="rw" data-act="open" data-id="' + esc(r.id) + '" style="cursor:pointer"><div class="th">' + (imgOf(r)[0] ? '<img src="' + esc(imgOf(r)[0]) + '" alt="">' : '') + '</div><div><b>' + esc(r.name) + '</b><br><small>' + esc(M(r.price)) + '</small></div></div>'; }).join('') : ''), true);
  }
  function addToCart(id, q) {
    var p = findP(id); if (!p) return; if (Core.stockOf(p) <= 0) return toast(t('Sold out'));
    CART = Core.cartAdd(CART, id, q || 1); CART = Core.cartRows(CART, PRODUCTS).map(function (r) { return { id: r.p.id, q: r.q }; }); ls.s('cart', CART);
    var n = $('#cartn'); if (n) { n.style.display = ''; n.textContent = cartCount(); } toast(p.name + ' ✓');
  }
  function payOptions() { var p = SITE.cat.pay, o = []; if (p.mtn) o.push(['mtn', 'MTN Mobile Money']); if (p.airtel) o.push(['airtel', 'Airtel Money']); if (p.bank) o.push(['bank', 'Bank transfer']); if (p.link) o.push(['link', 'Pay online']); if (p.cash !== false) o.push(['cash', t('Cash')]); return o; }
  function readCK() {
    if (!$('#ck_name')) return;
    CK.name = val('ck_name'); CK.phone = val('ck_phone'); CK.dl = val('ck_dl') || 'pickup'; CK.addr = val('ck_addr'); CK.pay = val('ck_pay'); CK.note = val('ck_note'); CK.promo = val('ck_promo');
  }
  function totals() {
    var rows = Core.cartRows(CART, PRODUCTS), sub = Core.cartTotals(rows, 0, 0).sub, pr = Core.applyPromo(CK.code, PROMOS, sub);
    return { rows: rows, t: Core.cartTotals(rows, pr.discount, CK.dl === 'delivery' ? num(SITE.cat.fee) : 0), code: pr.code };
  }
  function cartHTML() {
    var T = totals(), rows = T.rows, opts = payOptions(); if (!CK.pay || !opts.some(function (o) { return o[0] === CK.pay; })) CK.pay = opts[0] ? opts[0][0] : '';
    if (!rows.length) return '<h3>' + esc(t('Your order')) + '</h3><p>' + esc(t('Cart is empty')) + '</p>';
    return '<h3>' + esc(t('Your order')) + '</h3>' + rows.map(function (r) {
      return '<div class="rw"><div class="th">' + (imgOf(r.p)[0] ? '<img src="' + esc(imgOf(r.p)[0]) + '" alt="">' : '') + '</div><div><b>' + esc(r.p.name) + '</b><br><small>' + esc(M(r.p.price)) + '</small></div><div class="qty"><button data-act="dec" data-id="' + esc(r.p.id) + '" aria-label="−">−</button><b>' + r.q + '</b><button data-act="inc" data-id="' + esc(r.p.id) + '" aria-label="+">+</button></div></div>'; }).join('') +
      '<div class="fm" style="margin-top:14px"><div class="act"><input id="ck_promo" placeholder="' + esc(t('Promo code')) + '" value="' + esc(CK.promo) + '" style="flex:1"><button class="btn ghost sm" data-act="promo">' + esc(t('Apply')) + '</button></div>' +
      '<label>' + esc(t('Your name')) + '<input id="ck_name" autocomplete="name" value="' + esc(CK.name) + '"></label><label>' + esc(t('Phone / WhatsApp')) + '<input id="ck_phone" type="tel" autocomplete="tel" value="' + esc(CK.phone) + '"></label>' +
      '<label>' + esc(t('Delivery')) + '<select id="ck_dl" data-ch="ckdl"><option value="pickup"' + (CK.dl === 'pickup' ? ' selected' : '') + '>' + esc(t('Pickup')) + '</option><option value="delivery"' + (CK.dl === 'delivery' ? ' selected' : '') + '>' + esc(t('Deliver to me')) + (num(SITE.cat.fee) ? ' (+' + esc(M(SITE.cat.fee)) + ')' : '') + '</option></select></label>' +
      (CK.dl === 'delivery' ? '<label>' + esc(t('Address')) + '<textarea id="ck_addr" rows="2">' + esc(CK.addr) + '</textarea></label>' : '') +
      '<label>' + esc(t('Payment')) + '<select id="ck_pay">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === CK.pay ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label><label>' + esc(t('Note (optional)')) + '<textarea id="ck_note" rows="2">' + esc(CK.note) + '</textarea></label></div>' +
      '<div class="tot"><div><span>' + esc(t('Subtotal')) + '</span><b>' + esc(M(T.t.sub)) + '</b></div>' + (T.t.disc ? '<div><span>' + esc(t('Discount')) + ' (' + esc(T.code) + ')</span><b>−' + esc(M(T.t.disc)) + '</b></div>' : '') + (T.t.fee ? '<div><span>' + esc(t('Delivery')) + '</span><b>' + esc(M(T.t.fee)) + '</b></div>' : '') + '<div class="g"><span>' + esc(t('Total')) + '</span><b>' + esc(M(T.t.total)) + '</b></div></div><button class="btn full" data-act="place">' + esc(t('Place order')) + '</button>';
  }
  function openCart() { openSheet(cartHTML()); }
  function reCart() { readCK(); if (SHEET) setSheet(cartHTML()); }

  function payText(method, total, ref) {
    var p = SITE.cat.pay, tot = '<b>' + esc(M(total)) + '</b>', r = '<b>' + esc(ref) + '</b>';
    if (method === 'mtn') return 'Send ' + tot + ' to MTN MoMo <b>' + esc(p.mtn) + '</b>' + (p.mtnn ? ' (' + esc(p.mtnn) + ')' : '') + '. Use reference ' + r + '.';
    if (method === 'airtel') return 'Send ' + tot + ' to Airtel Money <b>' + esc(p.airtel) + '</b>' + (p.airteln ? ' (' + esc(p.airteln) + ')' : '') + '. Use reference ' + r + '.';
    if (method === 'bank') return 'Transfer ' + tot + ' to: ' + esc(p.bank) + '. Use reference ' + r + '.';
    if (method === 'link') return 'Pay ' + tot + ' online: <a href="' + esc(Core.url(p.link)) + '" target="_blank" rel="noopener" style="color:var(--ac);text-decoration:underline">open payment page</a>. Reference ' + r + '.';
    return esc(t('Pay on pickup / delivery')) + ': ' + tot + '. ' + esc(t('Reference')) + ' ' + r;
  }
  function orderMsg(o) {
    return '*' + SITE.b.name + ' — order ' + o.ref + '*\n' + o.name + ' · ' + o.phone + '\n' + o.items.map(function (i) { return '• ' + i.q + ' × ' + i.n + ' — ' + M(i.p * i.q); }).join('\n') + (o.disc ? '\nDiscount: −' + M(o.disc) : '') + (o.fee ? '\nDelivery: ' + M(o.fee) : '') + '\n*Total: ' + M(o.total) + '*\n' + (o.dl === 'delivery' ? 'Deliver to: ' + o.addr : 'Pickup') + '\nPayment: ' + o.pay + (o.note ? '\nNote: ' + o.note : '');
  }
  function placeOrder() {
    readCK(); var T = totals(); if (!T.rows.length) return toast(t('Cart is empty'));
    if (CK.name.length < 2) return toast(t('Your name')); if (!Core.phoneOk(CK.phone)) return toast(t('Phone / WhatsApp')); if (CK.dl === 'delivery' && CK.addr.length < 4) return toast(t('Address'));
    var used = {}; DB.orders.forEach(function (o) { used[o.ref] = 1; });
    var o = { ref: Core.ref('ORD', Date.now(), Math.random, used), at: Date.now(), name: CK.name, phone: Core.normPhone(CK.phone), dl: CK.dl, addr: CK.dl === 'delivery' ? CK.addr : '', pay: CK.pay, note: CK.note, code: T.code,
      items: T.rows.map(function (r) { return { id: r.p.id, n: r.p.name, p: r.p.price, q: r.q }; }), sub: T.t.sub, disc: T.t.disc, fee: T.t.fee, total: T.t.total, st: 'Pending' };
    DB.orders.unshift(o); DB.orders = DB.orders.slice(0, 500); saveDB(); deliver('order', o);
    CART = []; ls.s('cart', CART); CK.promo = ''; CK.code = ''; var n = $('#cartn'); if (n) n.style.display = 'none';
    var link = wa(orderMsg(o));
    openSheet('<h3>' + esc(t('Order placed')) + ' ✓</h3><p>' + esc(t('Reference')) + ': <b>' + esc(o.ref) + '</b></p><div class="note">' + payText(o.pay, o.total, o.ref) + '</div>' +
      '<div class="act" style="margin-top:14px">' + (link ? '<a class="btn wa" target="_blank" rel="noopener" href="' + esc(link) + '">💬 ' + esc(t('Send on WhatsApp')) + '</a>' : '') + (on('track') ? '<button class="btn ghost" data-act="track" data-ref="' + esc(o.ref) + '">' + esc(t('Track order')) + '</button>' : '') + '<button class="btn ghost" data-act="close">' + esc(t('Close')) + '</button></div>');
  }
  function openTrack(ref) {
    openSheet('<h3>' + esc(t('Track order')) + '</h3><div class="fm"><label>' + esc(t('Reference')) + '<input id="tr_r" value="' + esc(ref || '') + '"></label><label>' + esc(t('Phone / WhatsApp')) + '<input id="tr_p" type="tel"></label><button class="btn" data-act="trackgo">' + esc(t('Track order')) + '</button></div><div id="tr_o"></div>');
  }
  function trackGo() {
    var r = val('tr_r').toUpperCase(), p = Core.normPhone(val('tr_p')), o = DB.orders.filter(function (x) { return x.ref === r && Core.normPhone(x.phone) === p; })[0], out = $('#tr_o');
    if (!out) return; out.innerHTML = o ? '<div class="note"><b>' + esc(t(o.st)) + '</b><br>' + o.items.map(function (i) { return esc(i.q + ' × ' + i.n); }).join('<br>') + '<br>' + esc(M(o.total)) + '</div>' : '<div class="note">—</div>';
  }

  /* ---------- booking / quote / contact / newsletter ---------- */
  function doBook() {
    var n = val('bk_n'), p = val('bk_p'), s = val('bk_s'); if (n.length < 2) return toast(t('Your name')); if (!Core.phoneOk(p)) return toast(t('Phone / WhatsApp')); if (!BK.day || !BK.time) return toast(t('Choose a time'));
    var used = {}; DB.bookings.forEach(function (b) { used[b.ref] = 1; });
    var b = { ref: Core.ref('BKG', Date.now(), Math.random, used), at: Date.now(), name: n, phone: Core.normPhone(p), svc: s, date: BK.day, time: BK.time, note: val('bk_m'), st: 'Pending', dep: DEP[s] || 0 };
    DB.bookings.unshift(b); DB.bookings = DB.bookings.slice(0, 500); saveDB(); deliver('booking', b); BK.time = ''; var sl = $('#slots'); if (sl) sl.innerHTML = slotsHTML();
    var msg = '*' + SITE.b.name + ' — booking ' + b.ref + '*\n' + b.name + ' · ' + b.phone + '\n' + b.svc + '\n' + b.date + ' ' + b.time + (b.note ? '\n' + b.note : ''), link = wa(msg), p2 = SITE.cat.pay || {};
    openSheet('<h3>' + esc(t('Confirm booking')) + ' ✓</h3><p>' + esc(b.svc) + '<br><b>' + esc(b.date + ' · ' + b.time) + '</b><br>' + esc(t('Reference')) + ': <b>' + esc(b.ref) + '</b></p>' +
      (b.dep ? '<div class="note">Deposit: <b>' + esc(M(b.dep)) + '</b>' + (p2.mtn ? ' — MTN <b>' + esc(p2.mtn) + '</b>' : '') + (p2.airtel ? ' — Airtel <b>' + esc(p2.airtel) + '</b>' : '') + '</div>' : '') +
      '<div class="act" style="margin-top:14px">' + (link ? '<a class="btn wa" target="_blank" rel="noopener" href="' + esc(link) + '">💬 ' + esc(t('Send on WhatsApp')) + '</a>' : '') + '<button class="btn ghost" data-act="close">' + esc(t('Close')) + '</button></div>');
  }
  function doEnquiry(kind, n, p, m, extra) {
    if (n.length < 2) return toast(t('Your name')); if (!Core.phoneOk(p) && !/@/.test(p)) return toast(t('Phone / WhatsApp')); if (m.length < 3) return toast(t('Message'));
    var used = {}; DB.enquiries.forEach(function (e) { used[e.ref] = 1; });
    var e = { ref: Core.ref('ENQ', Date.now(), Math.random, used), at: Date.now(), kind: kind, name: n, contact: p, msg: m, svc: extra || '', st: 'New' };
    DB.enquiries.unshift(e); DB.enquiries = DB.enquiries.slice(0, 300); saveDB(); deliver('enquiry', e);
    var link = wa('*' + SITE.b.name + ' — ' + kind + '*\n' + n + ' · ' + p + (extra ? '\n' + extra : '') + '\n' + m);
    openSheet('<h3>✓</h3><p>' + esc(t('Thank you! We will reply soon.')) + '</p><div class="act">' + (link ? '<a class="btn wa" target="_blank" rel="noopener" href="' + esc(link) + '">💬 ' + esc(t('Send on WhatsApp')) + '</a>' : '') + '<button class="btn ghost" data-act="close">' + esc(t('Close')) + '</button></div>');
  }

  /* ---------- owner admin (convenience, not security: everything is stored on this device) ---------- */
  var authed = false, AT = 'dash', EDIT = null;
  function lock() { return ls.g('lk', { n: 0, t: 0 }); }
  function doLogin() {
    var l = lock(), now = Date.now(); if (l.t > now) return toast('Too many attempts. Try again in ' + Math.ceil((l.t - now) / 1000) + 's');
    var ok = !!(BASE.adm && BASE.adm.h) && Core.safeEq(Core.hashPass(KEY, val('pw')), (OWN && OWN.patch && OWN.patch.adm && OWN.patch.adm.h && num(OWN.at) > num(BASE.updatedAt)) ? OWN.patch.adm.h : BASE.adm.h);
    if (ok) { ls.s('lk', { n: 0, t: 0 }); authed = true; renderAdmin(); return; }
    l.n++; if (l.n >= 5) { l.t = now + 30000; l.n = 0; } ls.s('lk', l); toast('Wrong passcode');
  }
  var AT_TABS = [['dash', '📊', 'Dashboard'], ['prod', '🛍', 'Products'], ['ord', '🧾', 'Orders'], ['bk', '📅', 'Bookings'], ['enq', '✉', 'Enquiries'], ['set', '⚙', 'Settings'], ['sec', '🔒', 'Backup']];
  function tabs(cls) { return AT_TABS.filter(function (x) { return !(x[0] === 'prod' && MODE() !== 'shop') && !(x[0] === 'ord' && MODE() !== 'shop') && !(x[0] === 'bk' && MODE() !== 'book'); }).map(function (x) { return '<button class="' + (AT === x[0] ? 'on' : '') + '" data-act="at" data-v="' + x[0] + '">' + x[1] + ' <span>' + x[2] + '</span></button>'; }).join(''); }
  var inp = function (id, label, v, type, ph) { return '<label>' + esc(label) + '<input id="' + id + '"' + (type ? ' type="' + type + '"' : '') + ' value="' + esc(v == null ? '' : v) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></label>'; };
  var area = function (id, label, v, rows) { return '<label>' + esc(label) + '<textarea id="' + id + '" rows="' + (rows || 3) + '">' + esc(v == null ? '' : v) + '</textarea></label>'; };
  var dt = function (ms) { var d = new Date(ms); return d.getDate() + '/' + (d.getMonth() + 1) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  var sel = function (id, opts, v, act, dataId) { return '<select id="' + id + '"' + (act ? ' data-ch="' + act + '" data-id="' + esc(dataId) + '"' : '') + '>' + opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'; };
  function aDash() {
    var live = DB.orders.filter(function (o) { return o.st !== 'Cancelled'; }), rev = live.reduce(function (a, o) { return a + o.total; }, 0), days = [], v = DB.visits || {}, i, d, mx = 1;
    for (i = 6; i >= 0; i--) { d = new Date(); d.setDate(d.getDate() - i); var k = Core.dateKey(d); days.push([k.slice(5), v[k] || 0]); mx = Math.max(mx, v[k] || 0); }
    return '<h2>Dashboard</h2><div class="kp"><div><b>' + DB.orders.length + '</b><span>Orders (this device)</span></div><div><b>' + esc(M(rev)) + '</b><span>Revenue</span></div><div><b>' + DB.bookings.filter(function (b) { return b.st === 'Pending'; }).length + '</b><span>Pending bookings</span></div><div><b>' + DB.enquiries.filter(function (e) { return e.st === 'New'; }).length + '</b><span>New enquiries</span></div><div><b>' + DB.subs.length + '</b><span>Subscribers</span></div></div>' +
      '<div class="cd"><b>Visits — last 7 days (this device)</b><div class="bars">' + days.map(function (x) { return '<i title="' + x[0] + ': ' + x[1] + '" style="height:' + Math.max(3, Math.round((x[1] / mx) * 100)) + '%"></i>'; }).join('') + '</div></div>' +
      '<div class="note" style="margin-top:14px">ℹ Orders, bookings and enquiries are stored on the device they were made on and sent to you by WhatsApp' + (SITE.ep ? ' and to your email endpoint' : '') + '. Use <b>Settings → Publish</b> to share your product and price changes with every visitor.</div>';
  }
  function aProd() {
    return '<h2>Products</h2><div class="act" style="margin-bottom:14px"><button class="btn" data-act="pnew">+ New product</button></div>' + (PRODUCTS.length ? PRODUCTS.map(function (p) {
      return '<div class="rw"><div class="th">' + (imgOf(p)[0] ? '<img src="' + esc(imgOf(p)[0]) + '" alt="">' : '') + '</div><div><b>' + esc(p.name) + '</b><br><small>' + esc(p.category || '') + ' · ' + esc(M(p.price)) + ' · stock ' + esc(p.stock == null ? '∞' : p.stock) + '</small></div><button class="btn ghost sm" data-act="pedit" data-id="' + esc(p.id) + '">Edit</button><button class="btn ghost sm" data-act="pdel" data-id="' + esc(p.id) + '">🗑</button></div>'; }).join('') : '<p class="empty">No products yet.</p>');
  }
  function pForm(p) {
    p = p || { id: '', name: '', category: '', price: '', stock: 10, description: '', images: [] };
    return '<h3>' + (p.id ? 'Edit product' : 'New product') + '</h3><div class="fm">' + inp('pf_n', 'Name', p.name) + inp('pf_c', 'Category', p.category) + '<div class="two">' + inp('pf_p', 'Price (' + cur() + ')', p.price, 'number') + inp('pf_s', 'Stock (0 = sold out)', p.stock, 'number') + '</div>' + area('pf_d', 'Description', p.description) +
      area('pf_i', 'Picture links (one per line)', arr(p.images).join('\n'), 3) + '<label>Or upload pictures<input id="pf_f" type="file" accept="image/*" multiple data-ch="pimg"></label><input type="hidden" id="pf_id" value="' + esc(p.id) + '"><button class="btn full" data-act="psave">Save</button></div>';
  }
  function aOrd() {
    return '<h2>Orders</h2><div class="act" style="margin-bottom:12px"><button class="btn ghost sm" data-act="csv" data-v="orders">⬇ CSV</button></div>' + (DB.orders.length ? DB.orders.map(function (o) {
      return '<div class="cd" style="margin-bottom:10px"><div class="act" style="justify-content:space-between"><b>' + esc(o.ref) + '</b><small>' + dt(o.at) + '</small></div><div>' + esc(o.name) + ' · ' + esc(o.phone) + '</div><div style="color:var(--mut);font-size:14px">' + o.items.map(function (i) { return esc(i.q + '× ' + i.n); }).join(', ') + '</div><div class="act" style="margin-top:8px"><b>' + esc(M(o.total)) + '</b>' + sel('', ['Pending', 'Paid', 'Ready', 'Delivered', 'Cancelled'], o.st, 'ostat', o.ref) + '<button class="btn ghost sm" data-act="rcpt" data-id="' + esc(o.ref) + '">Receipt</button><a class="btn wa sm" target="_blank" rel="noopener" href="' + esc(Core.waUrl(o.phone, 'Hello ' + o.name + ', about your order ' + o.ref + ' (' + o.st + ')')) + '">💬</a></div></div>'; }).join('') : '<p class="empty">No orders on this device yet.</p>');
  }
  function aBk() {
    return '<h2>Bookings</h2><div class="act" style="margin-bottom:12px"><button class="btn ghost sm" data-act="csv" data-v="bookings">⬇ CSV</button></div>' + (DB.bookings.length ? DB.bookings.map(function (b) {
      return '<div class="cd" style="margin-bottom:10px"><div class="act" style="justify-content:space-between"><b>' + esc(b.ref) + '</b><small>' + esc(b.date + ' ' + b.time) + '</small></div><div>' + esc(b.name) + ' · ' + esc(b.phone) + ' · ' + esc(b.svc) + '</div><div class="act" style="margin-top:8px">' + (b.dep ? '<small>Deposit ' + esc(M(b.dep)) + '</small>' : '') + sel('', ['Pending', 'Confirmed', 'Done', 'Cancelled'], b.st, 'bstat', b.ref) + '<a class="btn wa sm" target="_blank" rel="noopener" href="' + esc(Core.waUrl(b.phone, 'Hello ' + b.name + ', your booking ' + b.ref + ' for ' + b.date + ' ' + b.time + ' is ' + b.st)) + '">💬</a></div></div>'; }).join('') : '<p class="empty">No bookings on this device yet.</p>');
  }
  function aEnq() {
    return '<h2>Enquiries</h2><div class="act" style="margin-bottom:12px"><button class="btn ghost sm" data-act="csv" data-v="enquiries">⬇ CSV</button></div>' + (DB.enquiries.length ? DB.enquiries.map(function (e) {
      return '<div class="cd" style="margin-bottom:10px"><div class="act" style="justify-content:space-between"><b>' + esc(e.name) + '</b><small>' + dt(e.at) + ' · ' + esc(e.kind) + '</small></div><div>' + esc(e.contact) + (e.svc ? ' · ' + esc(e.svc) : '') + '</div><p style="margin:6px 0">' + esc(e.msg) + '</p><div class="act"><button class="btn ghost sm" data-act="edone" data-id="' + esc(e.ref) + '">' + (e.st === 'New' ? 'Mark done' : '✓ Done') + '</button><button class="btn ghost sm" data-act="edel" data-id="' + esc(e.ref) + '">🗑</button></div></div>'; }).join('') : '<p class="empty">No enquiries yet.</p>');
  }
  function aSet() {
    var b = SITE.b, c = SITE.cat, p = c.pay || {}, k = SITE.bk || {}, days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], closed = arr(k.closed).map(Number);
    return '<h2>Settings</h2><div class="fm cd"><h3>Business</h3>' + inp('s_name', 'Business name', b.name) + inp('s_tag', 'Tagline', b.tag) + '<div class="two">' + inp('s_phone', 'Phone', b.phone) + inp('s_wa', 'WhatsApp number', b.wa) + '</div>' + inp('s_email', 'Email', b.email) + inp('s_addr', 'Address', b.addr) + inp('s_hours', 'Opening hours', b.hours) + inp('s_ann', 'Announcement bar (optional)', b.announce) + '</div>' +
      (MODE() === 'shop' ? '<div class="fm cd" style="margin-top:14px"><h3>Payments & delivery</h3><div class="two">' + inp('s_mtn', 'MTN MoMo number', p.mtn) + inp('s_mtnn', 'MTN account name', p.mtnn) + inp('s_air', 'Airtel Money number', p.airtel) + inp('s_airn', 'Airtel account name', p.airteln) + '</div>' + inp('s_bank', 'Bank details', p.bank) + inp('s_link', 'Online payment link (optional)', p.link) + inp('s_fee', 'Delivery fee (' + cur() + ')', c.fee, 'number') + area('s_promo', 'Promo codes (one per line, e.g. WELCOME10=10% or SAVE5000=5000)', c.promos, 3) + '</div>' : '') +
      (MODE() === 'book' ? '<div class="fm cd" style="margin-top:14px"><h3>Booking</h3>' + inp('s_slots', 'Time slots (comma separated)', k.slots) + inp('s_ahead', 'Days open for booking', k.ahead, 'number') + '<div class="act">' + days.map(function (d, i) { return '<label class="chk" style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="s_cl" value="' + i + '"' + (closed.indexOf(i) >= 0 ? ' checked' : '') + '>' + d + ' closed</label>'; }).join('') + '</div>' + area('s_dep', 'Deposits (one per line: Service=Amount)', k.deposit, 3) + '</div>' : '') +
      '<div class="act" style="margin-top:14px"><button class="btn" data-act="sset">Save changes</button><button class="btn ghost" data-act="publish">⬆ Publish (download site-data.json)</button></div><div class="note">Your changes are saved on this device. To show them to <b>all visitors</b>, click Publish and upload the downloaded <code>site-data.json</code> next to your <code>index.html</code>.</div>';
  }
  function aSec() {
    return '<h2>Backup & security</h2><div class="fm cd"><h3>Change owner passcode</h3>' + inp('pw1', 'New passcode (8+ characters)', '', 'password') + '<button class="btn" data-act="pw">Change passcode</button></div><div class="act cd" style="margin-top:14px"><button class="btn ghost" data-act="bkx">⬇ Export backup</button><label class="btn ghost" style="cursor:pointer">⬆ Import backup<input type="file" accept="application/json,.json" data-ch="bki" style="display:none"></label><button class="btn red" data-act="reset">Reset everything on this device</button></div>';
  }
  function renderAdmin() {
    document.documentElement.removeAttribute('data-menu'); document.title = 'Owner admin — ' + SITE.b.name;
    if (!authed) { app.innerHTML = '<div class="lgn"><div class="cd"><h2>' + esc(SITE.b.name) + '</h2><p style="color:var(--mut)">Owner login</p><input id="pw" type="password" autocomplete="current-password" placeholder="Passcode" aria-label="Passcode" style="padding:13px;border-radius:12px;border:1px solid var(--ln);background:var(--bg)"><button class="btn" data-act="login">Sign in</button><a href="#home" style="color:var(--mut)">← Back to site</a></div></div>'; return; }
    var body = { dash: aDash, prod: aProd, ord: aOrd, bk: aBk, enq: aEnq, set: aSet, sec: aSec }[AT] || aDash;
    app.innerHTML = '<div class="ad"><aside class="sb"><b style="font-family:var(--hf);padding:8px 14px 14px;font-size:18px">' + esc(SITE.b.name) + '</b>' + tabs() + '<a href="#home" style="margin-top:auto;padding:11px 14px;color:var(--mut)">← View site</a><button data-act="logout">Sign out</button></aside><main class="am">' + body() + '</main><nav class="tb">' + tabs() + '<button data-act="logout"><span>Out</span></button></nav></div>';
  }
  function route() {
    closeSheet(true); lbClose();
    if (location.hash === '#admin' && on('admin')) { if (!(BASE.adm && BASE.adm.h)) { toast('Owner admin is not set up.'); location.hash = ''; return; } renderAdmin(); window.scrollTo(0, 0); }
    else { document.title = SITE.seoTitle || SITE.b.name; render(); } // owner stays signed in while this page is open (sign out ends it)
  }
  function patchOwn(fn) { OWN = OWN && OWN.patch ? OWN : { patch: {} }; fn(OWN.patch); OWN.at = Date.now(); if (!ls.s('own', OWN)) toast('Could not save — storage is full.'); compute(); }
  function saveSettings() {
    patchOwn(function (p) {
      p.b = Object.assign({}, p.b || SITE.b, { name: val('s_name') || SITE.b.name, tag: val('s_tag'), phone: val('s_phone'), wa: val('s_wa'), email: val('s_email'), addr: val('s_addr'), hours: val('s_hours'), announce: val('s_ann') });
      if (MODE() === 'shop') p.cat = Object.assign({}, p.cat || SITE.cat, { fee: num(val('s_fee')), promos: $('#s_promo').value, pay: { mtn: val('s_mtn'), mtnn: val('s_mtnn'), airtel: val('s_air'), airteln: val('s_airn'), bank: val('s_bank'), link: val('s_link'), cash: SITE.cat.pay.cash !== false } });
      if (MODE() === 'book') p.bk = Object.assign({}, p.bk || SITE.bk, { slots: val('s_slots'), ahead: Core.clamp(num(val('s_ahead'), 14), 1, 120), closed: $$('.s_cl').filter(function (c) { return c.checked; }).map(function (c) { return +c.value; }), deposit: $('#s_dep').value });
    });
    toast('Saved ✓'); renderAdmin();
  }
  function saveProduct() {
    var name = val('pf_n'); if (!name) return toast('Name is required'); var id = val('pf_id') || 'p' + Date.now().toString(36), imgs = $('#pf_i').value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var np = { id: id, name: name.slice(0, 80), category: val('pf_c').slice(0, 40), price: Math.max(0, num(val('pf_p'))), stock: Math.max(0, Math.floor(num(val('pf_s'), 10))), description: $('#pf_d').value.slice(0, 2000), images: imgs.slice(0, 6) };
    var list = PRODUCTS.map(function (p) { return p.id === id ? np : p; }); if (!PRODUCTS.some(function (p) { return p.id === id; })) list.push(np);
    patchOwn(function (p) { p.cat = Object.assign({}, p.cat || SITE.cat, { products: list }); }); closeSheet(); toast('Saved ✓'); renderAdmin();
  }
  function resize(file, max) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onerror = rej; r.onload = function () { var im = new Image(); im.onerror = rej; im.onload = function () { var s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.76)); }; im.src = r.result; }; r.readAsDataURL(file); });
  }
  var CSVS = { orders: [DB, 'orders', [{ h: 'Ref', v: 'ref' }, { h: 'Date', v: function (o) { return new Date(o.at).toISOString(); } }, { h: 'Name', v: 'name' }, { h: 'Phone', v: 'phone' }, { h: 'Items', v: function (o) { return o.items.map(function (i) { return i.q + 'x ' + i.n; }).join('; '); } }, { h: 'Total', v: 'total' }, { h: 'Payment', v: 'pay' }, { h: 'Status', v: 'st' }] ],
    bookings: [DB, 'bookings', [{ h: 'Ref', v: 'ref' }, { h: 'Name', v: 'name' }, { h: 'Phone', v: 'phone' }, { h: 'Service', v: 'svc' }, { h: 'Date', v: 'date' }, { h: 'Time', v: 'time' }, { h: 'Deposit', v: 'dep' }, { h: 'Status', v: 'st' }] ],
    enquiries: [DB, 'enquiries', [{ h: 'Ref', v: 'ref' }, { h: 'Type', v: 'kind' }, { h: 'Name', v: 'name' }, { h: 'Contact', v: 'contact' }, { h: 'Message', v: 'msg' }, { h: 'Status', v: 'st' }] ] };
  function download(name, text, type) { try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 500); } catch (e) { toast('Download failed'); } }
  function receipt(ref) {
    var o = DB.orders.filter(function (x) { return x.ref === ref; })[0]; if (!o) return;
    openSheet('<h3>' + esc(SITE.b.name) + '</h3><p>' + esc(t('Reference')) + ' <b>' + esc(o.ref) + '</b> · ' + dt(o.at) + '<br>' + esc(o.name) + ' · ' + esc(o.phone) + '</p>' + o.items.map(function (i) { return '<div class="rw"><div><b>' + esc(i.n) + '</b><br><small>' + i.q + ' × ' + esc(M(i.p)) + '</small></div><b>' + esc(M(i.p * i.q)) + '</b></div>'; }).join('') + '<div class="tot">' + (o.disc ? '<div><span>Discount</span><b>−' + esc(M(o.disc)) + '</b></div>' : '') + (o.fee ? '<div><span>Delivery</span><b>' + esc(M(o.fee)) + '</b></div>' : '') + '<div class="g"><span>Total</span><b>' + esc(M(o.total)) + '</b></div></div><button class="btn" data-act="print">🖨 Print</button>');
  }

  /* ---------- the ONE click handler ---------- */
  var ACT = {
    close: function () { closeSheet(); }, yes: function () { var f = CONFIRM; CONFIRM = null; closeSheet(); if (f) f(); }, top: function () { window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); },
    menu: function (a) { var m = $('#menu'); if (!m) return; var o = m.classList.toggle('open'); a.setAttribute('aria-expanded', String(o)); },
    theme: function () { var d = !isDark(); TH = d ? 'dark' : 'light'; ls.s('th', TH); setTheme(TH); render(); }, lang: function () { LG = LG === 'sw' ? 'en' : 'sw'; ls.s('lg', LG); render(); },
    prev: function () { slGo(SL.i - 1); slAuto(); }, next: function () { slGo(SL.i + 1); slAuto(); }, dot: function (a) { slGo(+a.dataset.i); slAuto(); },
    pause: function (a) { SL.paused = !SL.paused; a.textContent = SL.paused ? '▶' : '❚❚'; slGo(SL.i); slAuto(); },
    cat: function (a) { FILT.cat = a.dataset.v; $$('#chips .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === FILT.cat); }); redraw(); },
    favonly: function (a) { FILT.fav = !FILT.fav; a.classList.toggle('on', FILT.fav); redraw(); },
    open: function (a) { openProduct(a.dataset.id); }, thumb: function (a) { openProduct(a.dataset.id, +a.dataset.i); },
    plb: function (a) { var p = findP(a.dataset.id); if (p) lbOpen(imgOf(p).map(function (u) { return { u: u, c: p.name }; }), +a.dataset.i || 0); },
    fav: function (a, ev) { ev.stopPropagation(); var id = a.dataset.id, i = FAV.indexOf(id); if (i >= 0) FAV.splice(i, 1); else FAV.push(id); ls.s('fav', FAV); if (a.dataset.keep) a.textContent = i >= 0 ? '♡' : '♥'; else { a.textContent = i >= 0 ? '♡' : '♥'; a.setAttribute('aria-pressed', String(i < 0)); if (FILT.fav) redraw(); } },
    add: function (a, ev) { ev.stopPropagation(); addToCart(a.dataset.id, 1); }, cart: function () { openCart(); },
    inc: function (a) { addToCart(a.dataset.id, 1); reCart(); }, dec: function (a) { var i; for (i = 0; i < CART.length; i++) if (CART[i].id === a.dataset.id) { CART[i].q--; if (CART[i].q < 1) CART.splice(i, 1); break; } ls.s('cart', CART); var n = $('#cartn'); if (n) { n.textContent = cartCount(); n.style.display = cartCount() ? '' : 'none'; } reCart(); },
    promo: function () { readCK(); var sub = Core.cartTotals(Core.cartRows(CART, PRODUCTS), 0, 0).sub, r = Core.applyPromo(CK.promo, PROMOS, sub); CK.code = r.code; toast(r.code ? r.code + ' ✓' : 'Invalid code'); reCart(); },
    place: placeOrder, track: function (a) { openTrack(a && a.dataset.ref); }, trackgo: trackGo,
    lb: function (a) { var items = arr((SITE.gal || {}).items).filter(function (x) { return x && Core.url(x.u, true); }).map(function (x) { return { u: Core.url(x.u, true), c: x.c }; }); lbOpen(items, +a.dataset.i || 0); }, lbx: lbClose, lbp: function () { lbMove(-1); }, lbn: function () { lbMove(1); },
    day: function (a) { BK.day = a.dataset.v; BK.time = ''; var d = $('#days'), s = $('#slots'); if (d) d.innerHTML = daysHTML(); if (s) s.innerHTML = slotsHTML(); }, slot: function (a) { BK.time = a.dataset.v; var s = $('#slots'); if (s) s.innerHTML = slotsHTML(); },
    book: doBook, quote: function () { doEnquiry('Quote', val('qt_n'), val('qt_p'), val('qt_m'), val('qt_s')); }, contact: function () { doEnquiry('Message', val('ct_n'), val('ct_p'), val('ct_m')); },
    news: function () { var e = val('nl'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast(t('Your email')); if (DB.subs.indexOf(e) < 0) { DB.subs.push(e); saveDB(); deliver('subscriber', { email: e }); } toast('✓'); },
    login: doLogin, logout: function () { authed = false; location.hash = '#home'; }, at: function (a) { AT = a.dataset.v; renderAdmin(); },
    pnew: function () { openSheet(pForm(), true); }, pedit: function (a) { openSheet(pForm(findP(a.dataset.id)), true); }, psave: saveProduct,
    pdel: function (a) { var id = a.dataset.id; confirmDlg('Delete this product?', function () { patchOwn(function (p) { p.cat = Object.assign({}, p.cat || SITE.cat, { products: PRODUCTS.filter(function (x) { return x.id !== id; }) }); }); renderAdmin(); }, 'Delete'); },
    sset: saveSettings, csv: function (a) { var c = CSVS[a.dataset.v]; download(a.dataset.v + '.csv', '\ufeff' + Core.csv(DB[c[1]], c[2]), 'text/csv'); }, rcpt: function (a) { receipt(a.dataset.id); }, print: function () { window.print(); },
    edone: function (a) { DB.enquiries.forEach(function (e) { if (e.ref === a.dataset.id) e.st = 'Done'; }); saveDB(); renderAdmin(); }, edel: function (a) { DB.enquiries = DB.enquiries.filter(function (e) { return e.ref !== a.dataset.id; }); saveDB(); renderAdmin(); },
    publish: function () { var d = Core.merge(BASE, OWN && OWN.patch ? OWN.patch : {}); d.updatedAt = Date.now(); delete d.preview; download('site-data.json', JSON.stringify(d, null, 1)); toast('Upload site-data.json to your hosting'); },
    pw: function () { var p = val('pw1'); if (p.length < 8) return toast('Use 8+ characters'); patchOwn(function (x) { x.adm = { h: Core.hashPass(KEY, p) }; }); toast('Passcode changed ✓'); },
    bkx: function () { download(KEY + '-backup.json', JSON.stringify({ db: DB, own: OWN })); },
    reset: function () { confirmDlg('Erase orders, bookings, enquiries and your local edits on this device?', function () { DB = { orders: [], bookings: [], enquiries: [], subs: [], visits: {} }; OWN = null; saveDB(); ls.s('own', null); compute(); renderAdmin(); toast('Reset'); }, 'Erase'); }
  };
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null; if (!a) { if (SHEET && ev.target === SHEET) closeSheet(); var m = $('#menu'); if (m && m.classList.contains('open') && !(ev.target.closest && ev.target.closest('.nav'))) m.classList.remove('open'); return; }
    var f = ACT[a.dataset.act]; if (!f) return; if (a.tagName === 'A' && a.getAttribute('href') === '#') ev.preventDefault();
    try { f(a, ev); } catch (e) { if (window.console) console.error(e); toast('Something went wrong — please try again.'); }
    var m2 = $('#menu'); if (m2 && a.dataset.act !== 'menu') m2.classList.remove('open');
  });
  document.addEventListener('click', function (ev) { var a = ev.target && ev.target.closest ? ev.target.closest('#menu a, .nl a') : null; if (a) { var m = $('#menu'); if (m) m.classList.remove('open'); } });
  function redraw() { var g = $('#grid'); if (g) { g.innerHTML = gridHTML(); reveal(); } }
  var qT; document.addEventListener('input', function (ev) { var e = ev.target; if (e && e.dataset && e.dataset.in === 'q') { clearTimeout(qT); qT = setTimeout(function () { FILT.q = e.value; redraw(); }, 140); } });
  document.addEventListener('change', function (ev) {
    var e = ev.target, k = e && e.dataset && e.dataset.ch; if (!k) return;
    if (k === 'sort') { FILT.sort = e.value; redraw(); } else if (k === 'ckdl') reCart();
    else if (k === 'ostat') { DB.orders.forEach(function (o) { if (o.ref === e.dataset.id) o.st = e.value; }); saveDB(); toast('✓'); }
    else if (k === 'bstat') { DB.bookings.forEach(function (o) { if (o.ref === e.dataset.id) o.st = e.value; }); saveDB(); toast('✓'); }
    else if (k === 'pimg') { var files = Array.prototype.slice.call(e.files || []).slice(0, 6); Promise.all(files.map(function (f) { return resize(f, 900); })).then(function (urls) { var ta = $('#pf_i'); if (ta) ta.value = (ta.value ? ta.value + '\n' : '') + urls.join('\n'); toast(urls.length + ' ✓'); }, function () { toast('Could not read that picture'); }); }
    else if (k === 'bki') { var f2 = e.files && e.files[0]; if (!f2) return; var r = new FileReader(); r.onload = function () { try { var d = JSON.parse(r.result); if (d.db && Array.isArray(d.db.orders)) { DB = d.db; ['bookings', 'enquiries', 'subs'].forEach(function (x) { if (!Array.isArray(DB[x])) DB[x] = []; }); saveDB(); } if (d.own && d.own.patch) { OWN = d.own; ls.s('own', OWN); compute(); } toast('Backup restored ✓'); renderAdmin(); } catch (x) { toast('That file is not a valid backup'); } }; r.readAsText(f2); }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { if (LB) lbClose(); else closeSheet(); } else if (LB && ev.key === 'ArrowLeft') lbMove(-1); else if (LB && ev.key === 'ArrowRight') lbMove(1); else if (ev.key === 'Enter' && ev.target && ev.target.id === 'pw') doLogin(); });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('hashchange', route);
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) flush(); });

  /* ---------- boot ---------- */
  var today = Core.dateKey(new Date()); if (!ls.g('v_' + today, false)) { ls.s('v_' + today, true); DB.visits = Core.bumpVisit(DB.visits, today); saveDB(); }
  route(); flush();
  if (window.fetch && /^https?:/.test(location.protocol) && !BASE.preview) {
    var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    fetch('site-data.json', { cache: 'no-cache', signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      clearTimeout(tm); if (!d || typeof d !== 'object' || d.key !== KEY || !(num(d.updatedAt) > num(BASE.updatedAt))) return;
      BASE = d; compute(); if (location.hash !== '#admin') render(); else if (authed) renderAdmin();
    }).catch(function () { clearTimeout(tm); });
  }
  window.__site = { Core: Core, get: function () { return { DB: DB, SITE: SITE, CART: CART }; } };
})();
