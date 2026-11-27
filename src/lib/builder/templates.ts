// src/lib/builder/templates.ts — built-in starter templates (owner can edit / re-price them in /admin).
//
// Prices are a USD *market reference*: comparable premium HTML/Bootstrap templates on the big marketplaces
// typically sell for roughly US$15–60 each. They are converted to UGX at the live exchange rate (see pricing.ts).
// The owner can override any template with a fixed UGX price, set it free (0), or hide it.
import { defaultConfig, newSection, PALETTES, type SiteConfig } from './schema';
import { defaultPro } from './pro';

export interface TemplateDef {
  id: string; name: string; description: string;
  /** one of CATEGORIES[].id */
  category: string;
  /** market-reference price in US dollars (null = not set) */
  priceUSD: number | null;
  /** fixed UGX override. null = use priceUSD at the live rate; 0 = free */
  priceUGX: number | null;
  enabled: boolean;
  /** shown as a badge in the showcase */
  tag?: string;
  config: SiteConfig;
}

const U = (id: string, w = 1400) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;
type PaletteId = (typeof PALETTES)[number]['id'];

function base(palette: PaletteId, font: string, brand: string, title: string, desc: string, favicon: string, radius = 'md'): SiteConfig {
  const c = defaultConfig();
  const p = PALETTES.find((x) => x.id === palette)!;
  c.theme = { ...c.theme, mode: p.mode, primary: p.primary, secondary: p.secondary, bg: p.bg, alt: p.alt, text: p.text, fontPair: font, radius };
  c.brand.name = brand;
  c.meta = { ...c.meta, title, description: desc, favicon };
  return c;
}
const body = (c: SiteConfig, mid: ReturnType<typeof newSection>[], footer: Record<string, any> = {}): SiteConfig => {
  const nav = c.sections[0], foot = { ...c.sections[c.sections.length - 1] };
  foot.data = { ...foot.data, ...footer, about: footer.about ?? foot.data.about, copyright: `© 2026 ${c.brand.name}. All rights reserved.` };
  return { ...c, sections: [nav, ...mid, foot] };
};
const img = (items: [string, string?][], w = 900) => items.map(([id, caption]) => ({ image: U(id, w), caption: caption || '' }));
const cards = (rows: [string, string, string][]) => rows.map(([icon, title, text]) => ({ icon, title, text }));

function business(): SiteConfig {
  const c = base('ocean', 'modern', 'Acme Solutions', 'Acme Solutions — reliable services for growing businesses', 'We help businesses grow with dependable, friendly and affordable services.', 'briefcase');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', title: 'Grow your business with a partner you can trust', subtitle: 'Practical services, clear pricing and friendly people — everything you need in one place.', image: U('photo-1497366216548-37526070297c') }),
    newSection('features', { navLabel: 'Services', title: 'Our services', bg: 'alt' }),
    newSection('about', { navLabel: 'About', title: 'Who we are', image: U('photo-1522071820081-009f0129c71c', 1200) }),
    newSection('stats', { bg: 'primary' }), newSection('testimonials', { navLabel: 'Reviews' }),
    newSection('pricing', { navLabel: 'Pricing', bg: 'alt' }), newSection('faq', { navLabel: 'FAQ' }),
    newSection('cta', { bg: 'primary' }), newSection('contact', { navLabel: 'Contact', bg: 'alt' }),
  ]);
}
function consulting(): SiteConfig {
  const c = base('mono', 'classic', 'Northwind Consulting', 'Northwind Consulting — strategy that delivers', 'Independent advisors helping organisations plan, grow and perform.', 'trending-up', 'sm');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'Strategy · Finance · Operations', title: 'Clear advice. Measurable results.', subtitle: 'We work alongside your team to turn plans into performance.', primaryText: 'Book a consultation', secondaryText: 'Our approach', image: U('photo-1460925895917-afdab827c52f'), overlay: 'dark' }),
    newSection('features', { navLabel: 'Expertise', title: 'Where we help', columns: '3', items: cards([['bar-chart', 'Business strategy', 'Market entry, growth plans and competitive positioning.'], ['dollar', 'Financial planning', 'Budgets, forecasts and funding readiness.'], ['settings', 'Operations', 'Streamlined processes and cost control.']]) }),
    newSection('stats', { bg: 'alt' }), newSection('team', { navLabel: 'Team', title: 'Your advisors' }),
    newSection('testimonials', { variant: 'carousel', bg: 'alt', navLabel: 'Clients' }), newSection('faq', { navLabel: 'FAQ' }),
    newSection('cta', { bg: 'dark', title: 'Let\'s talk about your goals' }), newSection('contact', { navLabel: 'Contact' }),
  ]);
}
function portfolio(): SiteConfig {
  const c = base('royal', 'elegant', 'Jane Doe', 'Jane Doe — Designer & Creative', 'Portfolio of a creative professional: branding, web and visual design.', 'palette', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'centered', eyebrow: 'Hello, I\'m Jane', title: 'I design brands people remember', subtitle: 'Freelance designer helping small businesses look professional and stand out.', primaryText: 'See my work', secondaryText: 'Hire me' }),
    newSection('gallery', { navLabel: 'Work', title: 'Selected work', columns: '3', images: img([['photo-1460925895917-afdab827c52f', 'Brand identity'], ['photo-1488590528505-98d2b5aba04b', 'Website design'], ['photo-1517336714731-489689fd1ca8', 'App interface'], ['photo-1550745165-9bc0b252726f', 'Poster series'], ['photo-1526374965328-7f61d4dc18c5', 'Packaging'], ['photo-1618005182384-a83a8bd57fbe', 'Social media']]) }),
    newSection('features', { navLabel: 'Skills', title: 'What I do', bg: 'alt' }), newSection('about', { navLabel: 'About', title: 'About me', imageSide: 'left', image: U('photo-1522071820081-009f0129c71c', 1200) }),
    newSection('testimonials', { variant: 'carousel', title: 'Kind words' }), newSection('contact', { navLabel: 'Contact', bg: 'alt' }),
  ]);
}
function photographer(): SiteConfig {
  const c = base('midnight', 'elegant', 'Lens & Light', 'Lens & Light — photography studio', 'Weddings, portraits, events and commercial photography.', 'camera', 'none');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'Photography', title: 'Moments, beautifully kept', subtitle: 'Weddings · Portraits · Events · Commercial', primaryText: 'View portfolio', secondaryText: 'Book a shoot', image: U('photo-1452587925148-ce544e77e70d'), overlay: 'medium' }),
    newSection('gallery', { navLabel: 'Portfolio', title: 'Recent shoots', columns: '4', images: img([['photo-1516035069371-29a1b244cc32', 'Studio'], ['photo-1519225421980-715cb0215aed', 'Weddings'], ['photo-1511795409834-ef04bbd61622', 'Events'], ['photo-1452587925148-ce544e77e70d', 'Gear']]) }),
    newSection('pricing', { navLabel: 'Packages', title: 'Packages', bg: 'alt' }), newSection('about', { navLabel: 'About', imageSide: 'left', title: 'Behind the lens' }),
    newSection('testimonials', { navLabel: 'Reviews' }), newSection('contact', { navLabel: 'Book', bg: 'alt', title: 'Book your session' }),
  ]);
}
function restaurant(): SiteConfig {
  const c = base('coffee', 'elegant', 'The Corner Kitchen', 'The Corner Kitchen — fresh food, warm welcome', 'Home-style meals, fresh ingredients and a welcoming atmosphere.', 'utensils', 'sm');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'Open daily', title: 'Fresh food. Warm welcome.', subtitle: 'Come hungry, leave happy. Home-style meals made with fresh local ingredients.', primaryText: 'Reserve a table', secondaryText: 'See the menu', image: U('photo-1414235077428-338989a2e8c0'), overlay: 'dark' }),
    newSection('about', { navLabel: 'Our story', title: 'Our story', text: 'We started with a simple idea: serve honest food that tastes like home.\n\nEvery dish is prepared fresh each day by our team using ingredients from local farmers and markets.', image: U('photo-1517248135467-4c7edcad34c4', 1200), imageSide: 'left' }),
    newSection('features', { navLabel: 'Menu', title: 'Menu favourites', bg: 'alt', items: cards([['utensils', 'Signature stew', 'Slow-cooked and full of flavour, served with fresh sides.'], ['leaf', 'Fresh salads', 'Crisp, colourful and made to order every day.'], ['gift', 'Homemade desserts', 'The perfect sweet finish to your meal.']]) }),
    newSection('gallery', { navLabel: 'Gallery', title: 'A taste of what\'s cooking', images: img([['photo-1555396273-367ea4eb4db5'], ['photo-1504674900247-0877df9cc836'], ['photo-1414235077428-338989a2e8c0']]) }),
    newSection('testimonials', { navLabel: 'Reviews', bg: 'alt' }), newSection('contact', { navLabel: 'Visit us', title: 'Find us', subtitle: 'Walk in or call ahead to reserve a table.' }),
  ]);
}
function cafe(): SiteConfig {
  const c = base('sunset', 'friendly', 'Daily Grind Café', 'Daily Grind Café — coffee, pastries & good company', 'Freshly roasted coffee, baked goods and a cosy place to meet.', 'coffee', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Fresh daily', title: 'Coffee worth waking up for', subtitle: 'Small-batch roasted beans, warm pastries and a seat with your name on it.', primaryText: 'View menu', secondaryText: 'Find us', image: U('photo-1509042239860-f550ce710b93', 1200) }),
    newSection('features', { navLabel: 'Menu', title: 'Our favourites', bg: 'alt', columns: '4', items: cards([['coffee', 'Espresso & lattes', 'Rich, smooth and perfectly poured.'], ['utensils', 'Fresh pastries', 'Baked every morning.'], ['utensils', 'Light lunch', 'Sandwiches, salads and soups.'], ['gift', 'Sweet treats', 'Cakes, cookies and more.']]) }),
    newSection('gallery', { navLabel: 'Gallery', title: 'Life at the café', images: img([['photo-1554118811-1e0d58224f24'], ['photo-1495474472287-4d71bcdd2085'], ['photo-1509042239860-f550ce710b93']]) }),
    newSection('text', { navLabel: 'Hours', title: 'Opening hours', align: 'center', bg: 'alt', body: 'Monday – Friday: 7:00 – 18:00\nSaturday – Sunday: 8:00 – 17:00' }), newSection('contact', { navLabel: 'Contact' }),
  ]);
}
function salon(): SiteConfig {
  const c = base('royal', 'elegant', 'Glow Beauty Studio', 'Glow Beauty Studio — hair, nails & skincare', 'Relax and be pampered by our friendly beauty professionals.', 'sparkles', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Beauty & wellness', title: 'Look good. Feel amazing.', subtitle: 'Hair, nails, makeup and skincare in a calm, welcoming space.', primaryText: 'Book now', secondaryText: 'Our services', image: U('photo-1560066984-138dadb4c035', 1200) }),
    newSection('features', { navLabel: 'Services', title: 'Treatments', bg: 'alt', items: cards([['scissors', 'Hair styling', 'Cuts, colour, braids and treatments.'], ['sparkles', 'Nails', 'Manicures, pedicures and nail art.'], ['sparkles', 'Skincare', 'Facials and glowing-skin therapies.']]) }),
    newSection('gallery', { navLabel: 'Gallery', title: 'Our work', images: img([['photo-1522337360788-8b13dee7a37e'], ['photo-1487412947147-5cebf100ffc2'], ['photo-1560066984-138dadb4c035']]) }),
    newSection('pricing', { navLabel: 'Prices', bg: 'alt', title: 'Price list' }), newSection('testimonials', { navLabel: 'Reviews' }), newSection('contact', { navLabel: 'Book', bg: 'alt', title: 'Book an appointment' }),
  ]);
}
function clinic(): SiteConfig {
  const c = base('forest', 'modern', 'CareFirst Clinic', 'CareFirst Clinic — caring for your family', 'Trusted family healthcare with experienced doctors and friendly staff.', 'heart-pulse');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Open 7 days', title: 'Healthcare you can trust', subtitle: 'Experienced doctors, modern equipment and a caring team for the whole family.', primaryText: 'Book appointment', secondaryText: 'Our services', image: U('photo-1519494026892-80bbd2d6fd0d', 1200) }),
    newSection('features', { navLabel: 'Services', title: 'Our services', bg: 'alt', columns: '4', items: cards([['heart-pulse', 'General checkups', 'Routine exams and health screening.'], ['user', 'Child health', 'Vaccines and growth monitoring.'], ['sparkles', 'Laboratory', 'Fast, accurate test results.'], ['heart-pulse', 'Pharmacy', 'Prescriptions filled on site.']]) }),
    newSection('stats'), newSection('team', { navLabel: 'Doctors', title: 'Meet our doctors', bg: 'alt' }),
    newSection('faq', { navLabel: 'FAQ' }), newSection('contact', { navLabel: 'Contact', bg: 'alt', title: 'Visit or call us' }),
  ]);
}
function landing(): SiteConfig {
  const c = base('midnight', 'tech', 'Launchly', 'Launchly — the simplest way to launch your product', 'A modern landing page for apps, products and startups.', 'zap', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'centered', eyebrow: 'New', title: 'Launch your idea in days, not months', subtitle: 'Everything you need to introduce your product to the world — fast, simple and beautiful.', primaryText: 'Get started free', secondaryText: 'See how it works' }),
    newSection('features', { navLabel: 'Features', title: 'Why people love it', columns: '4', bg: 'alt', items: cards([['zap', 'Lightning fast', 'Set up in minutes with no technical skills.'], ['lock', 'Secure', 'Your data stays safe and private.'], ['smartphone', 'Mobile ready', 'Looks great on every phone and screen.'], ['message-circle', 'Real support', 'Friendly humans, ready to help.']]) }),
    newSection('stats'), newSection('pricing', { navLabel: 'Pricing', bg: 'alt' }), newSection('faq', { navLabel: 'FAQ' }), newSection('cta', { bg: 'primary', title: 'Ready to launch?', buttonText: 'Start now' }),
  ]);
}
function app(): SiteConfig {
  const c = base('neon', 'tech', 'Pocketly', 'Pocketly — money made simple', 'A mobile app showcase: features, screenshots, reviews and download links.', 'smartphone', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Now on Android & iOS', title: 'Manage your money from your pocket', subtitle: 'Track spending, save towards goals and send money — all in one simple app.', primaryText: 'Download the app', secondaryText: 'See features', image: U('photo-1512941937669-90a1b58e7e9c', 1200) }),
    newSection('features', { navLabel: 'Features', title: 'Everything you need', bg: 'alt', items: cards([['dollar', 'Send & receive', 'Instant transfers to friends and family.'], ['target', 'Savings goals', 'Set targets and watch them grow.'], ['bell', 'Smart alerts', 'Know where every shilling goes.']]) }),
    newSection('stats'), newSection('testimonials', { variant: 'carousel', navLabel: 'Reviews', bg: 'alt' }), newSection('faq', { navLabel: 'FAQ' }),
    newSection('cta', { bg: 'primary', title: 'Get Pocketly today', buttonText: 'Download free' }),
  ]);
}
function wedding(): SiteConfig {
  const c = base('sunset', 'elegant', 'Sarah & David', 'Sarah & David — our wedding', 'Join us in celebrating our special day. Details, schedule and RSVP.', 'sparkles', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'We\'re getting married', title: 'Sarah & David', subtitle: 'Saturday, 12 December 2026 · Kampala', primaryText: 'RSVP', secondaryText: 'Event details', image: U('photo-1519225421980-715cb0215aed'), overlay: 'medium' }),
    newSection('text', { navLabel: 'Our story', title: 'Our story', align: 'center', body: 'We met on a rainy afternoon and have been inseparable ever since.\n\nWe can\'t wait to celebrate with the people we love most.' }),
    newSection('features', { navLabel: 'Schedule', title: 'The big day', bg: 'alt', items: cards([['building', 'Ceremony', '2:00 PM — St. Mary\'s Chapel'], ['wine', 'Reception', '5:00 PM — Garden Pavilion'], ['user', 'Dinner & dance', '7:30 PM — Main hall']]) }),
    newSection('gallery', { navLabel: 'Gallery', title: 'Our moments', images: img([['photo-1511795409834-ef04bbd61622'], ['photo-1519225421980-715cb0215aed'], ['photo-1516035069371-29a1b244cc32']]) }),
    newSection('contact', { navLabel: 'RSVP', bg: 'alt', title: 'Will you join us?', subtitle: 'Please let us know by 1 November.' }),
  ]);
}
function course(): SiteConfig {
  const c = base('ocean', 'friendly', 'BrightPath Academy', 'BrightPath Academy — learn skills that matter', 'Practical courses and training with experienced tutors.', 'graduation', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Enrolling now', title: 'Learn skills that open doors', subtitle: 'Practical, affordable courses taught by people who do the work every day.', primaryText: 'View courses', secondaryText: 'Talk to us', image: U('photo-1522071820081-009f0129c71c', 1200) }),
    newSection('features', { navLabel: 'Courses', title: 'Popular courses', bg: 'alt', items: cards([['laptop', 'Digital skills', 'Computer basics, design and web.'], ['bar-chart', 'Business & finance', 'Bookkeeping and entrepreneurship.'], ['mic', 'Languages', 'English, French and Kiswahili.']]) }),
    newSection('stats'), newSection('pricing', { navLabel: 'Fees', title: 'Course fees', bg: 'alt' }), newSection('testimonials', { navLabel: 'Students' }),
    newSection('faq', { navLabel: 'FAQ', bg: 'alt' }), newSection('contact', { navLabel: 'Enrol', title: 'Enrol today' }),
  ]);
}
function realestate(): SiteConfig {
  const c = base('forest', 'bold', 'Prime Homes', 'Prime Homes — find your place', 'Houses, apartments and land for sale and rent.', 'home', 'sm');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'Buy · Rent · Invest', title: 'Find a home you\'ll love', subtitle: 'Trusted agents, verified listings and honest advice.', primaryText: 'Browse properties', secondaryText: 'Talk to an agent', image: U('photo-1564013799919-ab600027ffc6'), overlay: 'medium' }),
    newSection('gallery', { navLabel: 'Listings', title: 'Featured properties', columns: '3', images: img([['photo-1560518883-ce09059eeffa', '3-bed family home'], ['photo-1564013799919-ab600027ffc6', 'Modern villa'], ['photo-1560518883-ce09059eeffa', 'City apartment']]) }),
    newSection('features', { navLabel: 'Why us', title: 'Why choose us', bg: 'alt', items: cards([['check-circle', 'Verified listings', 'Every property checked in person.'], ['users', 'Honest advice', 'No pressure, no hidden fees.'], ['file-text', 'Paperwork handled', 'We guide you through the legal steps.']]) }),
    newSection('stats'), newSection('team', { navLabel: 'Agents', title: 'Our agents', bg: 'alt' }), newSection('contact', { navLabel: 'Contact', title: 'Talk to an agent' }),
  ]);
}
function blank(): SiteConfig {
  const c = base('mono', 'modern', 'My Website', 'My Website', 'A fresh start — add the sections you need.', 'sparkles', 'md');
  return body(c, [newSection('hero', { navLabel: 'Home', variant: 'centered', eyebrow: '', title: 'Start something great', subtitle: 'Add sections from the left panel, click any text to edit it, and make this site yours.', primaryText: 'Get started', secondaryText: '' })]);
}


/* ───────── PRO templates: self-sufficient sites powered by the Site Engine (cart, bookings, quotes, owner admin) ───────── */
type Img = { u: string };
const im = (...ids: string[]): Img[] => ids.map((id) => ({ u: U(id, 800) }));
function pro(mode: 'shop' | 'book' | 'quote', name: string, tag: string, accent: string, accent2: string, fontPair: string, radius: string, edit: (p: any) => void): SiteConfig {
  const c = defaultConfig();
  c.kind = 'pro';
  const p = defaultPro(mode);
  p.business.name = name; p.business.tag = tag; p.business.mono = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  p.look.accent = accent; p.look.accent2 = accent2; p.look.fontPair = fontPair; p.look.radius = radius;
  p.business.hours = 'Mon–Sat 8:00–18:00';
  // short, clean search title (the field is capped at 70 characters): "Name — first phrase of the tagline"
  p.seo.title = `${name} — ${tag.split(/ [—–-] |, /)[0]}`.slice(0, 70); p.seo.description = tag.slice(0, 160);
  edit(p);
  c.pro = p; c.brand.name = name;
  return c;
}
const slides = (rows: [string, string, string, string][]) => rows.map(([id, t, s, cta]) => ({ u: U(id, 1600), t, s, cta, link: '' }));
const prods = (rows: [string, string, number, number, string, string[]][]) => rows.map(([name, category, price, stock, description, ids]) => ({ name, category, price, stock, description, images: im(...ids) }));

function proBoutique(): SiteConfig {
  return pro('shop', 'Velvet Boutique', 'Fashion & accessories, delivered to your door', '#be185d', '#f59e0b', 'elegant', 'round', (p) => {
    p.hero.slides = slides([['photo-1441984904996-e0b6ba687e04', 'New season is here', 'Handpicked styles for every occasion', 'Shop now'], ['photo-1445205170230-053b83016050', 'Dress to impress', 'Free delivery on orders over UGX 150,000', 'See dresses']]);
    p.about.title = 'Style that feels like you'; p.business.about = 'Velvet Boutique brings you quality fashion at fair prices.\n\nEvery piece is chosen with care — and we deliver across Kampala the same day.';
    p.catalog.products = prods([['Floral summer dress', 'Dresses', 85000, 8, 'Light, breathable and perfect for any day out.', ['photo-1515886657613-9f3515b0c78f']], ['Classic sneakers', 'Shoes', 120000, 12, 'Comfortable all-day wear in a timeless style.', ['photo-1542291026-7eec264c27ff', 'photo-1491553895911-0055eca6402d']], ['Leather handbag', 'Bags', 150000, 5, 'Roomy, durable and beautifully finished.', ['photo-1584917865442-de89df76afd3']], ['Steel wristwatch', 'Accessories', 95000, 9, 'Water-resistant with a classic dial.', ['photo-1524592094714-0f0654e20314']], ['Casual shirt', 'Shirts', 45000, 20, 'Soft cotton, easy to style.', ['photo-1523381210434-271e8be1f52b']], ['Evening gown', 'Dresses', 220000, 3, 'Make an entrance.', ['photo-1445205170230-053b83016050']]]);
    p.catalog.promos = 'WELCOME10=10%'; p.catalog.fee = 8000; p.catalog.mtn = '0770000000'; p.catalog.mtnn = 'Velvet Boutique'; p.catalog.title = 'Shop the collection';
    p.about.stats = [{ v: '2,000+', l: 'Happy customers' }, { v: '300+', l: 'Styles' }, { v: 'Same day', l: 'Kampala delivery' }];
    p.reviews.items = [{ n: 'Grace N.', q: 'Beautiful dress and it arrived the same day. Will shop again!' }, { n: 'Brian K.', q: 'Great quality sneakers at a fair price.' }];
    p.faq.items = [{ q: 'How does delivery work?', a: 'We deliver across Kampala. Fees are shown at checkout; you can also collect in store.' }, { q: 'Can I return an item?', a: 'Yes — within 7 days if it is unworn and in its original condition.' }, { q: 'How do I pay?', a: 'Mobile money, bank transfer or cash on delivery.' }];
    p.services.items = []; p.setup.order = p.setup.order.map((x: any) => (x.id === 'services' ? { ...x, show: false } : x));
  });
}
function proBakery(): SiteConfig {
  return pro('shop', 'Mama Pima Bakery', 'Fresh bread, cakes & pastries baked every morning', '#b45309', '#f59e0b', 'friendly', 'soft', (p) => {
    p.hero.slides = slides([['photo-1509440159596-0249088772ff', 'Warm from the oven', 'Fresh bread and pastries every morning', 'Order now'], ['photo-1578985545062-69928b1d9587', 'Cakes for every celebration', 'Custom orders — just ask', 'See cakes']]);
    p.business.about = 'We have been baking with love for over ten years.\n\nOrder online, pay with mobile money, and collect fresh or have it delivered.';
    p.catalog.products = prods([['Fresh white bread', 'Bread', 4000, 30, 'Soft and fluffy, baked daily.', ['photo-1509440159596-0249088772ff']], ['Chocolate cake', 'Cakes', 55000, 4, 'Rich chocolate, perfect for birthdays.', ['photo-1578985545062-69928b1d9587']], ['Butter croissants (6)', 'Pastries', 18000, 15, 'Flaky and buttery.', ['photo-1555507036-ab1f4038808a']], ['Celebration cake', 'Cakes', 90000, 3, 'Decorated to order — add your message in the note.', ['photo-1565958011703-44f9829ba187']], ['Cupcakes (12)', 'Pastries', 36000, 10, 'Assorted flavours.', ['photo-1486427944299-d1955d23e34d']]]);
    p.catalog.promos = 'FIRST5=5000'; p.catalog.fee = 5000; p.catalog.title = 'Order fresh bakes'; p.catalog.mtn = '0770000000'; p.catalog.mtnn = 'Mama Pima';
    p.services.title = 'Custom orders'; p.services.items = [{ t: 'Wedding cakes', d: 'Tiered cakes designed with you.', p: 'from UGX 250,000' }, { t: 'Party platters', d: 'Pastries and snacks for events.', p: '' }, { t: 'Daily supply', d: 'Bread for shops and restaurants.', p: '' }];
    p.about.stats = [{ v: '10+', l: 'Years baking' }, { v: '500+', l: 'Cakes made' }, { v: '6am', l: 'Fresh every day' }];
  });
}
function proElectronics(): SiteConfig {
  return pro('shop', 'TechFix Hub', 'Phones, laptops & accessories — repairs you can trust', '#0891b2', '#6366f1', 'tech', 'soft', (p) => {
    p.hero.slides = slides([['photo-1511707171634-5f897ff02aa9', 'Phone broken? We fix it fast', 'Screens, batteries and more — most repairs same day', 'Book a repair'], ['photo-1593642632823-8f785ba67e45', 'Laptops & accessories', 'Genuine parts at honest prices', 'Shop now']]);
    p.business.about = 'TechFix Hub repairs phones and laptops and sells quality accessories.\n\nOrder online, pay with mobile money, collect in store or get it delivered.';
    p.catalog.products = prods([['Phone screen protector', 'Accessories', 8000, 60, 'Tempered glass, easy to fit.', ['photo-1511707171634-5f897ff02aa9']], ['Fast charger 25W', 'Chargers', 35000, 25, 'Charges most phones to 50% in 30 minutes.', ['photo-1498049794561-7780e7231661']], ['Wireless headphones', 'Audio', 95000, 8, 'Clear sound and long battery life.', ['photo-1583394838336-acd977736f90']], ['Laptop battery', 'Laptops', 180000, 4, 'Replacement battery — we can fit it for you.', ['photo-1593642632823-8f785ba67e45']]]);
    p.catalog.title = 'Accessories & parts'; p.catalog.fee = 5000; p.catalog.mtn = '0770000000'; p.catalog.mtnn = 'TechFix Hub';
    p.services.title = 'Repair services'; p.services.items = [{ t: 'Screen replacement', d: 'Cracked or dead screens fixed fast.', p: 'from UGX 60,000' }, { t: 'Battery replacement', d: 'Phone not holding charge? New battery fitted while you wait.', p: 'from UGX 40,000' }, { t: 'Laptop repair', d: 'Overheating, slow or won’t start — we diagnose first.', p: 'free diagnosis' }, { t: 'Software & data', d: 'Virus removal, resets and data recovery.', p: '' }];
    p.about.stats = [{ v: '5,000+', l: 'Devices fixed' }, { v: '90 days', l: 'Warranty' }, { v: 'Same day', l: 'Most repairs' }];
  });
}
function proSalon(): SiteConfig {
  return pro('book', 'Glow Beauty Studio', 'Hair, nails & skincare — book your appointment online', '#9333ea', '#ec4899', 'elegant', 'round', (p) => {
    p.hero.slides = slides([['photo-1560066984-138dadb4c035', 'Look good. Feel amazing.', 'Book your appointment in seconds', 'Book now'], ['photo-1522337360788-8b13dee7a37e', 'Hair, nails & skincare', 'Friendly professionals, relaxing space', 'See services']]);
    p.services.title = 'Treatments'; p.services.items = [{ t: 'Haircut & styling', d: 'Cuts, braids, colour and treatments.', p: 'from UGX 30,000' }, { t: 'Manicure & pedicure', d: 'Nail care and gel polish.', p: 'from UGX 25,000' }, { t: 'Facial', d: 'Deep cleansing for glowing skin.', p: 'UGX 60,000' }, { t: 'Bridal makeup', d: 'Trial and wedding-day makeup.', p: 'from UGX 150,000' }];
    p.booking.title = 'Book an appointment'; p.booking.slots = '09:00, 10:00, 11:00, 12:00, 14:00, 15:00, 16:00, 17:00'; p.booking.deposit = 'Bridal makeup=50000\nFacial=10000'; p.catalog.mtn = '0770000000'; p.catalog.mtnn = 'Glow Beauty';
    p.gallery.items = im('photo-1522337360788-8b13dee7a37e', 'photo-1487412947147-5cebf100ffc2', 'photo-1560066984-138dadb4c035').map((x) => ({ u: x.u, c: '' }));
    p.about.stats = [{ v: '8', l: 'Years' }, { v: '3,000+', l: 'Happy clients' }, { v: '5/5', l: 'Reviews' }];
    p.setup.order = p.setup.order.map((x: any) => (x.id === 'catalog' ? { ...x, show: false } : x));
  });
}
function proClinic(): SiteConfig {
  return pro('book', 'CareFirst Clinic', 'Caring for your whole family — book a visit online', '#0d9488', '#2563eb', 'modern', 'soft', (p) => {
    p.hero.slides = slides([['photo-1519494026892-80bbd2d6fd0d', 'Healthcare you can trust', 'Experienced doctors, modern equipment', 'Book a visit'], ['photo-1576091160399-112ba8d25d1d', 'For the whole family', 'Checkups, child health, lab tests and pharmacy', 'Our services']]);
    p.services.title = 'Our services'; p.services.items = [{ t: 'General consultation', d: 'See a doctor for any health concern.', p: 'UGX 30,000' }, { t: 'Child health & vaccines', d: 'Growth checks and immunisation.', p: '' }, { t: 'Laboratory tests', d: 'Fast, accurate results.', p: '' }, { t: 'Pharmacy', d: 'Prescriptions filled on site.', p: '' }];
    p.booking.title = 'Book a visit'; p.booking.intro = 'Choose a day and time — we will confirm by WhatsApp.'; p.booking.slots = '08:00, 09:00, 10:00, 11:00, 14:00, 15:00, 16:00'; p.booking.deposit = '';
    p.about.stats = [{ v: '12', l: 'Doctors' }, { v: '20,000+', l: 'Patients' }, { v: '7 days', l: 'Open every week' }];
    p.setup.order = p.setup.order.map((x: any) => (x.id === 'catalog' ? { ...x, show: false } : x));
  });
}
function proEvents(): SiteConfig {
  return pro('quote', 'Sparkle Events & Catering', 'Weddings, parties & corporate events — get a free quote', '#e11d48', '#f59e0b', 'elegant', 'round', (p) => {
    p.hero.slides = slides([['photo-1519225421980-715cb0215aed', 'Events to remember', 'Planning, décor and catering — all in one', 'Get a free quote'], ['photo-1511795409834-ef04bbd61622', 'From intimate to grand', 'Weddings · Birthdays · Corporate', 'See our work']]);
    p.services.title = 'What we do'; p.services.items = [{ t: 'Weddings', d: 'Full planning, décor and catering.', p: 'from UGX 2,000,000' }, { t: 'Birthdays & parties', d: 'Fun, stress-free celebrations.', p: '' }, { t: 'Corporate events', d: 'Launches, conferences and team days.', p: '' }, { t: 'Catering only', d: 'Delicious food for any size of event.', p: '' }];
    p.booking.title = 'Get a free quote'; p.booking.intro = 'Tell us about your event and we will reply within a few hours.'; p.gallery.items = im('photo-1519225421980-715cb0215aed', 'photo-1511795409834-ef04bbd61622', 'photo-1464366400600-7168b8af9bc3').map((x) => ({ u: x.u, c: '' }));
    p.about.stats = [{ v: '400+', l: 'Events' }, { v: '10', l: 'Years' }, { v: '5/5', l: 'Rated' }];
    p.setup.order = p.setup.order.map((x: any) => (x.id === 'catalog' ? { ...x, show: false } : x));
  });
}

const T = (id: string, name: string, category: string, priceUSD: number, description: string, config: () => SiteConfig, tag?: string): TemplateDef =>
  ({ id, name, category, priceUSD, priceUGX: null, enabled: true, description, tag, config: config() });

export const PRESETS: TemplateDef[] = [
  T('business', 'Business Pro', 'business', 39, 'Clean corporate site: services, stats, reviews, pricing, FAQ and contact.', business, 'Popular'),
  T('consulting', 'Consulting & Agency', 'business', 42, 'Authoritative look with full-screen hero, expertise, team and client stories.', consulting),
  T('portfolio', 'Creative Portfolio', 'portfolio', 29, 'Show off your work with a gallery, skills and a personal about section.', portfolio, 'Popular'),
  T('photographer', 'Photographer Studio', 'portfolio', 32, 'Dark, cinematic gallery site with packages and booking.', photographer),
  T('restaurant', 'Restaurant', 'food', 35, 'Full-screen hero, menu highlights, gallery and a visit-us section.', restaurant),
  T('cafe', 'Café & Bakery', 'food', 29, 'Warm, friendly café site with menu favourites and opening hours.', cafe),
  T('salon', 'Salon & Spa', 'beauty', 35, 'Elegant beauty site with treatments, price list, gallery and bookings.', salon, 'New'),
  T('clinic', 'Clinic & Care', 'beauty', 39, 'Trustworthy healthcare site with services, doctors and FAQ.', clinic),
  T('landing', 'Product Landing', 'startup', 29, 'Dark, modern single-page launch site for products and startups.', landing),
  T('app', 'App Showcase', 'startup', 35, 'Show off a mobile app with features, reviews and download buttons.', app),
  T('wedding', 'Wedding & Event', 'events', 29, 'Romantic one-page invite with schedule, gallery and RSVP.', wedding),
  T('course', 'Course & Academy', 'events', 39, 'Promote courses and training with fees, student reviews and enrolment.', course),
  T('realestate', 'Real Estate', 'realestate', 45, 'Property listings, agents and a strong call to action.', realestate),
  T('blank', 'Blank Canvas', 'blank', 15, 'Start from scratch with a minimal page and build exactly what you want.', blank, 'Starter'),
  // — self-sufficient "Pro" sites: cart & checkout, bookings, quotes, owner admin, order tracking, WhatsApp ordering —
  T('pro-electronics', 'Electronics & Repair Shop', 'shop', 69, 'Sell accessories online and take repair requests — cart, mobile-money checkout and owner admin included.', proElectronics, 'Pro'),
  T('pro-boutique', 'Fashion Boutique Shop', 'shop', 69, 'Full online store: cart, promo codes, delivery, order tracking and an owner admin panel.', proBoutique, 'Pro'),
  T('pro-bakery', 'Bakery & Food Shop', 'shop', 69, 'Take orders for bread, cakes and pastries with mobile-money payment and WhatsApp confirmation.', proBakery, 'Pro'),
  T('pro-salon', 'Salon & Spa Booking', 'booking', 59, 'Online appointment booking with day and time slots, deposits and an owner admin.', proSalon, 'Pro'),
  T('pro-clinic', 'Clinic Appointments', 'booking', 59, 'Let patients book visits online. Slots, reminders by WhatsApp, and a simple owner dashboard.', proClinic, 'Pro'),
  T('pro-events', 'Events & Catering Quotes', 'booking', 59, 'Collect quote requests for weddings and events, with gallery, reviews and owner inbox.', proEvents, 'Pro'),
];

/** Kept for older callers (the store's legacy catalogue helper and Admin). 'blank' is the "start from scratch" design. */
export const BLANK_ID = 'blank';
export const BLANK_TEMPLATE: TemplateDef = PRESETS.find((t) => t.id === BLANK_ID)!;
