// src/lib/builder/draft.ts
//
// "Build me a website": turns a short brief (business, kind of business, city, services, contact) into a complete, ready-to-edit
// SiteConfig by starting from one of our own templates and writing the real details into it. Pure and deterministic, so it works
// with no AI model at all; an AI model may only supply optional extra wording (see `mergeCopy`), which is validated here.
//
// Honesty rule: templates ship with placeholder reviews, fake numbers and sample prices. A draft never presents those as real:
// reviews, stats and price tables are switched off (and the notes tell the customer to add their own).
import { PRESETS } from './templates';
import { PALETTES, newSection, type SiteConfig } from './schema';
import { sanitizeConfig } from './sanitize';

export type IndustryId =
  | 'restaurant' | 'cafe' | 'bakery' | 'salon' | 'barber' | 'clinic' | 'repair' | 'boutique' | 'shop' | 'business' | 'consulting'
  | 'photographer' | 'portfolio' | 'events' | 'school' | 'realestate' | 'startup' | 'app' | 'farm';

export interface Brief {
  name: string;
  kind: IndustryId;
  city?: string;
  services?: string[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  palette?: string;
  tagline?: string;
}

interface Industry {
  id: IndustryId; label: string; template: string; match: RegExp;
  hero: (n: string, city?: string) => [string, string]; // headline, sub-headline
  cta: string; eyebrow: string; about: (n: string, city?: string) => string;
  services: Array<[string, string, string]>; // icon, title, text
  bullets: string[];
}
const inCity = (c?: string) => (c ? ` in ${c}` : '');

export const INDUSTRIES: Industry[] = [
  { id: 'repair', label: 'phone & electronics repair', template: 'pro-electronics', match: /\b(repair|fix(ing)?|phone shop|electronics?|gadgets?|computer (shop|store)|laptops?|screens?)\b/i,
    hero: (n, c) => [`Fast, honest repairs${inCity(c)}`, `${n} fixes phones, laptops and gadgets quickly, with clear prices before we start.`], cta: 'Request a repair', eyebrow: 'Repairs & accessories',
    about: (n, c) => `${n} is a repair and electronics shop${inCity(c)}. We tell you what is wrong, what it costs and how long it will take before any work begins.\n\nBring your device in, or send us the details and we will get back to you.`,
    services: [['📱', 'Phone repairs', 'Screens, batteries, charging ports and water damage.'], ['💻', 'Laptop repairs', 'Slow, overheating or not turning on? We diagnose and fix.'], ['🔌', 'Accessories', 'Chargers, cables, cases and more.'], ['💾', 'Data recovery', 'Help recovering photos and files.']], bullets: ['Clear price before we start', 'Quick turnaround', 'Friendly advice'] },
  { id: 'salon', label: 'salon & beauty', template: 'pro-salon', match: /\b(salon|spa|beauty|hair( ?dress(er|ing))?|nails?|makeup|braids?|lashes|massage)\b/i,
    hero: (n, c) => [`Look and feel your best${inCity(c)}`, `${n} offers professional hair and beauty care in a relaxed, friendly space.`], cta: 'Book an appointment', eyebrow: 'Hair · Beauty · Care',
    about: (n, c) => `${n} is a beauty studio${inCity(c)}. We listen first, then take care of the rest, so you leave looking and feeling great.\n\nBook online or message us to choose a time that suits you.`,
    services: [['💇', 'Hair styling', 'Cuts, styling, braids and treatments.'], ['💅', 'Nails', 'Manicures, pedicures and nail art.'], ['💆', 'Skin & spa', 'Facials and relaxing treatments.'], ['💄', 'Makeup', 'Everyday looks and special occasions.']], bullets: ['Professional, friendly team', 'Clean, comfortable space', 'Easy online booking'] },
  { id: 'barber', label: 'barber shop', template: 'salon', match: /\b(barber(shop)?|haircuts?|fades?)\b/i,
    hero: (n, c) => [`Sharp cuts${inCity(c)}`, `${n}: clean fades, neat beards and a good chat.`], cta: 'Book a chair', eyebrow: 'Barbers',
    about: (n, c) => `${n} is a barber shop${inCity(c)}. Walk in or book ahead and leave looking sharp.`,
    services: [['✂️', 'Haircuts', 'Fades, tapers and classic cuts.'], ['🧔', 'Beard trim', 'Shape-ups and clean lines.'], ['👦', 'Kids cuts', 'Patient and friendly for little ones.']], bullets: ['Walk-ins welcome', 'Clean tools every time'] },
  { id: 'clinic', label: 'clinic', template: 'pro-clinic', match: /\b(clinic|doctor|dental|dentist|medical|health ?care|pharmacy|hospital|physio(therapy)?)\b/i,
    hero: (n, c) => [`Caring health services${inCity(c)}`, `${n} provides trusted care with appointments that fit your day.`], cta: 'Book a visit', eyebrow: 'Health & care',
    about: (n, c) => `${n} is a health clinic${inCity(c)}. Our team takes time to listen and explain, so you always know what happens next.`,
    services: [['🩺', 'Consultations', 'See a professional about your health concerns.'], ['💉', 'Treatments', 'Care and follow-up that fits your needs.'], ['🧪', 'Tests', 'Simple, fast testing and results.']], bullets: ['Caring, qualified team', 'Easy appointments'] },
  { id: 'restaurant', label: 'restaurant', template: 'restaurant', match: /\b(restaurant|eatery|kitchen|grill|bistro|diner|food (place|joint)|catering|takeaway|lounge|bar)\b/i,
    hero: (n, c) => [`Good food${inCity(c)}, made fresh`, `Come hungry. ${n} serves freshly cooked meals in a warm, welcoming place.`], cta: 'See the menu', eyebrow: 'Dine in · Takeaway',
    about: (n, c) => `${n} is a restaurant${inCity(c)}. We cook with fresh ingredients and serve food the way it should be: hot, generous and with a smile.`,
    services: [['🍽️', 'Dine in', 'Relax and enjoy a meal with family and friends.'], ['🥡', 'Takeaway', 'Order ahead and pick up.'], ['🎉', 'Events', 'Space and menus for parties and gatherings.']], bullets: ['Fresh ingredients', 'Friendly service'] },
  { id: 'bakery', label: 'bakery', template: 'pro-bakery', match: /\b(bakery|bakes?|baker|cakes?|pastr(y|ies)|bread|cupcakes?)\b/i,
    hero: (n, c) => [`Fresh from the oven${inCity(c)}`, `${n} bakes bread, cakes and pastries for everyday treats and big celebrations.`], cta: 'Order now', eyebrow: 'Bakery',
    about: (n, c) => `${n} is a bakery${inCity(c)}. Everything is baked fresh, from morning bread to custom celebration cakes.`,
    services: [['🍞', 'Fresh bread', 'Baked every day.'], ['🎂', 'Custom cakes', 'Birthdays, weddings and special days.'], ['🥐', 'Pastries', 'Sweet and savoury favourites.']], bullets: ['Baked fresh daily', 'Custom orders welcome'] },
  { id: 'cafe', label: 'café', template: 'cafe', match: /\b(caf[eé]|coffee|tea ?house|juice bar|ice ?cream)\b/i,
    hero: (n, c) => [`Your cosy corner${inCity(c)}`, `${n} serves great coffee, snacks and good company.`], cta: 'See our menu', eyebrow: 'Coffee · Snacks',
    about: (n, c) => `${n} is a café${inCity(c)}. Stop by for a good cup, a bite to eat and a quiet moment.`,
    services: [['☕', 'Coffee & tea', 'Brewed with care.'], ['🥪', 'Light meals', 'Breakfast and lunch favourites.'], ['🍰', 'Sweet treats', 'Cakes and pastries.']], bullets: ['Cosy and welcoming', 'Free Wi-Fi'] },
  { id: 'boutique', label: 'fashion boutique', template: 'pro-boutique', match: /\b(boutique|fashion|clothes|clothing|apparel|dress(es)?|shoes?|sneakers|tailor(ing)?|bags?|jewel(l)?ery)\b/i,
    hero: (n, c) => [`Style that fits you${inCity(c)}`, `${n} brings you quality fashion you can order online and get delivered.`], cta: 'Shop now', eyebrow: 'New arrivals',
    about: (n, c) => `${n} is a fashion boutique${inCity(c)}. We pick pieces we love and make ordering simple, with delivery to your door.`,
    services: [['👗', 'Women', 'Dresses, tops and everyday outfits.'], ['👔', 'Men', 'Smart and casual wear.'], ['🚚', 'Delivery', 'Order online and we bring it to you.']], bullets: ['Quality you can feel', 'Easy ordering and delivery'] },
  { id: 'shop', label: 'online shop', template: 'pro-boutique', match: /\b(shop|store|sell(ing)?|market|supermarket|wholesale|e-?commerce|retail)\b/i,
    hero: (n, c) => [`Shop with ${n}${c ? ` · ${c}` : ''}`, 'Browse our products, add to cart and order in minutes.'], cta: 'Shop now', eyebrow: 'Online shop',
    about: (n, c) => `${n} is a shop${inCity(c)}. Order online and we will confirm quickly and arrange delivery or pickup.`,
    services: [['🛒', 'Wide choice', 'Products you need, all in one place.'], ['💳', 'Easy payment', 'Pay with mobile money.'], ['🚚', 'Delivery', 'Delivery or pickup, your choice.']], bullets: ['Easy ordering', 'Mobile money accepted'] },
  { id: 'consulting', label: 'consulting', template: 'consulting', match: /\b(consult(ing|ant|ancy)?|advis(or|ory)|agency|accounting|accountant|audit|law (firm|office)|lawyer|legal|marketing|training|insurance)\b/i,
    hero: (n, c) => [`Clear advice. Real results${inCity(c)}`, `${n} helps organisations and individuals plan, decide and grow.`], cta: 'Talk to us', eyebrow: 'Advisory',
    about: (n, c) => `${n} works with clients${inCity(c)} to turn plans into results. We keep things practical, honest and on schedule.`,
    services: [['📊', 'Strategy', 'Plans that fit your goals and budget.'], ['🧾', 'Reporting', 'Clear numbers you can act on.'], ['🤝', 'Support', 'Hands-on help when you need it.']], bullets: ['Practical advice', 'Clear communication'] },
  { id: 'photographer', label: 'photography', template: 'photographer', match: /\b(photograph(er|y)?|photo ?studio|videograph(er|y)|film(maker)?|studio shoots?)\b/i,
    hero: (n, c) => [`Moments, beautifully kept${inCity(c)}`, `${n} captures weddings, portraits and events with care.`], cta: 'Book a shoot', eyebrow: 'Photography',
    about: (n, c) => `${n} is a photography studio${inCity(c)}. We make relaxed, natural pictures you will want to keep for years.`,
    services: [['📸', 'Portraits', 'Individuals, couples and families.'], ['💍', 'Weddings', 'Full-day coverage and albums.'], ['🎬', 'Events', 'Parties, launches and corporate events.']], bullets: ['Relaxed, natural style', 'Fast delivery of photos'] },
  { id: 'portfolio', label: 'personal portfolio', template: 'portfolio', match: /\b(portfolio|freelanc(er|e)|designer|developer|artist|illustrator|my work|cv)\b/i,
    hero: (n, c) => [`Hi, I am ${n}`, `Designer and maker${inCity(c)}. Have a look at my work and get in touch.`], cta: 'See my work', eyebrow: 'Portfolio',
    about: (n, c) => `I am ${n}${c ? `, based in ${c}` : ''}. I love turning ideas into work people enjoy using and looking at.`,
    services: [['🎨', 'Design', 'Brand and visual design.'], ['💻', 'Web', 'Websites and web apps.'], ['📱', 'Mobile', 'Apps and interfaces.']], bullets: ['Clear communication', 'Delivered on time'] },
  { id: 'events', label: 'events', template: 'wedding', match: /\b(wedding|events?|party|parties|decor(ation)?s?|planner|planning|dj|sound hire|mc)\b/i,
    hero: (n, c) => [`Celebrate beautifully${inCity(c)}`, `${n} plans and delivers weddings and events with care.`], cta: 'Plan your event', eyebrow: 'Weddings · Events',
    about: (n, c) => `${n} brings events to life${inCity(c)}. Tell us your date and ideas and we take care of the details.`,
    services: [['💒', 'Weddings', 'Planning, decor and coordination.'], ['🎉', 'Parties', 'Birthdays, graduations and more.'], ['🎤', 'Corporate', 'Launches, meetings and dinners.']], bullets: ['Stress-free planning', 'Attention to detail'] },
  { id: 'school', label: 'school / training', template: 'course', match: /\b(school|academy|course|class(es)?|tutor(ing)?|college|institute|training centre|lessons?|nursery|daycare)\b/i,
    hero: (n, c) => [`Learn with confidence${inCity(c)}`, `${n} offers practical classes with caring teachers.`], cta: 'Enrol now', eyebrow: 'Learn · Grow',
    about: (n, c) => `${n} is a place to learn${inCity(c)}. Small groups, patient teachers and a clear path from beginner to confident.`,
    services: [['📚', 'Courses', 'Structured classes for different levels.'], ['🧑‍🏫', 'One-to-one', 'Personal help when you need it.'], ['🎓', 'Certificates', 'Proof of what you have learned.']], bullets: ['Caring teachers', 'Flexible schedules'] },
  { id: 'realestate', label: 'real estate', template: 'realestate', match: /\b(real ?estate|properties|property|houses?|apartments?|land|rentals?|landlord|agent)\b/i,
    hero: (n, c) => [`Find your next place${inCity(c)}`, `${n} helps you rent, buy and sell with honest advice.`], cta: 'View listings', eyebrow: 'Property',
    about: (n, c) => `${n} is a real-estate business${inCity(c)}. We show you real options, explain the process and stay with you to the end.`,
    services: [['🏠', 'Homes', 'Houses and apartments to rent or buy.'], ['🌍', 'Land', 'Plots with clear paperwork.'], ['🏢', 'Commercial', 'Offices and shops.']], bullets: ['Honest advice', 'Viewings arranged for you'] },
  { id: 'app', label: 'app', template: 'app', match: /\b(app|mobile app|android|ios)\b/i,
    hero: (n) => [`Meet ${n}`, 'A simple app that makes your day easier. Download it today.'], cta: 'Get the app', eyebrow: 'Now available',
    about: (n) => `${n} is built to be fast, simple and useful from the first minute.`,
    services: [['⚡', 'Fast', 'Opens quickly and works smoothly.'], ['🔒', 'Private', 'Your data stays yours.'], ['📲', 'Simple', 'Easy to learn and use.']], bullets: ['Free to try', 'Works on most phones'] },
  { id: 'startup', label: 'product / startup', template: 'landing', match: /\b(startup|product|saas|software|platform|launch|landing page)\b/i,
    hero: (n) => [`${n}: built for what is next`, 'A clear, modern product page that explains what you do and invites people to try it.'], cta: 'Get started', eyebrow: 'New',
    about: (n) => `${n} exists to solve one problem really well.`,
    services: [['🚀', 'Fast start', 'Up and running in minutes.'], ['🧩', 'Flexible', 'Fits the way you work.'], ['🛟', 'Support', 'Real people ready to help.']], bullets: ['Simple pricing', 'Friendly support'] },
  { id: 'farm', label: 'farm / agribusiness', template: 'business', match: /\b(farm(ing|er)?|agri(culture|business)?|poultry|dairy|crops?|livestock|produce)\b/i,
    hero: (n, c) => [`Fresh from the farm${inCity(c)}`, `${n} grows and supplies quality produce you can trust.`], cta: 'Order produce', eyebrow: 'Farm fresh',
    about: (n, c) => `${n} is a farming business${inCity(c)}. We care about quality from the field to your table.`,
    services: [['🌽', 'Fresh produce', 'Harvested and delivered fresh.'], ['🥚', 'Poultry & eggs', 'Reliable supply.'], ['🚚', 'Delivery', 'To homes, shops and restaurants.']], bullets: ['Quality you can see', 'Reliable supply'] },
  { id: 'business', label: 'business', template: 'business', match: /\b(business|company|services?|enterprise|ltd|limited|contractor|construction|cleaning|transport|logistics|security|printing)\b/i,
    hero: (n, c) => [`${n}: reliable service${inCity(c)}`, 'Practical services, clear pricing and friendly people.'], cta: 'Get in touch', eyebrow: 'Welcome',
    about: (n, c) => `${n} is a local business${inCity(c)}. We keep our promises, explain our prices and treat every customer fairly.`,
    services: [['🛠️', 'Quality work', 'Done properly the first time.'], ['⏱️', 'On time', 'We respect your schedule.'], ['🤝', 'Fair pricing', 'Clear quotes with no surprises.']], bullets: ['Friendly, reliable service', 'Fair and clear pricing'] },
];

export const industryById = (id: string) => INDUSTRIES.find((i) => i.id === id);
export const detectIndustry = (text: string): IndustryId | null => INDUSTRIES.find((i) => i.match.test(text))?.id ?? null;

const CITIES = ['kampala', 'entebbe', 'jinja', 'mbarara', 'gulu', 'mbale', 'masaka', 'fort portal', 'lira', 'arua', 'wakiso', 'mukono', 'nairobi', 'mombasa', 'kisumu', 'kigali', 'dar es salaam', 'arusha', 'lagos', 'abuja', 'accra', 'kumasi', 'johannesburg', 'cape town', 'addis ababa', 'juba'];
const COLOURS: Array<[RegExp, string]> = [
  [/\b(blue|navy)\b/i, 'ocean'], [/\b(orange|red|warm)\b/i, 'sunset'], [/\bgreen\b/i, 'forest'], [/\b(purple|violet|pink)\b/i, 'royal'],
  [/\b(brown|coffee)\b/i, 'coffee'], [/\b(black and white|monochrome|grey|gray|minimal)\b/i, 'mono'], [/\b(dark|black|night)\b/i, 'midnight'], [/\b(neon|lime)\b/i, 'neon'],
];
const titleCase = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/(^|\s)([a-z])/g, (_, a, b) => a + b.toUpperCase());

/** Reads what it can from free text ("a website for my salon called Glam Studio in Kampala, we do braids and nails, 0772 123 456"). */
export function parseBrief(text: string): Partial<Brief> {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const out: Partial<Brief> = {};
  const kind = detectIndustry(t.replace(/\b(web ?site|web ?page|landing page|online shop|online store)\b/gi, ' '));
  if (kind) out.kind = kind;
  const nm = t.match(/\b(?:called|named|name is|name's|branded)\s+["“'‘]?([A-Za-z0-9][^,.;\n"”’]{1,40}?)(?=["”’]?\s+(?:in|at|based|located|that|which|who|with|and|selling|offering|we|for)\b|["”’]?[,.;\n]|["”’]?$)/i);
  if (nm) out.name = titleCase(nm[1].replace(/["“”'‘’]/g, ''));
  const em = t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (em) out.email = em[0].slice(0, 100);
  const ph = t.match(/(?:\+?\d[\d ()-]{7,16}\d)/);
  if (ph) { const d = ph[0].replace(/[^\d+]/g, ''); if (d.replace(/\D/g, '').length >= 9) { out.phone = ph[0].trim().slice(0, 30); if (/whats ?app/i.test(t)) out.whatsapp = d.replace(/^\+/, '').replace(/^0/, '256').slice(0, 20); } }
  const low = t.toLowerCase();
  const known = CITIES.find((c) => new RegExp(`\\b${c}\\b`).test(low));
  const capIn = t.match(/\b(?:in|at|based in|located in|around)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  const city = known ? titleCase(known) : capIn?.[1];
  if (city && !/^(The|My|Our|A)$/.test(city) && !(out.name && city.toLowerCase() === out.name.toLowerCase())) out.city = city;
  const sv = t.match(/\b(?:we (?:do|offer|sell|provide|make|have)|selling|offering|services?(?: include)?:?|offers?|including|specialis(?:e|ing) in|sells?)\s+(.{3,220})/i);
  if (sv) {
    const parts = sv[1].replace(/\b(phone|call|whatsapp|email|contact)\b.*$/i, '').split(/,|;|\band\b|&|\//i).map((x) => x.trim().replace(/^(?:and|also|the|a|an)\s+/i, '').replace(/[.!?]+\s*$/g, '').trim()).filter((x) => x.length >= 3 && x.length <= 40 && !/\d{6,}/.test(x));
    if (parts.length) out.services = [...new Set(parts.map(titleCase))].slice(0, 6);
  }
  for (const [re, id] of COLOURS) if (re.test(t)) { out.palette = id; break; }
  return out;
}

export interface Copy { tagline?: string; about?: string; services?: Array<{ title: string; text: string }> }

/** Accepts optional AI wording only after strict checks; anything odd is dropped and the built-in wording stays. */
export function mergeCopy(raw: unknown): Copy {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const bad = /(https?:\/\/|www\.|@|\d{6,}|guarantee[ds]? (?:100|results)|#1\b|award[- ]winning|best in)/i; // no invented links, numbers, awards or promises
  const out: Copy = {};
  const tag = str(o.tagline, 90); if (tag.length >= 8 && !bad.test(tag)) out.tagline = tag;
  const about = typeof o.about === 'string' ? o.about.replace(/<[^>]*>/g, '').trim().slice(0, 600) : '';
  if (about.length >= 40 && !bad.test(about)) out.about = about;
  if (Array.isArray(o.services)) {
    const sv = o.services.slice(0, 6).map((s) => ({ title: str((s as any)?.title, 40), text: str((s as any)?.text, 160) })).filter((s) => s.title.length >= 2 && s.text.length >= 10 && !bad.test(s.text) && !bad.test(s.title));
    if (sv.length) out.services = sv;
  }
  return out;
}

export interface Draft { templateId: string; templateName: string; name: string; config: SiteConfig; notes: string[] }

/** Builds the full site config. Never throws for a reasonable brief; the result has passed the same sanitiser the editor uses. */
export function buildDraft(brief: Brief, copy: Copy = {}): Draft {
  const ind = industryById(brief.kind) || industryById('business')!;
  const preset = PRESETS.find((p) => p.id === ind.template) || PRESETS.find((p) => p.id === 'business')!;
  const cfg: SiteConfig = JSON.parse(JSON.stringify(preset.config));
  const name = (brief.name || 'My Business').trim().slice(0, 40);
  const city = brief.city?.trim();
  const [h1, h2] = ind.hero(name, city);
  const tagline = copy.tagline || brief.tagline || h1;
  const about = copy.about || ind.about(name, city);
  const notes: string[] = [];

  const svc: Array<[string, string, string]> = copy.services?.length
    ? copy.services.map((s, i) => [ind.services[i % ind.services.length][0], s.title, s.text])
    : brief.services?.length
      ? brief.services.map((s, i): [string, string, string] => {
          const known = ind.services.find((d) => d[1].toLowerCase() === s.toLowerCase());
          return known || [ind.services[i % ind.services.length][0], s, `${s}${inCity(city)}. Get in touch for details and prices.`];
        })
      : ind.services;

  // site-level
  cfg.brand.name = name;
  cfg.meta = { ...cfg.meta, title: `${name}${city ? ` — ${city}` : ''} — ${ind.label}`.slice(0, 70), description: `${name}${inCity(city)}. ${h2}`.slice(0, 160) };
  const pal = PALETTES.find((p) => p.id === brief.palette);
  if (pal) cfg.theme = { ...cfg.theme, mode: pal.mode, primary: pal.primary, secondary: pal.secondary, bg: pal.bg, alt: pal.alt, text: pal.text };

  // classic sections
  const first = <T extends string>(type: T) => cfg.sections.find((s) => s.type === type);
  const hero = first('hero'); if (hero) Object.assign(hero.data, { eyebrow: ind.eyebrow, title: tagline, subtitle: h2, primaryText: ind.cta });
  const abt = first('about'); if (abt) Object.assign(abt.data, { title: `About ${name}`, text: about, bullets: ind.bullets.map((text) => ({ text })) });
  let feat = first('features');
  if (!feat && cfg.kind !== 'pro') { feat = newSection('features', { navLabel: 'Services' }); cfg.sections.splice(Math.min(2, cfg.sections.length - 1), 0, feat); } // every classic site lists what the business does
  if (feat) Object.assign(feat.data, { title: brief.kind === 'portfolio' ? 'What I do' : 'What we offer', items: svc.slice(0, 6).map(([icon, title, text]) => ({ icon, title, text })) });
  const cta = first('cta'); if (cta) Object.assign(cta.data, { title: `Ready to talk to ${name}?`, text: 'Send us a message and we will get back to you quickly.', buttonText: ind.cta });
  const nav = first('navbar'); if (nav) nav.data.ctaText = ind.cta.slice(0, 24);
  const con = first('contact');
  if (con) Object.assign(con.data, { ...(brief.email ? { email: brief.email } : {}), ...(brief.phone ? { phone: brief.phone } : {}), ...(brief.whatsapp ? { whatsapp: brief.whatsapp } : {}), ...(city ? { address: city } : {}) });
  const foot = first('footer'); if (foot) Object.assign(foot.data, { about: `${name}${inCity(city)}. ${ind.hero(name, city)[1]}`.slice(0, 300), copyright: `© ${new Date().getFullYear()} ${name}. All rights reserved.` });

  // never present template placeholders as real
  let hidden = 0;
  for (const s of cfg.sections) if (['testimonials', 'stats', 'pricing', 'team'].includes(s.type) && s.visible) { s.visible = false; hidden++; }
  if (hidden) notes.push('I switched off the reviews, numbers, team and price-table sections, because they contain placeholder text. Switch them on and add your real details when you have them.');

  // pro (shop / booking) sites keep their own settings
  if (cfg.kind === 'pro' && cfg.pro) {
    const p = cfg.pro as Record<string, any>;
    if (p.business) {
      Object.assign(p.business, { name, tag: tagline.slice(0, 120), about: about.slice(0, 1500), mono: name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'YB' });
      if (brief.phone) p.business.phone = brief.phone;
      if (brief.whatsapp) p.business.wa = brief.whatsapp;
      if (brief.email) p.business.email = brief.email;
      if (city) p.business.addr = city;
    }
    if (p.hero?.slides?.[0]) Object.assign(p.hero.slides[0], { t: tagline.slice(0, 100), s: h2.slice(0, 200), cta: ind.cta.slice(0, 24) });
    if (p.services) p.services.items = svc.slice(0, 12).map(([, t, d]) => ({ t, d, p: '' }));
    if (p.about) p.about.stats = [];
    if (p.reviews) p.reviews.items = [];
    if (pal && p.look) Object.assign(p.look, { accent: pal.primary, accent2: pal.secondary });
    notes.push('This is a shop/booking site. Open the editor to add your real products, prices and payment details; any sample items are only examples.');
  }

  const safe = sanitizeConfig(cfg);
  if (!brief.phone && !brief.email && !brief.whatsapp) notes.push('Add a phone number, WhatsApp or email in the Contact section so customers can reach you.');
  notes.push('Pictures are sample photos. Upload your own in the editor.');
  return { templateId: preset.id, templateName: preset.name, name, config: safe, notes };
}
