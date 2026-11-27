// src/lib/builder/pro.ts — "Pro" self-sufficient sites (shop / booking / quotes + owner admin), powered by the Site Engine
// (engine/*.js, compiled into engine.generated.ts). The editor, validator and AI all work from PRO_GROUPS.
import { COL, EMO, FONT_PAIRS, IMG, LIST, NUM, PASS, SEL, T, TA, TOG, URLF, defaultsFor, fieldDoc, o, type Field, type ProConfig, type SiteConfig } from './schema';
import { ASSET_RE, safeUrl } from './sanitize';
import { hashPass } from './sha256';
import { faviconFor } from '../icons';
import { ENGINE_APP_JS, ENGINE_CORE_JS, ENGINE_CSS } from './engine.generated';
import type { BuildOptions, BuiltSite } from './generate';

export interface ProGroup { id: string; title: string; icon: string; help?: string; fields: Field[] }

export const PRO_SECTIONS = ['about', 'services', 'catalog', 'gallery', 'testimonials', 'faq', 'book', 'quote', 'contact'] as const;
const SEC_OPTS = o(['about', 'About'], ['services', 'Services'], ['catalog', 'Shop / catalog'], ['gallery', 'Gallery'], ['testimonials', 'Reviews'], ['faq', 'FAQ'], ['book', 'Booking'], ['quote', 'Quote request'], ['contact', 'Contact']);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RADIUS = o(['sharp', 'Square'], ['soft', 'Soft'], ['round', 'Very round']);

export const PRO_GROUPS: ProGroup[] = [
  { id: 'setup', title: 'Site type & sections', icon: 'layers', help: 'Choose what visitors can do, and which sections appear (drag ↑↓ to reorder).', fields: [
    SEL('mode', 'What should visitors be able to do?', o(['shop', 'Buy online (cart, checkout, orders)'], ['book', 'Book appointments'], ['quote', 'Ask for quotes'], ['none', 'Just browse (showcase)']), 'shop'),
    T('currency', 'Currency code', 'UGX', { max: 5 }),
    SEL('lang', 'Site language', o(['en', 'English'], ['sw', 'Kiswahili'], ['fr', 'French']), 'en'),
    LIST('order', 'Page sections', [SEL('id', 'Section', SEC_OPTS, 'about'), TOG('show', 'Show this section', true)], PRO_SECTIONS.map((id) => ({ id, show: true })), { max: 9, itemLabel: 'Section', titleKey: 'id' }),
  ] },
  { id: 'business', title: 'Business details', icon: 'store', fields: [
    T('name', 'Business name', 'Your Business', { max: 60 }), T('tag', 'Tagline', 'What makes you special, in one line', { max: 120 }),
    TA('about', 'About your business', 'Tell customers who you are and why they should trust you.\n\nUse a blank line for a new paragraph.', { max: 1500 }),
    T('phone', 'Phone', '', { max: 30 }), T('wa', 'WhatsApp number (customers will message you here)', '', { max: 20, placeholder: '0700123456' }), T('email', 'Email', '', { max: 100 }),
    T('addr', 'Address', '', { max: 160 }), T('hours', 'Opening hours', 'Mon–Sat 8:00–18:00', { max: 120 }), T('ig', 'Instagram (handle or link)', '', { max: 100 }), T('announce', 'Announcement bar (optional)', '', { max: 140 }),
    IMG('logo', 'Logo (optional)', ''), IMG('logoDark', 'Logo for dark mode (optional)', ''), T('mono', 'Initials (shown if no logo)', 'YB', { max: 3 }),
  ] },
  { id: 'look', title: 'Look & feel', icon: 'palette', fields: [
    COL('accent', 'Main colour', '#2563eb'), COL('accent2', 'Second colour', '#0ea5e9'),
    SEL('theme', 'Light / dark', o(['auto', 'Follow the visitor’s device'], ['light', 'Always light'], ['dark', 'Always dark']), 'auto'),
    SEL('fontPair', 'Fonts', FONT_PAIRS.map((f) => ({ value: f.id, label: f.label })), 'modern'), SEL('radius', 'Corners', RADIUS, 'soft'),
  ] },
  { id: 'hero', title: 'Top banner (slider)', icon: 'image', fields: [
    SEL('fx', 'Slide effect', o(['fade', 'Fade'], ['slide', 'Slide'], ['zoom', 'Zoom']), 'fade'), TOG('auto', 'Change slides automatically', true), NUM('speed', 'Seconds per slide', 5.5, { min: 2, max: 20 }),
    LIST('slides', 'Slides', [IMG('u', 'Picture', ''), T('t', 'Headline', 'Welcome', { max: 100 }), T('s', 'Sub-headline', '', { max: 200 }), T('cta', 'Button text', 'Learn more', { max: 24 }), URLF('link', 'Button link (empty = main action)', '')],
      [{ u: '', t: 'Welcome to our business', s: 'Quality you can trust', cta: 'Get started', link: '' }], { max: 8, itemLabel: 'Slide', titleKey: 't' }),
  ] },
  { id: 'about', title: 'About section', icon: 'book', fields: [
    T('eyebrow', 'Small label', 'Our story', { max: 30 }), T('title', 'Title', 'About us', { max: 80 }), IMG('img', 'Picture', ''),
    LIST('stats', 'Numbers', [T('v', 'Number', '10+', { max: 12 }), T('l', 'Label', 'Years', { max: 30 })], [{ v: '100+', l: 'Happy customers' }, { v: '5', l: 'Years' }, { v: '24/7', l: 'Support' }], { max: 4, itemLabel: 'Number', titleKey: 'l' }),
  ] },
  { id: 'services', title: 'Services', icon: 'sparkles', fields: [
    T('eyebrow', 'Small label', 'What we do', { max: 30 }), T('title', 'Title', 'Our services', { max: 80 }), TA('intro', 'Intro', '', { max: 240 }),
    LIST('items', 'Services', [T('t', 'Name', 'Service', { max: 60 }), TA('d', 'Description', '', { max: 300 }), T('p', 'Price note (optional)', '', { max: 40 })],
      [{ t: 'Our first service', d: 'Describe what you offer.', p: '' }, { t: 'Another service', d: 'Describe it here.', p: '' }], { max: 12, itemLabel: 'Service', titleKey: 't' }),
  ] },
  { id: 'catalog', title: 'Shop: products, payments & delivery', icon: 'shopping-bag', help: 'Used when visitors can buy online.', fields: [
    T('eyebrow', 'Small label', 'Shop', { max: 30 }), T('title', 'Title', 'Our products', { max: 80 }), TA('intro', 'Intro', '', { max: 240 }),
    NUM('fee', 'Delivery fee', 0), TA('promos', 'Promo codes (one per line, e.g. WELCOME10=10% or SAVE5000=5000)', '', { max: 400 }),
    T('mtn', 'MTN Mobile Money number', '', { max: 20 }), T('mtnn', 'MTN account name', '', { max: 40 }), T('airtel', 'Airtel Money number', '', { max: 20 }), T('airteln', 'Airtel account name', '', { max: 40 }),
    T('bank', 'Bank transfer details (optional)', '', { max: 200 }), URLF('link', 'Online payment link (optional)', ''), TOG('cash', 'Allow cash on pickup / delivery', true),
    LIST('products', 'Products', [T('name', 'Name', 'Product', { max: 80 }), T('category', 'Category', 'General', { max: 40 }), NUM('price', 'Price', 10000), NUM('stock', 'In stock (0 = sold out)', 20, { max: 100000 }), TA('description', 'Description', '', { max: 1500 }),
      LIST('images', 'Pictures', [IMG('u', 'Picture', '')], [], { max: 6, itemLabel: 'Picture', titleKey: 'u' })],
      [{ name: 'Sample product', category: 'General', price: 10000, stock: 20, description: 'Describe your product.', images: [] }], { max: 60, itemLabel: 'Product', titleKey: 'name' }),
  ] },
  { id: 'booking', title: 'Booking / quotes', icon: 'calendar', help: 'Used for appointment or quote sites.', fields: [
    T('eyebrow', 'Small label', 'Book now', { max: 30 }), T('title', 'Title', 'Book an appointment', { max: 80 }), TA('intro', 'Intro', 'Choose a day and time that suits you.', { max: 240 }),
    T('slots', 'Time slots (comma separated)', '09:00, 10:00, 11:00, 14:00, 15:00, 16:00', { max: 200 }), NUM('ahead', 'How many days ahead can people book?', 14, { min: 1, max: 120 }),
    ...DAYS.map((d, i) => TOG(`closed${i}`, `Closed on ${d}`, i === 0)), TA('deposit', 'Deposits (one per line: Service name=Amount)', '', { max: 400 }),
  ] },
  { id: 'gallery', title: 'Gallery', icon: 'camera', fields: [
    T('eyebrow', 'Small label', 'Gallery', { max: 30 }), T('title', 'Title', 'Our work', { max: 80 }), TA('intro', 'Intro', '', { max: 240 }),
    LIST('items', 'Photos', [IMG('u', 'Photo', ''), T('c', 'Caption', '', { max: 80 })], [], { max: 40, itemLabel: 'Photo', titleKey: 'c' }),
  ] },
  { id: 'reviews', title: 'Customer reviews', icon: 'message-circle', fields: [
    T('title', 'Title', 'What customers say', { max: 80 }),
    LIST('items', 'Reviews', [T('n', 'Customer name', '', { max: 50 }), TA('q', 'Review', '', { max: 400 })], [{ n: 'Happy Customer', q: 'Excellent service — I will definitely come back!' }], { max: 12, itemLabel: 'Review', titleKey: 'n' }),
  ] },
  { id: 'faq', title: 'FAQ', icon: 'help-circle', fields: [
    T('title', 'Title', 'Frequently asked questions', { max: 80 }),
    LIST('items', 'Questions', [T('q', 'Question', '', { max: 150 }), TA('a', 'Answer', '', { max: 600 })], [{ q: 'How do I order?', a: 'Choose what you like and send us your order — we will confirm quickly.' }], { max: 15, itemLabel: 'Question', titleKey: 'q' }),
  ] },
  { id: 'contact', title: 'Contact & order delivery', icon: 'phone', fields: [
    T('eyebrow', 'Small label', 'Say hello', { max: 30 }), T('title', 'Title', 'Contact us', { max: 80 }), TA('intro', 'Intro', 'We reply fast — usually within the hour.', { max: 240 }),
    URLF('endpoint', 'Send orders & bookings to my email (optional — paste a Formspree / Getform link)', '', { help: 'Orders always go to your WhatsApp. Add this link to ALSO receive them by email.' }),
  ] },
  { id: 'features', title: 'Features on / off', icon: 'sliders', fields: [
    TOG('theme', 'Light / dark button', true), TOG('lang', 'English ⇄ Kiswahili button', true), TOG('wa', 'Floating WhatsApp button', true), TOG('top', 'Back-to-top button', true),
    TOG('fav', 'Favourites (hearts)', true), TOG('track', 'Order tracking', true), TOG('news', 'Newsletter sign-up', true), TOG('admin', 'Owner admin panel (#admin)', true),
    TOG('cloud', 'Cloud inbox — orders, bookings & messages appear in your admin on EVERY device', true),
  ] },
  { id: 'owner', title: 'Owner passcode', icon: 'lock', help: 'Protects your in-site admin panel. Only a scrambled (hashed) version is stored.', fields: [
    PASS('adminHash', 'Owner passcode', { companion: 'cloudVerifier' }),
    PASS('cloudVerifier', 'Cloud inbox key', { hidden: true }),
  ] },
  { id: 'seo', title: 'Search engines', icon: 'search', fields: [
    T('title', 'Page title (Google)', '', { max: 70 }), TA('description', 'Description (Google)', '', { max: 160 }), EMO('favicon', 'Browser tab icon', 'shopping-bag'),
  ] },
];

export function newProKey(): string {
  const A = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let k = '';
  for (let i = 0; i < 8; i++) k += A[Math.floor(Math.random() * A.length)];
  return k;
}
export function defaultPro(mode: 'shop' | 'book' | 'quote' | 'none' = 'shop'): ProConfig {
  const pro: ProConfig = { key: newProKey() };
  for (const g of PRO_GROUPS) pro[g.id] = defaultsFor(g.fields);
  pro.setup.mode = mode;
  return pro;
}

/* ───────── compile editor settings → the JSON the engine reads ───────── */
export function ownerPasscode(secret: string, projectId: string): string {
  // stable per project, so re-downloading gives the same passcode; unguessable without the server secret
  const h = hashPass(secret || 'dev', 'owner-passcode:' + projectId);
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += A[parseInt(h.slice(i * 2, i * 2 + 2), 16) % A.length];
  return out;
}

export function proToSite(cfg: SiteConfig, opts: { mode: BuildOptions['mode']; assetSrc: (id: string) => string; adminHash?: string; cloudUrl?: string }): Record<string, any> {
  const p = cfg.pro as ProConfig;
  const img = (v: string) => { const m = String(v || '').match(ASSET_RE); return m ? opts.assetSrc(m[1]) : String(v || ''); };
  const b = p.business, k = p.booking, c = p.catalog, h = p.hero;
  const ep = safeUrl(p.contact.endpoint);
  const preview = opts.mode !== 'export';
  return {
    v: 1, key: p.key, updatedAt: preview ? 1 : Date.now(), preview, lang: p.setup.lang, mode: p.setup.mode, cur: String(p.setup.currency || 'UGX').toUpperCase().slice(0, 5), theme: p.look.theme, seoTitle: p.seo.title || b.name,
    sec: ['hero', ...p.setup.order.filter((s: any) => s.show).map((s: any) => s.id)],
    b: { name: b.name, tag: b.tag, about: b.about, phone: b.phone, wa: b.wa, email: b.email, addr: b.addr, hours: b.hours, ig: b.ig, announce: b.announce, logo: img(b.logo), logoDark: img(b.logoDark), mono: b.mono },
    hero: { fx: h.fx, auto: h.auto, sec: h.speed, slides: h.slides.map((s: any) => ({ u: img(s.u), t: s.t, s: s.s, cta: s.cta, link: safeUrl(s.link) })) },
    about: { eyebrow: p.about.eyebrow, title: p.about.title, img: img(p.about.img), stats: p.about.stats.map((s: any) => ({ v: s.v, l: s.l })) },
    sv: { eyebrow: p.services.eyebrow, title: p.services.title, intro: p.services.intro, items: p.services.items.map((s: any) => ({ t: s.t, d: s.d, p: s.p })) },
    cat: { eyebrow: c.eyebrow, title: c.title, intro: c.intro, fee: c.fee, promos: c.promos, pay: { mtn: c.mtn, mtnn: c.mtnn, airtel: c.airtel, airteln: c.airteln, bank: c.bank, link: safeUrl(c.link), cash: c.cash },
      products: c.products.map((x: any, i: number) => ({ id: 'p' + (i + 1), name: x.name, category: x.category, price: x.price, stock: x.stock, description: x.description, images: x.images.map((m: any) => img(m.u)).filter(Boolean) })) },
    bk: { eyebrow: k.eyebrow, title: k.title, intro: k.intro, slots: k.slots, ahead: k.ahead, closed: DAYS.map((_, i) => (k[`closed${i}`] ? i : -1)).filter((i) => i >= 0), deposit: k.deposit },
    gal: { eyebrow: p.gallery.eyebrow, title: p.gallery.title, intro: p.gallery.intro, items: p.gallery.items.map((x: any) => ({ u: img(x.u), c: x.c })).filter((x: any) => x.u) },
    ts: { title: p.reviews.title, items: p.reviews.items.map((x: any) => ({ n: x.n, q: x.q })) },
    faq: { title: p.faq.title, items: p.faq.items.map((x: any) => ({ q: x.q, a: x.a })) },
    ct: { eyebrow: p.contact.eyebrow, title: p.contact.title, intro: p.contact.intro },
    f: { theme: p.features.theme, lang: p.features.lang, wa: p.features.wa, top: p.features.top, fav: p.features.fav, track: p.features.track, news: p.features.news, admin: p.features.admin },
    adm: { h: preview ? hashPass(p.key, 'demo') : (p.owner.adminHash || opts.adminHash || '') }, // the customer's own passcode always wins over a generated one
    ep: ep && /^https:/i.test(ep) ? ep : '',
    // Cloud inbox: only in the finished download (never in editor previews), and only when the server registered this site
    ...(!preview && p.features.cloud && opts.cloudUrl ? { cloud: { u: opts.cloudUrl, id: p.key } } : {}),
  };
}

/* ───────── HTML ───────── */
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
/** JSON that is safe inside <script type="application/json">: can never close the tag or break parsing. */
export const safeJson = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const hexN = (h: string) => parseInt(h.slice(1), 16);
function onColor(h: string) {
  const n = hexN(h); const l = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] > 0.45 ? '#111827' : '#ffffff';
}
export function proVars(p: ProConfig): string {
  const fp = FONT_PAIRS.find((f) => f.id === p.look.fontPair) || FONT_PAIRS[0];
  const [r, rb] = ({ sharp: ['4px', '4px'], soft: ['14px', '12px'], round: ['24px', '999px'] } as Record<string, string[]>)[p.look.radius] || ['14px', '12px'];
  return `:root{--ac:${p.look.accent};--ac2:${p.look.accent2};--on:${onColor(p.look.accent)};--r:${r};--rb:${rb};--hf:${fp.head};--bf:${fp.body}}`;
}

const FRAME_JS = (preview: boolean) => `(function(){var P=function(m){parent.postMessage(m,'*')};${preview ? "var Y=/*Y*/0;if(Y)window.scrollTo(0,Y);var tm;window.addEventListener('scroll',function(){clearTimeout(tm);tm=setTimeout(function(){P({t:'y',y:window.scrollY})},120)},{passive:true});window.addEventListener('message',function(e){var m=e.data||{};if(m.t==='go'&&m.sec){var el=document.getElementById(m.sec);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}});" : ''}
document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';if(h.charAt(0)==='#')return;if(/^(https?:|mailto:|tel:)/i.test(h)){ev.preventDefault();P({t:'ext',u:h})}},true);
window.addEventListener('error',function(e){P({t:'err',m:String(e.message||e),l:e.lineno||0})});P({t:'ready'})})();`;

export function buildPro(cfg: SiteConfig, opts: BuildOptions): BuiltSite {
  const p = cfg.pro as ProConfig;
  const inline = opts.mode !== 'export';
  const code = cfg.code || { css: '', js: '', head: '' };
  const site = proToSite(cfg, opts);
  const data = safeJson(site);
  const b = p.business;
  const fp = FONT_PAIRS.find((f) => f.id === p.look.fontPair) || FONT_PAIRS[0];
  const css = ENGINE_CSS + '\n' + proVars(p);
  const title = p.seo.title || `${b.name}${b.tag ? ' — ' + b.tag : ''}`;
  const desc = p.seo.description || b.tag || b.name;
  const fav = faviconFor(p.seo.favicon || 'shopping-bag');
  const ld = safeJson({ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: b.name, description: desc, ...(b.phone ? { telephone: b.phone } : {}), ...(b.email ? { email: b.email } : {}), ...(b.addr ? { address: b.addr } : {}), ...(b.hours ? { openingHours: b.hours } : {}) });
  const inJs = (x: string) => x.replace(/<\/script/gi, '<\\/script');
  const inCss = (x: string) => x.replace(/<\/style/gi, '<\\/style');
  const wa = String(b.wa || '').replace(/\D/g, '');
  const noscript = `<noscript><div style="font-family:system-ui;max-width:640px;margin:48px auto;padding:0 20px"><h1>${e(b.name)}</h1><p>${e(b.tag)}</p><p>This site needs JavaScript to show its shop. ${b.phone ? `Call <a href="tel:${e(String(b.phone).replace(/[^\d+]/g, ''))}">${e(b.phone)}</a>. ` : ''}${wa ? `<a href="https://wa.me/${wa}">Chat on WhatsApp</a>.` : ''}</p></div></noscript>`;
  const html = `<!doctype html>
<html lang="${e(p.setup.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="${p.look.accent}">
<link rel="icon" href="${fav}">
${fp.google ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fp.google}&display=swap">` : ''}
${inline ? `<style>${inCss(css)}</style>` : '<link rel="stylesheet" href="css/app.css">'}
${code.css ? (inline ? `<style id="custom-css">${inCss(code.css)}</style>` : '<link rel="stylesheet" href="css/custom.css">') : ''}
<script type="application/ld+json">${ld}</script>
${code.head || ''}
</head>
<body>
<div id="app"></div>
${noscript}
<script type="application/json" id="site-data">${data}</script>
${inline ? `<script>${inJs(ENGINE_CORE_JS)}</script>\n<script>${inJs(ENGINE_APP_JS)}</script>\n<script>${FRAME_JS(opts.mode === 'preview')}</script>` : '<script src="js/core.js"></script>\n<script src="js/app.js"></script>'}
${code.js ? (inline ? `<script>${inJs(code.js)}</script>` : '<script src="js/custom.js"></script>') : ''}
</body>
</html>`;
  const files = opts.mode === 'export' ? [
    { name: 'index.html', text: html }, { name: 'css/app.css', text: css }, { name: 'js/core.js', text: ENGINE_CORE_JS }, { name: 'js/app.js', text: ENGINE_APP_JS },
    { name: 'site-data.json', text: JSON.stringify(site, null, 1) },
    ...(code.css ? [{ name: 'css/custom.css', text: code.css }] : []), ...(code.js ? [{ name: 'js/custom.js', text: code.js }] : []),
  ] : undefined;
  return { html, css, js: ENGINE_APP_JS, customCss: code.css, customJs: code.js, files };
}

/* ───────── helpers for the editor / AI ───────── */
export function proSchemaDoc(): string {
  return [
    'PRO SITE GROUPS (use {"op":"setPro","group":"<id>","values":{…}} — lists you give REPLACE the old list):',
    ...PRO_GROUPS.filter((g) => g.id !== 'owner').map((g) => `- ${g.id}: ${g.fields.map(fieldDoc).join(', ')}`),
    'Mode "shop" shows the catalog; "book" shows booking; "quote" shows the quote form; "none" shows neither. Prices are plain numbers (no commas). Products: images is a list of {u}.',
  ].join('\n');
}

export function proWarnings(cfg: SiteConfig): string[] {
  const p = cfg.pro as ProConfig, w: string[] = [], m = p.setup.mode;
  if (!p.business.name.trim() || p.business.name === 'Your Business') w.push('You are still using the placeholder business name.');
  if (!p.business.wa && !p.business.phone) w.push('Add a WhatsApp number or phone — that is how customers reach you and how orders arrive.');
  if (m === 'shop') {
    if (!p.catalog.products.length) w.push('Your shop has no products yet.');
    if (!p.catalog.mtn && !p.catalog.airtel && !p.catalog.bank && !p.catalog.link && !p.catalog.cash) w.push('No payment method is set up, so customers cannot pay.');
    if (p.catalog.products.some((x: any) => !x.price)) w.push('Some products have no price.');
  }
  if (m === 'book' && !p.booking.slots.trim()) w.push('Add time slots so customers can book.');
  if (JSON.stringify(cfg.pro).includes('images.unsplash.com')) w.push('Some pictures are sample photos. Replace them with your own.');
  return w;
}

export function readmePro(cfg: SiteConfig, passcode?: string, cloud = false): string {
  const p = cfg.pro as ProConfig;
  return `${p.business.name} — your website
${'='.repeat(40)}

WHAT'S INSIDE
  index.html       your website (open it in any browser)
  css/app.css      design      ·  js/core.js + js/app.js  the site engine (shop, booking, owner admin)
  site-data.json   your content (products, prices, text) — this is what "Publish" replaces
  assets/          your uploaded pictures

PUTTING IT ONLINE
  Upload ALL files and folders to your web hosting (public_html / www), keeping the structure.
  Free options: Netlify Drop, GitHub Pages, Cloudflare Pages.

YOUR OWNER ADMIN
  Open  yoursite.com/#admin  ${passcode ? `\n  Passcode: ${passcode}   (change it in Admin → Backup & security)` : '\n  Use the passcode you set in the builder.'}
  Manage products, prices, orders, bookings and enquiries from your phone.
${cloud ? `  CLOUD INBOX: every order, booking, enquiry and sign-up is also sent to our servers, so you see them in this admin on
  ANY device (phone, laptop…) — just sign in with your passcode. Two customers can never book the same time slot, and
  customers can track their order from any device. If the internet is down, the site keeps working and sends everything
  as soon as it is back. If you change your passcode in the admin, it is changed in the cloud inbox too.
  Orders still reach you on WhatsApp${p.contact.endpoint ? ' and by email' : ''} as well.` : `  IMPORTANT: orders, bookings and enquiries are saved on the device they were made on and reach you through
  WhatsApp${p.contact.endpoint ? ' and your email link' : ' (add an email link in the builder to also receive them by email)'}.`}
  To show product/price changes to ALL visitors: Admin → Settings → "Publish", then upload the downloaded
  site-data.json to your hosting, replacing the old one.

GOOD TO KNOW
  - Works offline-friendly and on old phones. Google Fonts load from Google unless you chose System fonts.
  - Made with the Template Builder (Site Engine).
`;
}
