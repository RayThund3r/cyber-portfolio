// src/lib/builder/schema.ts
//
// ONE schema drives three things: the no-code editor UI, the server-side validator, and defaults.
// Isomorphic (no Node imports). To add a section type or field, edit only this file + its generator in generate.ts.

export type FieldType = 'text' | 'textarea' | 'code' | 'image' | 'select' | 'toggle' | 'emoji' | 'url' | 'color' | 'list' | 'number' | 'passcode';
export interface Field {
  key: string; label: string; type: FieldType;
  options?: { value: string; label: string }[];
  fields?: Field[];          // list item fields
  max?: number;              // list max items / text max length
  help?: string; placeholder?: string; def?: any;
  group?: 'content' | 'style';
  min?: number;              // number fields (max = numeric maximum)
  itemLabel?: string;        // list: name of one item ("Service")
  titleKey?: string;         // list: which item field names the row
}

export type SectionType =
  | 'navbar' | 'hero' | 'about' | 'features' | 'stats' | 'gallery' | 'testimonials'
  | 'pricing' | 'team' | 'faq' | 'cta' | 'text' | 'html' | 'contact' | 'footer';

export interface SectionInstance { id: string; type: SectionType; visible: boolean; data: Record<string, any> }
export interface SiteConfig {
  v: 1;
  meta: { title: string; description: string; lang: string; favicon: string };
  brand: { name: string; logo: string };
  theme: {
    mode: 'light' | 'dark'; primary: string; secondary: string; bg: string; alt: string; text: string;
    fontPair: string; radius: string; btnStyle: string; animations: boolean; smooth: boolean;
  };
  sections: SectionInstance[];
  /** Optional hand-written code for people who want extra customization (runs only inside their own site). */
  code: { css: string; js: string; head: string };
  /** 'pro' = self-sufficient app site (shop / booking / quotes + owner admin) powered by the Site Engine. Omitted = classic section site. */
  kind?: 'classic' | 'pro';
  pro?: ProConfig;
}

/** Pro site settings: `key` salts the owner passcode; every other key is a group from PRO_GROUPS (see pro.ts). */
export interface ProConfig { key: string; [group: string]: any }

/* ───────── field helpers ───────── */
export const o = (...p: [string, string][]) => p.map(([value, label]) => ({ value, label }));
export const T = (key: string, label: string, def = '', x: Partial<Field> = {}): Field => ({ key, label, type: 'text', def, ...x });
export const TA = (key: string, label: string, def = '', x: Partial<Field> = {}): Field => ({ key, label, type: 'textarea', def, ...x });
export const CODE = (key: string, label: string, def = '', x: Partial<Field> = {}): Field => ({ key, label, type: 'code', def, ...x });
export const IMG = (key: string, label: string, def = '', x: Partial<Field> = {}): Field => ({ key, label, type: 'image', def, ...x });
export const URLF = (key: string, label: string, def = '', x: Partial<Field> = {}): Field => ({ key, label, type: 'url', def, ...x });
export const EMO = (key: string, label: string, def = '⭐'): Field => ({ key, label, type: 'emoji', def });
export const SEL = (key: string, label: string, options: Field['options'], def: string, x: Partial<Field> = {}): Field => ({ key, label, type: 'select', options, def, ...x });
export const TOG = (key: string, label: string, def = true, x: Partial<Field> = {}): Field => ({ key, label, type: 'toggle', def, ...x });
export const COL = (key: string, label: string, def: string): Field => ({ key, label, type: 'color', def });
export const NUM = (key: string, label: string, def = 0, x: Partial<Field> = {}): Field => ({ key, label, type: 'number', def, min: 0, max: 100000000, ...x });
export const PASS = (key: string, label: string, x: Partial<Field> = {}): Field => ({ key, label, type: 'passcode', def: '', ...x });
export const LIST = (key: string, label: string, fields: Field[], def: any[], x: Partial<Field> = {}): Field => ({ key, label, type: 'list', fields, def, max: 12, ...x });

const STYLE: Field[] = [
  SEL('bg', 'Background', o(['default', 'Normal'], ['alt', 'Soft tint'], ['primary', 'Brand colour'], ['dark', 'Dark']), 'default', { group: 'style' }),
  SEL('space', 'Spacing', o(['compact', 'Compact'], ['normal', 'Normal'], ['spacious', 'Spacious']), 'normal', { group: 'style' }),
  T('navLabel', 'Menu label (leave empty to hide from menu)', '', { group: 'style', max: 24 }),
];

export interface SectionDef { type: SectionType; label: string; icon: string; fixed?: 'top' | 'bottom'; fields: Field[] }

export const SECTION_DEFS: Record<SectionType, SectionDef> = {
  navbar: { type: 'navbar', label: 'Top menu', icon: '🧭', fixed: 'top', fields: [
    TOG('sticky', 'Keep menu visible when scrolling', true),
    SEL('style', 'Menu style', o(['solid', 'Solid'], ['transparent', 'Transparent until scrolled']), 'solid'),
    T('ctaText', 'Menu button text (empty = no button)', 'Get in touch', { max: 24 }),
    URLF('ctaUrl', 'Menu button link', '#'),
  ] },
  hero: { type: 'hero', label: 'Hero / banner', icon: '🚀', fields: [
    SEL('variant', 'Layout', o(['centered', 'Centered text'], ['split', 'Text + image'], ['image', 'Full background image']), 'split'),
    T('eyebrow', 'Small label above title', 'Welcome', { max: 40 }),
    T('title', 'Headline', 'We build things people love', { max: 120 }),
    TA('subtitle', 'Sub-headline', 'A short sentence that explains what you do and who it is for.', { max: 400 }),
    T('primaryText', 'Main button text', 'Get started', { max: 24 }),
    URLF('primaryUrl', 'Main button link', '#'),
    T('secondaryText', 'Second button text (optional)', 'Learn more', { max: 24 }),
    URLF('secondaryUrl', 'Second button link', '#'),
    IMG('image', 'Image', 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1400&auto=format&fit=crop'),
    SEL('overlay', 'Image darkness (background layout)', o(['light', 'Light'], ['medium', 'Medium'], ['dark', 'Dark']), 'medium'),
    ...STYLE,
  ] },
  about: { type: 'about', label: 'About / story', icon: '📖', fields: [
    T('title', 'Title', 'About us', { max: 100 }),
    TA('text', 'Text', 'Tell your story here. Who are you, what do you stand for, and why should people trust you?\n\nUse a blank line to start a new paragraph.', { max: 2500 }),
    IMG('image', 'Image', 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop'),
    SEL('imageSide', 'Image position', o(['right', 'Right'], ['left', 'Left']), 'right'),
    LIST('bullets', 'Highlights (short ticks)', [T('text', 'Text', '', { max: 100 })], [{ text: 'Friendly, reliable service' }, { text: 'Fair and clear pricing' }], { itemLabel: 'Highlight', titleKey: 'text', max: 8 }),
    ...STYLE,
  ] },
  features: { type: 'features', label: 'Services / features', icon: '✨', fields: [
    T('title', 'Title', 'What we offer', { max: 100 }),
    TA('subtitle', 'Intro (optional)', 'A quick look at how we can help you.', { max: 300 }),
    SEL('columns', 'Cards per row', o(['2', '2'], ['3', '3'], ['4', '4']), '3'),
    LIST('items', 'Cards', [EMO('icon', 'Icon', '⭐'), T('title', 'Title', 'Service name', { max: 60 }), TA('text', 'Description', 'Describe this service in a sentence or two.', { max: 300 })],
      [{ icon: '🚀', title: 'Fast delivery', text: 'We get things done quickly without cutting corners.' }, { icon: '💡', title: 'Smart ideas', text: 'Fresh thinking tailored to your needs.' }, { icon: '🤝', title: 'Friendly support', text: 'Real people ready to help whenever you need us.' }],
      { itemLabel: 'Card', titleKey: 'title', max: 12 }),
    ...STYLE,
  ] },
  stats: { type: 'stats', label: 'Numbers / stats', icon: '📊', fields: [
    LIST('items', 'Numbers', [T('value', 'Number', '100', { max: 10 }), T('suffix', 'After the number (e.g. + or %)', '+', { max: 4 }), T('label', 'Label', 'Happy clients', { max: 40 })],
      [{ value: '120', suffix: '+', label: 'Happy clients' }, { value: '8', suffix: '', label: 'Years of experience' }, { value: '300', suffix: '+', label: 'Projects done' }, { value: '24', suffix: '/7', label: 'Support' }],
      { itemLabel: 'Number', titleKey: 'label', max: 6 }),
    ...STYLE,
  ] },
  gallery: { type: 'gallery', label: 'Photo gallery', icon: '🖼️', fields: [
    T('title', 'Title', 'Our work', { max: 100 }),
    TA('subtitle', 'Intro (optional)', '', { max: 300 }),
    SEL('columns', 'Photos per row', o(['2', '2'], ['3', '3'], ['4', '4']), '3'),
    LIST('images', 'Photos', [IMG('image', 'Photo', ''), T('caption', 'Caption (optional)', '', { max: 80 })],
      [
        { image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=900&auto=format&fit=crop', caption: '' },
        { image: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=900&auto=format&fit=crop', caption: '' },
        { image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=900&auto=format&fit=crop', caption: '' },
      ], { itemLabel: 'Photo', titleKey: 'caption', max: 24 }),
    ...STYLE,
  ] },
  testimonials: { type: 'testimonials', label: 'Testimonials', icon: '💬', fields: [
    T('title', 'Title', 'What customers say', { max: 100 }),
    SEL('variant', 'Layout', o(['cards', 'Cards'], ['carousel', 'Sliding carousel']), 'cards'),
    LIST('items', 'Testimonials', [TA('quote', 'Quote', 'Wonderful service — highly recommended!', { max: 400 }), T('name', 'Name', 'Customer name', { max: 60 }), T('role', 'Role / place', 'Kampala', { max: 60 }), IMG('avatar', 'Photo (optional)', '')],
      [{ quote: 'Wonderful service — they understood exactly what we needed.', name: 'Happy Customer', role: 'Kampala', avatar: '' }, { quote: 'Fast, friendly and fairly priced. Will use again.', name: 'Another Customer', role: 'Entebbe', avatar: '' }],
      { itemLabel: 'Testimonial', titleKey: 'name', max: 10 }),
    ...STYLE,
  ] },
  pricing: { type: 'pricing', label: 'Pricing plans', icon: '💰', fields: [
    T('title', 'Title', 'Simple pricing', { max: 100 }),
    TA('subtitle', 'Intro (optional)', 'Pick the option that fits you.', { max: 300 }),
    LIST('plans', 'Plans', [T('name', 'Plan name', 'Basic', { max: 40 }), T('price', 'Price', 'UGX 50,000', { max: 30 }), T('period', 'Per (e.g. month)', '/ month', { max: 20 }), TA('features', 'Features (one per line)', 'Feature one\nFeature two', { max: 600 }), T('buttonText', 'Button text', 'Choose', { max: 24 }), URLF('buttonUrl', 'Button link', '#'), TOG('highlight', 'Highlight as best value', false)],
      [{ name: 'Basic', price: 'UGX 50,000', period: '/ month', features: 'Feature one\nFeature two\nFeature three', buttonText: 'Choose', buttonUrl: '#', highlight: false },
       { name: 'Standard', price: 'UGX 120,000', period: '/ month', features: 'Everything in Basic\nExtra feature\nPriority support', buttonText: 'Choose', buttonUrl: '#', highlight: true },
       { name: 'Premium', price: 'UGX 250,000', period: '/ month', features: 'Everything in Standard\nPremium feature\nDedicated help', buttonText: 'Choose', buttonUrl: '#', highlight: false }],
      { itemLabel: 'Plan', titleKey: 'name', max: 4 }),
    ...STYLE,
  ] },
  team: { type: 'team', label: 'Team', icon: '👥', fields: [
    T('title', 'Title', 'Meet the team', { max: 100 }),
    TA('subtitle', 'Intro (optional)', '', { max: 300 }),
    LIST('members', 'People', [T('name', 'Name', 'Full name', { max: 60 }), T('role', 'Role', 'Position', { max: 60 }), IMG('photo', 'Photo', '')],
      [{ name: 'Team Member', role: 'Founder', photo: '' }, { name: 'Team Member', role: 'Manager', photo: '' }, { name: 'Team Member', role: 'Designer', photo: '' }],
      { itemLabel: 'Person', titleKey: 'name', max: 12 }),
    ...STYLE,
  ] },
  faq: { type: 'faq', label: 'FAQ', icon: '❓', fields: [
    T('title', 'Title', 'Frequently asked questions', { max: 100 }),
    LIST('items', 'Questions', [T('q', 'Question', 'How does it work?', { max: 150 }), TA('a', 'Answer', 'Explain it clearly here.', { max: 800 })],
      [{ q: 'How does it work?', a: 'Contact us, tell us what you need, and we take it from there.' }, { q: 'How long does it take?', a: 'It depends on the job — we always give you a clear estimate first.' }, { q: 'How can I pay?', a: 'We accept mobile money and cash.' }],
      { itemLabel: 'Question', titleKey: 'q', max: 15 }),
    ...STYLE,
  ] },
  cta: { type: 'cta', label: 'Call-to-action banner', icon: '📣', fields: [
    T('title', 'Title', 'Ready to get started?', { max: 100 }),
    TA('text', 'Text', 'Tell us what you need and we will get back to you quickly.', { max: 300 }),
    T('buttonText', 'Button text', 'Contact us', { max: 24 }),
    URLF('buttonUrl', 'Button link', '#'),
    ...STYLE.map((f) => (f.key === 'bg' ? { ...f, def: 'primary' } : f)),
  ] },
  text: { type: 'text', label: 'Free text block', icon: '📝', fields: [
    T('title', 'Title', 'A section about anything', { max: 100 }),
    TA('body', 'Text', 'Write anything here. Use a blank line to start a new paragraph.', { max: 4000 }),
    SEL('align', 'Alignment', o(['left', 'Left'], ['center', 'Centered']), 'left'),
    ...STYLE,
  ] },
  html: { type: 'html', label: 'Custom HTML block', icon: '🧩', fields: [
    CODE('html', 'HTML (Bootstrap 5 classes work here)', '<div class="container text-center">\n  <h2>My custom block</h2>\n  <p>Edit this HTML — anything you write appears on the page.</p>\n</div>', { max: 20000, help: 'For people who know a little HTML. Everything else on the page can be edited without code.' }),
    ...STYLE,
  ] },
  contact: { type: 'contact', label: 'Contact', icon: '📞', fields: [
    T('title', 'Title', 'Get in touch', { max: 100 }),
    TA('subtitle', 'Intro', 'Send us a message and we will reply as soon as we can.', { max: 300 }),
    T('email', 'Email', '', { max: 100, placeholder: 'hello@yourbusiness.com' }),
    T('phone', 'Phone', '', { max: 30, placeholder: '+256 700 000000' }),
    T('whatsapp', 'WhatsApp number (digits, with country code)', '', { max: 20, placeholder: '256700000000' }),
    T('address', 'Address', '', { max: 160 }),
    URLF('mapUrl', 'Google/OpenStreetMap "embed" link (optional)', '', { help: 'In Google Maps: Share → Embed a map → copy the link inside src="…"' }),
    TOG('formEnabled', 'Show contact form', true),
    URLF('formAction', 'Form service link (optional)', '', { help: 'Paste a Formspree / Getform link to receive messages by email. Leave empty to open the visitor\'s email app instead.' }),
    T('submitText', 'Send button text', 'Send message', { max: 24 }),
    ...STYLE,
  ] },
  footer: { type: 'footer', label: 'Footer', icon: '🔻', fixed: 'bottom', fields: [
    TA('about', 'Short description', 'A short line about your business.', { max: 300 }),
    LIST('links', 'Footer links', [T('label', 'Label', 'Link', { max: 30 }), URLF('url', 'Link', '#')], [{ label: 'Home', url: '#' }], { itemLabel: 'Link', titleKey: 'label', max: 8 }),
    URLF('facebook', 'Facebook link', ''), URLF('instagram', 'Instagram link', ''), URLF('x', 'X (Twitter) link', ''),
    URLF('youtube', 'YouTube link', ''), URLF('tiktok', 'TikTok link', ''), URLF('linkedin', 'LinkedIn link', ''),
    T('copyright', 'Copyright line', '© 2026 Your Business. All rights reserved.', { max: 120 }),
    SEL('bg', 'Background', o(['dark', 'Dark'], ['default', 'Normal'], ['alt', 'Soft tint'], ['primary', 'Brand colour']), 'dark', { group: 'style' }),
  ] },
};

export const SECTION_ORDER: SectionType[] = ['hero', 'about', 'features', 'stats', 'gallery', 'testimonials', 'pricing', 'team', 'faq', 'cta', 'text', 'contact', 'html'];

export const CODE_FIELDS: Field[] = [
  CODE('css', 'Custom CSS', '', { max: 60000 }),
  CODE('js', 'Custom JavaScript', '', { max: 60000 }),
  CODE('head', 'Extra <head> HTML (analytics, fonts, meta tags…)', '', { max: 10000 }),
];

/** Showcase categories. Template.category holds one of these ids. */
export const CATEGORIES = [
  { id: 'shop', label: 'Online Shops', icon: '🛍️' },
  { id: 'booking', label: 'Bookings & Quotes', icon: '📅' },
  { id: 'business', label: 'Business & Corporate', icon: '💼' },
  { id: 'portfolio', label: 'Portfolio & Creative', icon: '🎨' },
  { id: 'food', label: 'Food & Hospitality', icon: '🍽️' },
  { id: 'beauty', label: 'Health & Beauty', icon: '💆' },
  { id: 'startup', label: 'Startup & Apps', icon: '🚀' },
  { id: 'events', label: 'Events & Education', icon: '🎉' },
  { id: 'realestate', label: 'Real Estate', icon: '🏠' },
  { id: 'blank', label: 'Blank & Starter', icon: '⬜' },
] as const;
export const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

/* ───────── site-level fields ───────── */
export const FONT_PAIRS = [
  { id: 'modern', label: 'Modern — Poppins + Inter', head: "'Poppins', sans-serif", body: "'Inter', sans-serif", google: 'family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600' },
  { id: 'elegant', label: 'Elegant — Playfair + Lato', head: "'Playfair Display', serif", body: "'Lato', sans-serif", google: 'family=Playfair+Display:wght@500;700&family=Lato:wght@400;700' },
  { id: 'tech', label: 'Tech — Space Grotesk + Inter', head: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", google: 'family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600' },
  { id: 'friendly', label: 'Friendly — Nunito', head: "'Nunito', sans-serif", body: "'Nunito', sans-serif", google: 'family=Nunito:wght@400;600;800' },
  { id: 'bold', label: 'Bold — Montserrat + Open Sans', head: "'Montserrat', sans-serif", body: "'Open Sans', sans-serif", google: 'family=Montserrat:wght@600;800&family=Open+Sans:wght@400;600' },
  { id: 'classic', label: 'Classic — Merriweather + Source Sans', head: "'Merriweather', serif", body: "'Source Sans 3', sans-serif", google: 'family=Merriweather:wght@400;700&family=Source+Sans+3:wght@400;600' },
  { id: 'system', label: 'System fonts (fastest, no downloads)', head: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', google: '' },
];

export const PALETTES = [
  { id: 'ocean', label: 'Ocean', mode: 'light', primary: '#2563eb', secondary: '#0ea5e9', bg: '#ffffff', alt: '#f1f5f9', text: '#0f172a' },
  { id: 'sunset', label: 'Sunset', mode: 'light', primary: '#f97316', secondary: '#ef4444', bg: '#fffaf5', alt: '#fff1e6', text: '#1f2937' },
  { id: 'forest', label: 'Forest', mode: 'light', primary: '#16a34a', secondary: '#065f46', bg: '#ffffff', alt: '#f0fdf4', text: '#0f172a' },
  { id: 'royal', label: 'Royal', mode: 'light', primary: '#7c3aed', secondary: '#ec4899', bg: '#ffffff', alt: '#f5f3ff', text: '#1e1b4b' },
  { id: 'coffee', label: 'Coffee', mode: 'light', primary: '#92400e', secondary: '#b45309', bg: '#fffbeb', alt: '#fef3c7', text: '#292524' },
  { id: 'mono', label: 'Mono', mode: 'light', primary: '#111827', secondary: '#6b7280', bg: '#ffffff', alt: '#f3f4f6', text: '#111827' },
  { id: 'midnight', label: 'Midnight', mode: 'dark', primary: '#22d3ee', secondary: '#818cf8', bg: '#0b0f19', alt: '#111827', text: '#e5e7eb' },
  { id: 'neon', label: 'Neon', mode: 'dark', primary: '#a3e635', secondary: '#22d3ee', bg: '#09090b', alt: '#18181b', text: '#f4f4f5' },
] as const;

export const SITE_FIELDS: { title: string; key: 'meta' | 'brand' | 'theme'; fields: Field[] }[] = [
  { title: 'Website identity', key: 'brand', fields: [
    T('name', 'Business / site name', 'Your Business', { max: 40 }),
    IMG('logo', 'Logo (optional — replaces the name in the menu)', ''),
  ] },
  { title: 'Look & feel', key: 'theme', fields: [
    SEL('mode', 'Light or dark', o(['light', 'Light'], ['dark', 'Dark']), 'light'),
    COL('primary', 'Main brand colour', '#2563eb'), COL('secondary', 'Accent colour', '#0ea5e9'),
    COL('bg', 'Page background', '#ffffff'), COL('alt', 'Soft tint background', '#f1f5f9'), COL('text', 'Text colour', '#0f172a'),
    SEL('fontPair', 'Fonts', FONT_PAIRS.map((f) => ({ value: f.id, label: f.label })), 'modern'),
    SEL('radius', 'Corners', o(['none', 'Square'], ['sm', 'Slightly rounded'], ['md', 'Rounded'], ['lg', 'Very rounded'], ['pill', 'Pill buttons']), 'md'),
    SEL('btnStyle', 'Buttons', o(['solid', 'Solid'], ['outline', 'Outlined']), 'solid'),
    TOG('animations', 'Fade-in animations when scrolling', true),
    TOG('smooth', 'Smooth scrolling to sections', true),
  ] },
  { title: 'Search engines & browser tab', key: 'meta', fields: [
    T('title', 'Page title (shown in browser tab & Google)', 'Your Business — what you do', { max: 70 }),
    TA('description', 'Short description for Google', 'One or two sentences about your business.', { max: 160 }),
    EMO('favicon', 'Browser tab icon', '🚀'),
    SEL('lang', 'Language', o(['en', 'English'], ['sw', 'Kiswahili'], ['fr', 'French'], ['ar', 'Arabic'], ['pt', 'Portuguese']), 'en'),
  ] },
];

/* ───────── defaults ───────── */
export function defaultsFor(fields: Field[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) out[f.key] = f.type === 'list' ? JSON.parse(JSON.stringify(f.def ?? [])) : f.def ?? (f.type === 'toggle' ? false : '');
  return out;
}

const rid = () => Math.random().toString(36).slice(2, 8);
export function newSection(type: SectionType, overrides: Record<string, any> = {}): SectionInstance {
  const data = { ...defaultsFor(SECTION_DEFS[type].fields), ...overrides };
  return { id: type.slice(0, 3) + rid(), type, visible: true, data };
}

export function defaultConfig(): SiteConfig {
  const theme = defaultsFor(SITE_FIELDS[1].fields) as SiteConfig['theme'];
  return {
    v: 1,
    meta: defaultsFor(SITE_FIELDS[2].fields) as SiteConfig['meta'],
    brand: defaultsFor(SITE_FIELDS[0].fields) as SiteConfig['brand'],
    theme,
    sections: [newSection('navbar'), newSection('hero', { navLabel: 'Home' }), newSection('about', { navLabel: 'About' }), newSection('features', { navLabel: 'Services' }), newSection('contact', { navLabel: 'Contact' }), newSection('footer')],
    code: { css: '', js: '', head: '' },
  };
}

/** Friendly pre-purchase checks (non-blocking). */
export function classicWarnings(cfg: SiteConfig): string[] {
  const w: string[] = [];
  if (!cfg.brand.name.trim() || cfg.brand.name === 'Your Business') w.push('You are still using the placeholder business name.');
  const contact = cfg.sections.find((s) => s.type === 'contact' && s.visible);
  if (contact && !contact.data.email && !contact.data.phone && !contact.data.whatsapp && !contact.data.formAction) w.push('Your contact section has no email, phone, WhatsApp or form service, so visitors cannot reach you.');
  if (JSON.stringify(cfg.sections).includes('images.unsplash.com')) w.push('Some images are sample photos. Replace them with your own pictures if you want them to be yours.');
  if (JSON.stringify(cfg.sections).match(/Lorem|Full name|Team Member|Customer name/)) w.push('Some sample placeholder text (like “Team Member”) is still there.');
  return w;
}

/** Compact description of a field (used in AI prompts). */
export function fieldDoc(f: Field): string {
  if (f.type === 'select') return `${f.key}(${f.options!.map((o) => o.value).join('|')})`;
  if (f.type === 'list') return `${f.key}[{${f.fields!.map(fieldDoc).join(', ')}}]`;
  return `${f.key}(${f.type}${f.type === 'text' || f.type === 'textarea' ? (f.max ? `≤${f.max}` : '') : f.type === 'number' ? `${f.min ?? 0}..${f.max}` : ''})`;
}
