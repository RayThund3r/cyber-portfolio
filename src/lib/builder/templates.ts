// src/lib/builder/templates.ts — built-in starter templates (owner can edit / re-price them in /admin).
//
// Prices are a USD *market reference*: comparable premium HTML/Bootstrap templates on the big marketplaces
// typically sell for roughly US$15–60 each. They are converted to UGX at the live exchange rate (see pricing.ts).
// The owner can override any template with a fixed UGX price, set it free (0), or hide it.
import { defaultConfig, newSection, PALETTES, type SiteConfig } from './schema';

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
  const c = base('ocean', 'modern', 'Acme Solutions', 'Acme Solutions — reliable services for growing businesses', 'We help businesses grow with dependable, friendly and affordable services.', '💼');
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
  const c = base('mono', 'classic', 'Northwind Consulting', 'Northwind Consulting — strategy that delivers', 'Independent advisors helping organisations plan, grow and perform.', '📈', 'sm');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'Strategy · Finance · Operations', title: 'Clear advice. Measurable results.', subtitle: 'We work alongside your team to turn plans into performance.', primaryText: 'Book a consultation', secondaryText: 'Our approach', image: U('photo-1460925895917-afdab827c52f'), overlay: 'dark' }),
    newSection('features', { navLabel: 'Expertise', title: 'Where we help', columns: '3', items: cards([['📊', 'Business strategy', 'Market entry, growth plans and competitive positioning.'], ['💰', 'Financial planning', 'Budgets, forecasts and funding readiness.'], ['⚙️', 'Operations', 'Streamlined processes and cost control.']]) }),
    newSection('stats', { bg: 'alt' }), newSection('team', { navLabel: 'Team', title: 'Your advisors' }),
    newSection('testimonials', { variant: 'carousel', bg: 'alt', navLabel: 'Clients' }), newSection('faq', { navLabel: 'FAQ' }),
    newSection('cta', { bg: 'dark', title: 'Let\'s talk about your goals' }), newSection('contact', { navLabel: 'Contact' }),
  ]);
}
function portfolio(): SiteConfig {
  const c = base('royal', 'elegant', 'Jane Doe', 'Jane Doe — Designer & Creative', 'Portfolio of a creative professional: branding, web and visual design.', '🎨', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'centered', eyebrow: 'Hello, I\'m Jane', title: 'I design brands people remember', subtitle: 'Freelance designer helping small businesses look professional and stand out.', primaryText: 'See my work', secondaryText: 'Hire me' }),
    newSection('gallery', { navLabel: 'Work', title: 'Selected work', columns: '3', images: img([['photo-1460925895917-afdab827c52f', 'Brand identity'], ['photo-1488590528505-98d2b5aba04b', 'Website design'], ['photo-1517336714731-489689fd1ca8', 'App interface'], ['photo-1550745165-9bc0b252726f', 'Poster series'], ['photo-1526374965328-7f61d4dc18c5', 'Packaging'], ['photo-1618005182384-a83a8bd57fbe', 'Social media']]) }),
    newSection('features', { navLabel: 'Skills', title: 'What I do', bg: 'alt' }), newSection('about', { navLabel: 'About', title: 'About me', imageSide: 'left', image: U('photo-1522071820081-009f0129c71c', 1200) }),
    newSection('testimonials', { variant: 'carousel', title: 'Kind words' }), newSection('contact', { navLabel: 'Contact', bg: 'alt' }),
  ]);
}
function photographer(): SiteConfig {
  const c = base('midnight', 'elegant', 'Lens & Light', 'Lens & Light — photography studio', 'Weddings, portraits, events and commercial photography.', '📷', 'none');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'Photography', title: 'Moments, beautifully kept', subtitle: 'Weddings · Portraits · Events · Commercial', primaryText: 'View portfolio', secondaryText: 'Book a shoot', image: U('photo-1452587925148-ce544e77e70d'), overlay: 'medium' }),
    newSection('gallery', { navLabel: 'Portfolio', title: 'Recent shoots', columns: '4', images: img([['photo-1516035069371-29a1b244cc32', 'Studio'], ['photo-1519225421980-715cb0215aed', 'Weddings'], ['photo-1511795409834-ef04bbd61622', 'Events'], ['photo-1452587925148-ce544e77e70d', 'Gear']]) }),
    newSection('pricing', { navLabel: 'Packages', title: 'Packages', bg: 'alt' }), newSection('about', { navLabel: 'About', imageSide: 'left', title: 'Behind the lens' }),
    newSection('testimonials', { navLabel: 'Reviews' }), newSection('contact', { navLabel: 'Book', bg: 'alt', title: 'Book your session' }),
  ]);
}
function restaurant(): SiteConfig {
  const c = base('coffee', 'elegant', 'The Corner Kitchen', 'The Corner Kitchen — fresh food, warm welcome', 'Home-style meals, fresh ingredients and a welcoming atmosphere.', '🍽️', 'sm');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'Open daily', title: 'Fresh food. Warm welcome.', subtitle: 'Come hungry, leave happy. Home-style meals made with fresh local ingredients.', primaryText: 'Reserve a table', secondaryText: 'See the menu', image: U('photo-1414235077428-338989a2e8c0'), overlay: 'dark' }),
    newSection('about', { navLabel: 'Our story', title: 'Our story', text: 'We started with a simple idea: serve honest food that tastes like home.\n\nEvery dish is prepared fresh each day by our team using ingredients from local farmers and markets.', image: U('photo-1517248135467-4c7edcad34c4', 1200), imageSide: 'left' }),
    newSection('features', { navLabel: 'Menu', title: 'Menu favourites', bg: 'alt', items: cards([['🍲', 'Signature stew', 'Slow-cooked and full of flavour, served with fresh sides.'], ['🥗', 'Fresh salads', 'Crisp, colourful and made to order every day.'], ['🍰', 'Homemade desserts', 'The perfect sweet finish to your meal.']]) }),
    newSection('gallery', { navLabel: 'Gallery', title: 'A taste of what\'s cooking', images: img([['photo-1555396273-367ea4eb4db5'], ['photo-1504674900247-0877df9cc836'], ['photo-1414235077428-338989a2e8c0']]) }),
    newSection('testimonials', { navLabel: 'Reviews', bg: 'alt' }), newSection('contact', { navLabel: 'Visit us', title: 'Find us', subtitle: 'Walk in or call ahead to reserve a table.' }),
  ]);
}
function cafe(): SiteConfig {
  const c = base('sunset', 'friendly', 'Daily Grind Café', 'Daily Grind Café — coffee, pastries & good company', 'Freshly roasted coffee, baked goods and a cosy place to meet.', '☕', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Fresh daily', title: 'Coffee worth waking up for', subtitle: 'Small-batch roasted beans, warm pastries and a seat with your name on it.', primaryText: 'View menu', secondaryText: 'Find us', image: U('photo-1509042239860-f550ce710b93', 1200) }),
    newSection('features', { navLabel: 'Menu', title: 'Our favourites', bg: 'alt', columns: '4', items: cards([['☕', 'Espresso & lattes', 'Rich, smooth and perfectly poured.'], ['🥐', 'Fresh pastries', 'Baked every morning.'], ['🥪', 'Light lunch', 'Sandwiches, salads and soups.'], ['🧁', 'Sweet treats', 'Cakes, cookies and more.']]) }),
    newSection('gallery', { navLabel: 'Gallery', title: 'Life at the café', images: img([['photo-1554118811-1e0d58224f24'], ['photo-1495474472287-4d71bcdd2085'], ['photo-1509042239860-f550ce710b93']]) }),
    newSection('text', { navLabel: 'Hours', title: 'Opening hours', align: 'center', bg: 'alt', body: 'Monday – Friday: 7:00 – 18:00\nSaturday – Sunday: 8:00 – 17:00' }), newSection('contact', { navLabel: 'Contact' }),
  ]);
}
function salon(): SiteConfig {
  const c = base('royal', 'elegant', 'Glow Beauty Studio', 'Glow Beauty Studio — hair, nails & skincare', 'Relax and be pampered by our friendly beauty professionals.', '💅', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Beauty & wellness', title: 'Look good. Feel amazing.', subtitle: 'Hair, nails, makeup and skincare in a calm, welcoming space.', primaryText: 'Book now', secondaryText: 'Our services', image: U('photo-1560066984-138dadb4c035', 1200) }),
    newSection('features', { navLabel: 'Services', title: 'Treatments', bg: 'alt', items: cards([['💇', 'Hair styling', 'Cuts, colour, braids and treatments.'], ['💅', 'Nails', 'Manicures, pedicures and nail art.'], ['✨', 'Skincare', 'Facials and glowing-skin therapies.']]) }),
    newSection('gallery', { navLabel: 'Gallery', title: 'Our work', images: img([['photo-1522337360788-8b13dee7a37e'], ['photo-1487412947147-5cebf100ffc2'], ['photo-1560066984-138dadb4c035']]) }),
    newSection('pricing', { navLabel: 'Prices', bg: 'alt', title: 'Price list' }), newSection('testimonials', { navLabel: 'Reviews' }), newSection('contact', { navLabel: 'Book', bg: 'alt', title: 'Book an appointment' }),
  ]);
}
function clinic(): SiteConfig {
  const c = base('forest', 'modern', 'CareFirst Clinic', 'CareFirst Clinic — caring for your family', 'Trusted family healthcare with experienced doctors and friendly staff.', '🩺');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Open 7 days', title: 'Healthcare you can trust', subtitle: 'Experienced doctors, modern equipment and a caring team for the whole family.', primaryText: 'Book appointment', secondaryText: 'Our services', image: U('photo-1519494026892-80bbd2d6fd0d', 1200) }),
    newSection('features', { navLabel: 'Services', title: 'Our services', bg: 'alt', columns: '4', items: cards([['🩺', 'General checkups', 'Routine exams and health screening.'], ['👶', 'Child health', 'Vaccines and growth monitoring.'], ['🧪', 'Laboratory', 'Fast, accurate test results.'], ['💊', 'Pharmacy', 'Prescriptions filled on site.']]) }),
    newSection('stats'), newSection('team', { navLabel: 'Doctors', title: 'Meet our doctors', bg: 'alt' }),
    newSection('faq', { navLabel: 'FAQ' }), newSection('contact', { navLabel: 'Contact', bg: 'alt', title: 'Visit or call us' }),
  ]);
}
function landing(): SiteConfig {
  const c = base('midnight', 'tech', 'Launchly', 'Launchly — the simplest way to launch your product', 'A modern landing page for apps, products and startups.', '⚡', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'centered', eyebrow: 'New', title: 'Launch your idea in days, not months', subtitle: 'Everything you need to introduce your product to the world — fast, simple and beautiful.', primaryText: 'Get started free', secondaryText: 'See how it works' }),
    newSection('features', { navLabel: 'Features', title: 'Why people love it', columns: '4', bg: 'alt', items: cards([['⚡', 'Lightning fast', 'Set up in minutes with no technical skills.'], ['🔒', 'Secure', 'Your data stays safe and private.'], ['📱', 'Mobile ready', 'Looks great on every phone and screen.'], ['💬', 'Real support', 'Friendly humans, ready to help.']]) }),
    newSection('stats'), newSection('pricing', { navLabel: 'Pricing', bg: 'alt' }), newSection('faq', { navLabel: 'FAQ' }), newSection('cta', { bg: 'primary', title: 'Ready to launch?', buttonText: 'Start now' }),
  ]);
}
function app(): SiteConfig {
  const c = base('neon', 'tech', 'Pocketly', 'Pocketly — money made simple', 'A mobile app showcase: features, screenshots, reviews and download links.', '📱', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Now on Android & iOS', title: 'Manage your money from your pocket', subtitle: 'Track spending, save towards goals and send money — all in one simple app.', primaryText: 'Download the app', secondaryText: 'See features', image: U('photo-1512941937669-90a1b58e7e9c', 1200) }),
    newSection('features', { navLabel: 'Features', title: 'Everything you need', bg: 'alt', items: cards([['💸', 'Send & receive', 'Instant transfers to friends and family.'], ['🎯', 'Savings goals', 'Set targets and watch them grow.'], ['🔔', 'Smart alerts', 'Know where every shilling goes.']]) }),
    newSection('stats'), newSection('testimonials', { variant: 'carousel', navLabel: 'Reviews', bg: 'alt' }), newSection('faq', { navLabel: 'FAQ' }),
    newSection('cta', { bg: 'primary', title: 'Get Pocketly today', buttonText: 'Download free' }),
  ]);
}
function wedding(): SiteConfig {
  const c = base('sunset', 'elegant', 'Sarah & David', 'Sarah & David — our wedding', 'Join us in celebrating our special day. Details, schedule and RSVP.', '💍', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'We\'re getting married', title: 'Sarah & David', subtitle: 'Saturday, 12 December 2026 · Kampala', primaryText: 'RSVP', secondaryText: 'Event details', image: U('photo-1519225421980-715cb0215aed'), overlay: 'medium' }),
    newSection('text', { navLabel: 'Our story', title: 'Our story', align: 'center', body: 'We met on a rainy afternoon and have been inseparable ever since.\n\nWe can\'t wait to celebrate with the people we love most.' }),
    newSection('features', { navLabel: 'Schedule', title: 'The big day', bg: 'alt', items: cards([['⛪', 'Ceremony', '2:00 PM — St. Mary\'s Chapel'], ['🥂', 'Reception', '5:00 PM — Garden Pavilion'], ['💃', 'Dinner & dance', '7:30 PM — Main hall']]) }),
    newSection('gallery', { navLabel: 'Gallery', title: 'Our moments', images: img([['photo-1511795409834-ef04bbd61622'], ['photo-1519225421980-715cb0215aed'], ['photo-1516035069371-29a1b244cc32']]) }),
    newSection('contact', { navLabel: 'RSVP', bg: 'alt', title: 'Will you join us?', subtitle: 'Please let us know by 1 November.' }),
  ]);
}
function course(): SiteConfig {
  const c = base('ocean', 'friendly', 'BrightPath Academy', 'BrightPath Academy — learn skills that matter', 'Practical courses and training with experienced tutors.', '🎓', 'lg');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'split', eyebrow: 'Enrolling now', title: 'Learn skills that open doors', subtitle: 'Practical, affordable courses taught by people who do the work every day.', primaryText: 'View courses', secondaryText: 'Talk to us', image: U('photo-1522071820081-009f0129c71c', 1200) }),
    newSection('features', { navLabel: 'Courses', title: 'Popular courses', bg: 'alt', items: cards([['💻', 'Digital skills', 'Computer basics, design and web.'], ['📊', 'Business & finance', 'Bookkeeping and entrepreneurship.'], ['🗣️', 'Languages', 'English, French and Kiswahili.']]) }),
    newSection('stats'), newSection('pricing', { navLabel: 'Fees', title: 'Course fees', bg: 'alt' }), newSection('testimonials', { navLabel: 'Students' }),
    newSection('faq', { navLabel: 'FAQ', bg: 'alt' }), newSection('contact', { navLabel: 'Enrol', title: 'Enrol today' }),
  ]);
}
function realestate(): SiteConfig {
  const c = base('forest', 'bold', 'Prime Homes', 'Prime Homes — find your place', 'Houses, apartments and land for sale and rent.', '🏠', 'sm');
  return body(c, [
    newSection('hero', { navLabel: 'Home', variant: 'image', eyebrow: 'Buy · Rent · Invest', title: 'Find a home you\'ll love', subtitle: 'Trusted agents, verified listings and honest advice.', primaryText: 'Browse properties', secondaryText: 'Talk to an agent', image: U('photo-1564013799919-ab600027ffc6'), overlay: 'medium' }),
    newSection('gallery', { navLabel: 'Listings', title: 'Featured properties', columns: '3', images: img([['photo-1560518883-ce09059eeffa', '3-bed family home'], ['photo-1564013799919-ab600027ffc6', 'Modern villa'], ['photo-1560518883-ce09059eeffa', 'City apartment']]) }),
    newSection('features', { navLabel: 'Why us', title: 'Why choose us', bg: 'alt', items: cards([['✅', 'Verified listings', 'Every property checked in person.'], ['🤝', 'Honest advice', 'No pressure, no hidden fees.'], ['📑', 'Paperwork handled', 'We guide you through the legal steps.']]) }),
    newSection('stats'), newSection('team', { navLabel: 'Agents', title: 'Our agents', bg: 'alt' }), newSection('contact', { navLabel: 'Contact', title: 'Talk to an agent' }),
  ]);
}
function blank(): SiteConfig {
  const c = base('mono', 'modern', 'My Website', 'My Website', 'A fresh start — add the sections you need.', '✨', 'md');
  return body(c, [newSection('hero', { navLabel: 'Home', variant: 'centered', eyebrow: '', title: 'Start something great', subtitle: 'Add sections from the left panel, click any text to edit it, and make this site yours.', primaryText: 'Get started', secondaryText: '' })]);
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
];

/** Kept for older callers (the store's legacy catalogue helper and Admin). 'blank' is the "start from scratch" design. */
export const BLANK_ID = 'blank';
export const BLANK_TEMPLATE: TemplateDef = PRESETS.find((t) => t.id === BLANK_ID)!;
