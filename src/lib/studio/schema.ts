// src/lib/studio/schema.ts
//
// The Studio builds complete business websites (slideshow, catalogue, cart, bookings or quotes, reviews,
// languages, owner admin). ONE schema describes every setting: it drives the editor form, the server-side
// validator and the defaults. Isomorphic (no Node imports). To add a setting: add a field here and use it in generate.ts.
import type { Field } from '@/lib/builder/schema';
import { coerceObj, clean } from '@/lib/builder/sanitize';
import { FONTS } from './look';
import { PRESETS, DEFAULT_PRESET } from './presets';

const o = (...p: [string, string][]) => p.map(([value, label]) => ({ value, label }));
const T = (key: string, label: string, def = '', x: Partial<Field> = {}): Field => ({ key, label, type: 'text', def, max: 120, ...x });
const TA = (key: string, label: string, def = '', x: Partial<Field> = {}): Field => ({ key, label, type: 'textarea', def, max: 600, ...x });
const IMG = (key: string, label: string, def = '', x: Partial<Field> = {}): Field => ({ key, label, type: 'image', def, ...x });
const SEL = (key: string, label: string, options: Field['options'], def: string, x: Partial<Field> = {}): Field => ({ key, label, type: 'select', options, def, ...x });
const TOG = (key: string, label: string, def = true, x: Partial<Field> = {}): Field => ({ key, label, type: 'toggle', def, ...x });
const COL = (key: string, label: string, def: string): Field => ({ key, label, type: 'color', def });
const LIST = (key: string, label: string, fields: Field[], x: Partial<Field> = {}): Field => ({ key, label, type: 'list', fields, def: [], max: 12, ...x });

export interface StudioGroup { id: string; label: string; icon: string; blurb: string; fields: Field[] }

export const STUDIO_GROUPS: StudioGroup[] = [
  { id: 'brand', label: 'Brand & logo', icon: '🏷️', blurb: 'Name, tagline and logo shown across the site.', fields: [
    T('name', 'Business name', 'Your Business', { max: 60 }),
    T('tag', 'Tagline', '', { max: 120 }),
    T('announce', 'Announcement bar (leave empty to hide)', '', { max: 140 }),
    TA('about', 'About text (shown in the About section and in Google results)', '', { max: 700 }),
    IMG('logoLight', 'Logo', '', { help: 'Square or wide PNG with a transparent background works best.' }),
    IMG('logoDark', 'Logo for dark mode (optional)', '', { help: 'Use a light version of your logo if the normal one disappears on dark backgrounds.' }),
    T('logoSub', 'Small line under the name (optional)', '', { max: 40, help: 'For example: EVENTS · DECOR · LIGHTING' }),
    T('mono', 'Monogram (1–3 letters, shown when there is no logo)', 'B', { max: 3 }),
    SEL('lr', 'Logo corners', o(['0', 'Square'], ['8', 'Soft'], ['12', 'Rounded'], ['16', 'More rounded'], ['20', 'Very rounded']), '12'),
    IMG('favicon', 'Browser tab icon (optional)', ''),
  ] },
  { id: 'contact', label: 'Contact & social', icon: '📞', blurb: 'Where customers reach you. Orders, bookings and enquiries go to WhatsApp.', fields: [
    T('phone', 'Phone', '', { max: 30 }),
    T('wa', 'WhatsApp number (digits only, with country code, e.g. 256700000000)', '', { max: 20 }),
    T('email', 'Email', '', { max: 100 }),
    T('addr', 'Address', '', { max: 160 }),
    T('hours', 'Opening hours', '', { max: 100 }),
    T('ig', 'Instagram handle', '', { max: 40 }), T('fb', 'Facebook page link', '', { max: 160 }),
    T('tt', 'TikTok handle', '', { max: 40 }), T('yt', 'YouTube link', '', { max: 160 }),
    T('thanks', 'Thank-you message after the contact form', 'Thank you! We will reply shortly.', { max: 160 }),
    T('wamsg', 'WhatsApp greeting message', 'Hello, I found you on your website.', { max: 160 }),
  ] },
  { id: 'look', label: 'Look & feel', icon: '🎨', blurb: 'Colours, fonts and style. Every site has a light and a dark mode.', fields: [
    SEL('skin', 'Style', Object.entries({ soft: 'Soft & rounded', bold: 'Bold & sharp', classic: 'Classic & elegant', clean: 'Clean (no extras)' }).map(([value, label]) => ({ value, label })), 'soft'),
    SEL('hf', 'Heading font', FONTS.filter((f) => f.kind === 'heading').map((f) => ({ value: f.id, label: f.label })), 'playfair'),
    SEL('bf', 'Text font', FONTS.filter((f) => f.kind === 'body').map((f) => ({ value: f.id, label: f.label })), 'quicksand'),
    SEL('radius', 'Corner roundness', o(['0', 'Square'], ['2', 'Almost square'], ['6', 'Slight'], ['10', 'Medium'], ['14', 'Rounded'], ['20', 'Very rounded'], ['26', 'Soft pill']), '14'),
    SEL('defTheme', 'Starts in', o(['auto', "Visitor's device setting"], ['light', 'Light mode'], ['dark', 'Dark mode']), 'auto'),
    SEL('fx', 'Hero slideshow effect', o(['fade', 'Fade'], ['zoom', 'Slow zoom'], ['slide', 'Slide']), 'fade'),
    T('slSpeed', 'Seconds per slide', '5.5', { max: 4 }),
    COL('acL', 'Light mode · main colour (buttons, highlights)', '#e0568f'), COL('ac2L', 'Light mode · second colour', '#f7b4d0'),
    COL('bgL', 'Light mode · page background', '#fff7fa'), COL('cardL', 'Light mode · cards', '#ffffff'), COL('txL', 'Light mode · text', '#3a1f2b'),
    COL('acD', 'Dark mode · main colour', '#f06fa3'), COL('ac2D', 'Dark mode · second colour', '#7a2f50'),
    COL('bgD', 'Dark mode · page background', '#170d12'), COL('cardD', 'Dark mode · cards', '#241720'), COL('txD', 'Dark mode · text', '#fbeaf1'),
    TA('customCss', 'Extra CSS (optional, for experts)', '', { max: 4000, help: 'Added at the very end of the stylesheet.' }),
  ] },
  { id: 'content', label: 'Pages & content', icon: '📝', blurb: 'Hero slides, about, services, numbers, reviews and questions.', fields: [
    LIST('slides', 'Hero slides', [IMG('u', 'Picture', ''), T('t', 'Headline', '', { max: 80 }), T('s', 'Sub-headline', '', { max: 160 })], { itemLabel: 'Slide', titleKey: 't', max: 8 }),
    IMG('aboutImg', 'About picture', ''),
    T('svTitle', 'Services section title', 'What we do', { max: 60 }),
    LIST('services', 'Services', [T('t', 'Name', '', { max: 60 }), TA('d', 'Description', '', { max: 240 })], { itemLabel: 'Service', titleKey: 't', max: 12 }),
    LIST('stats', 'Numbers (shown beside About)', [T('v', 'Number (e.g. 500+)', '', { max: 12 }), T('l', 'Label', '', { max: 30 })], { itemLabel: 'Number', titleKey: 'l', max: 3 }),
    LIST('testi', 'Customer reviews', [T('n', 'Name', '', { max: 40 }), TA('q', 'What they said', '', { max: 260 })], { itemLabel: 'Review', titleKey: 'n', max: 9 }),
    LIST('faq', 'Questions & answers', [T('q', 'Question', '', { max: 120 }), TA('a', 'Answer', '', { max: 400 })], { itemLabel: 'Question', titleKey: 'q', max: 20 }),
  ] },
  { id: 'catalog', label: 'Products & gallery', icon: '🛍️', blurb: 'The catalogue customers browse and order from, and your photo gallery.', fields: [
    T('catTitle', 'Catalogue title', 'Our catalogue', { max: 60 }),
    LIST('products', 'Products / packages', [
      T('n', 'Name', '', { max: 80 }), T('c', 'Category (customers filter by this)', '', { max: 30 }),
      T('p', 'Price (UGX, numbers only)', '0', { max: 12 }), T('st', 'In stock (number)', '10', { max: 5 }),
      TA('d', 'Description', '', { max: 500 }), IMG('u', 'Photo', ''),
    ], { itemLabel: 'Product', titleKey: 'n', max: 80 }),
    T('galTitle', 'Gallery title', 'Our work', { max: 60 }),
    LIST('gallery', 'Gallery photos', [IMG('u', 'Photo', ''), T('c', 'Caption', '', { max: 60 }), T('k', 'Category (optional filter)', '', { max: 24 })], { itemLabel: 'Photo', titleKey: 'c', max: 48 }),
  ] },
  { id: 'booking', label: 'Booking or quotes', icon: '📅', blurb: 'Choose how customers take the next step: book a time slot, or request a quote.', fields: [
    SEL('mode', 'The site works as', o(['book', 'Booking site (customers pick a day and time)'], ['quote', 'Quote site (customers send a custom request)']), 'book'),
    T('bookTitle', 'Booking section title', 'Book an appointment', { max: 60 }),
    T('bookText', 'Booking section text', 'Pick a day and time that suits you.', { max: 160 }),
    TA('deposits', 'Booking deposits (one per line: Service name = amount in UGX)', '', { max: 400, help: 'Example: Bridal hair=100000. Leave empty for no deposits.' }),
    T('slots', 'Time slots (comma separated)', '09:00,11:00,14:00,16:00', { max: 120 }),
    T('closed', 'Closed weekdays (0=Sun … 6=Sat, comma separated)', '0', { max: 20 }),
  ] },
  { id: 'shop', label: 'Payments & promos', icon: '💳', blurb: 'What customers see at checkout. Orders are confirmed by you, on WhatsApp.', fields: [
    T('mtn', 'MTN MoMo number', '', { max: 30 }), T('mtnn', 'MTN registered name', '', { max: 60 }),
    T('airtel', 'Airtel Money number', '', { max: 30 }), T('airteln', 'Airtel registered name', '', { max: 60 }),
    T('bank', 'Bank details', '', { max: 160 }),
    T('fee', 'Delivery fee (UGX)', '0', { max: 8 }),
    T('paylink', 'Online payment link (optional)', '', { max: 200 }),
    TA('promos', 'Promo codes (one per line, e.g. WELCOME10=10% or SAVE5000=5000)', '', { max: 400 }),
  ] },
  { id: 'features', label: 'Features on / off', icon: '🧩', blurb: 'Switch parts of the site on or off.', fields: [
    TOG('fShop', 'Shopping cart and ordering'), TOG('fWa', 'Floating WhatsApp button'), TOG('fRev', 'Customer reviews on products'),
    TOG('fFav', 'Favourites (hearts)'), TOG('fLang', 'Language switch (English, Swahili, Luganda)'), TOG('fNews', 'Newsletter sign-up'),
    TOG('fTop', 'Back-to-top button'), TOG('fTrack', 'Order tracking'),
  ] },
  { id: 'advanced', label: 'Advanced', icon: '⚙️', blurb: 'Search title, owner admin passcode, cloud sync, translations.', fields: [
    T('title', 'Browser tab title (empty = business name)', '', { max: 90 }),
    T('pass', 'Owner admin passcode (at least 8 characters)', '', { max: 40, help: 'Used to open the site\'s own admin page (add #admin to the address). The website only contains a scrambled (hashed) copy, never the passcode itself. Longer is safer.' }),
    T('dburl', 'Cloud database URL (optional, Firebase Realtime Database)', '', { max: 200, help: 'Without this, orders, bookings and visit counts are stored only in the browser of the person who made them. Add your own Firebase URL to collect them in one place.' }),
    TOG('refresh', 'Show new content to returning visitors when I republish', true),
    TOG('demoAdmin', 'Let visitors try the admin panel on the live demo (passcode demo1234, runs only in their own browser)', false),
    LIST('tr', 'Translations for your own text (Swahili / Luganda)', [T('k', 'English text exactly as it appears', '', { max: 200 }), T('sw', 'Swahili', '', { max: 200 }), T('lg', 'Luganda', '', { max: 200 })], { itemLabel: 'Translation', titleKey: 'k', max: 120 }),
  ] },
];

export const ALL_FIELDS: Field[] = STUDIO_GROUPS.flatMap((g) => g.fields);
export const STUDIO_KEYS = new Set(ALL_FIELDS.map((f) => f.key));

export type StudioData = Record<string, any>;

export const presetData = (id: string = DEFAULT_PRESET): StudioData => JSON.parse(JSON.stringify((PRESETS[id] ?? PRESETS[DEFAULT_PRESET]).data));

/** Rebuilds the settings strictly from the schema: unknown keys dropped, URLs/colours/enums checked, lengths bounded. */
export function sanitizeStudio(input: unknown, ctx: { assetIds?: Set<string> } = {}): StudioData {
  if (JSON.stringify(input ?? {}).length > 600_000) throw new Error('This site is too large.');
  const src = input && typeof input === 'object' ? (input as Record<string, any>) : {};
  const d = coerceObj(ALL_FIELDS, src, ctx);
  // numbers kept as plain digit strings (the generator turns them into numbers)
  const num = (v: unknown, max: number) => {
    const t = String(v ?? '').replace(/[,\s]/g, '');
    let n = Number(t);
    if (!Number.isFinite(n)) n = Number((t.match(/\d+(?:\.\d+)?/) || ['0'])[0]); // "UGX5000" -> 5000
    return String(Math.max(0, Math.min(max, Math.round(n))));
  };
  d.products = (d.products as any[]).map((p) => ({ ...p, p: num(p.p, 999_999_999), st: num(p.st, 99_999) }));
  d.fee = num(d.fee, 9_999_999);
  d.slSpeed = String(Math.max(2, Math.min(20, Number(d.slSpeed) || 5.5)));
  d.slots = clean(d.slots, 120).split(',').map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s)).join(',') || '09:00,11:00,14:00,16:00';
  d.closed = clean(d.closed, 20).split(',').map((s) => s.trim()).filter((s) => /^[0-6]$/.test(s)).join(',');
  d.wa = String(d.wa).replace(/\D/g, '').slice(0, 15);
  // contact details become links on the generated site, so each must be the right *kind* of value
  const https = (v: unknown, hostRe?: RegExp) => { const u = String(v ?? '').trim(); return /^https:\/\/[^\s"'<>\\]{3,190}$/i.test(u) && (!hostRe || hostRe.test(new URL(u).hostname)) ? u : ''; };
  const handle = (v: unknown) => { const t = String(v ?? '').trim(); return (t.startsWith('@') ? '@' : '') + t.replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30); };
  d.fb = https(d.fb); d.yt = https(d.yt); d.paylink = https(d.paylink);
  d.dburl = https(d.dburl, /(^|\.)(firebaseio\.com|firebasedatabase\.app)$/i).replace(/\/+$/, '');
  d.ig = handle(d.ig); d.tt = handle(d.tt);
  d.phone = String(d.phone).replace(/[^\d+()\-\s]/g, '').slice(0, 24);
  d.mtn = String(d.mtn).replace(/[^\d+()\-\s]/g, '').slice(0, 24); d.airtel = String(d.airtel).replace(/[^\d+()\-\s]/g, '').slice(0, 24);
  d.email = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(String(d.email)) ? String(d.email).slice(0, 100) : '';
  d.pass = String(d.pass).replace(/[\u0000-\u001f]/g, '');
  d.key = String(src.key || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
  d.customCss = String(d.customCss).replace(/<\/?(style|script)/gi, '').replace(/<!--/g, '');
  d.mono = String(d.mono).replace(/[<>"'&]/g, '');
  return d;
}

/** Everything that appears on the visible site (used to decide when returning visitors should see an update). */
export const contentOf = (d: StudioData) => { const { pass, dburl, demoAdmin, refresh, ...rest } = d; void pass; void dburl; void demoAdmin; void refresh; return rest; };
