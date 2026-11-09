// src/utils/chatEngine/compare.ts
//
// "X vs Y" answered as a short side-by-side table plus a plain verdict ("SSD vs HDD", "PNG or JPG",
// "difference between UI and UX", "is OLED better than LCD"). Works with no AI model.
// A question only matches when BOTH sides are things listed here, so ordinary sentences with "or"
// in them are never hijacked.

interface Side {
  name: string;
  /** lowercase phrases people type for this side */
  al: string[];
}
interface Comparison {
  a: Side;
  b: Side;
  rows: Array<[label: string, a: string, b: string]>;
  verdict: string;
  /** Optional hand-off to a site service. */
  tip?: string;
}

const S = (name: string, ...al: string[]): Side => ({ name, al: [name.toLowerCase(), ...al] });

export const COMPARISONS: Comparison[] = [
  {
    a: S('SSD', 'solid state', 'solid-state', 'solid state drive'),
    b: S('HDD', 'hard drive', 'hard disk', 'hard disk drive', 'spinning drive'),
    rows: [
      ['Speed', 'Very fast: boots in seconds', 'Slow: minutes to load a busy PC'],
      ['Durability', 'No moving parts, survives knocks', 'Moving platters, fragile if dropped'],
      ['Noise / heat', 'Silent, cool', 'Audible, warmer'],
      ['Price per GB', 'Higher', 'Much lower'],
      ['Best for', 'System drive, apps, laptops', 'Bulk storage and backups'],
    ],
    verdict: 'Use an SSD for the system and apps; keep an HDD only for cheap bulk storage. Swapping an old PC’s HDD for an SSD is the biggest speed-up per shilling.',
  },
  {
    a: S('Laptop'),
    b: S('Desktop', 'desktop pc', 'pc tower', 'tower pc'),
    rows: [
      ['Portability', 'Take it anywhere', 'Fixed in one place'],
      ['Power for the price', 'Lower', 'Higher'],
      ['Upgrades', 'Limited (RAM/SSD usually)', 'Almost everything can be swapped'],
      ['Repairs', 'Compact, parts can be model-specific', 'Easier and cheaper to fix'],
      ['Cooling', 'Tight, dust and heat build up', 'Roomy, runs cooler'],
    ],
    verdict: 'Laptop if you move around; desktop if you work in one spot and want the most power and the easiest upgrades.',
  },
  {
    a: S('Android', 'android phone'),
    b: S('iPhone', 'ios', 'apple phone', 'iphone ios'),
    rows: [
      ['Choice', 'Hundreds of models and prices', 'A few models, all premium-ish'],
      ['Updates', 'Varies by brand', 'Long, consistent support'],
      ['Customising', 'Very flexible', 'More restricted, very polished'],
      ['Repair cost', 'Depends on brand, usually cheaper parts', 'Parts are pricier but widely available'],
      ['Resale value', 'Drops faster', 'Holds value better'],
    ],
    verdict: 'Neither is “better”. Android wins on choice and price; iPhone on long support and resale. Pick the one your apps and budget fit.',
  },
  {
    a: S('Windows', 'windows pc', 'windows 11', 'windows 10'),
    b: S('macOS', 'mac', 'macbook', 'mac os', 'apple mac'),
    rows: [
      ['Hardware choice', 'Huge range, every price', 'Apple machines only'],
      ['Software', 'Widest app and game support', 'Strong for creative work, fewer games'],
      ['Repair / upgrades', 'Usually easier and cheaper', 'Often soldered and costly'],
      ['Out of the box', 'Needs more upkeep', 'Very polished, long battery life'],
    ],
    verdict: 'Windows for variety, games and cost control; Mac if you like a polished creative workflow and do not need to upgrade or repair often.',
  },
  {
    a: S('Intel', 'intel cpu', 'intel processor'),
    b: S('AMD', 'amd cpu', 'ryzen', 'amd processor'),
    rows: [
      ['Value', 'Competitive; varies by generation', 'Often strong value per core'],
      ['Efficiency', 'Improving; depends on the chip', 'Usually very efficient'],
      ['Integrated graphics', 'Solid on newer chips', 'Strong on recent Ryzen'],
    ],
    verdict: 'It changes with each generation, so compare the specific models and prices rather than the brand.',
  },
  {
    a: S('DDR4', 'ddr 4'),
    b: S('DDR5', 'ddr 5'),
    rows: [
      ['Speed', 'Slower', 'Faster'],
      ['Price', 'Cheaper', 'Costlier'],
      ['Compatibility', 'Older platforms', 'Newer platforms only (not interchangeable)'],
    ],
    verdict: 'They are not interchangeable: your motherboard decides which one you can use. Buy whatever it supports.',
  },
  {
    a: S('USB-C', 'usb c', 'type-c', 'type c', 'usbc'),
    b: S('Lightning', 'lightning cable', 'apple lightning'),
    rows: [
      ['Shape', 'Oval, reversible', 'Small, reversible, Apple only'],
      ['Used by', 'Android, laptops, newer iPhones', 'Older iPhones and some accessories'],
      ['Speed', 'Can be much faster', 'Fixed, slower data'],
    ],
    verdict: 'USB-C is the universal standard; Lightning is only for older Apple devices.',
  },
  {
    a: S('PNG'),
    b: S('JPG', 'jpeg'),
    rows: [
      ['Quality', 'Lossless, sharp edges and text', 'Lossy, small artefacts'],
      ['Transparency', 'Yes', 'No'],
      ['File size', 'Larger', 'Smaller'],
      ['Best for', 'Logos, screenshots, graphics', 'Photos'],
    ],
    verdict: 'PNG for logos and graphics with sharp edges or transparency; JPG for photos where small files matter.',
  },
  {
    a: S('SVG', 'svg file'),
    b: S('PNG', 'png file'),
    rows: [
      ['Type', 'Vector, shapes defined by maths', 'Raster, a grid of pixels'],
      ['Scaling', 'Perfect at any size', 'Blurs when enlarged'],
      ['Best for', 'Logos, icons, illustrations', 'Screenshots, detailed images'],
    ],
    verdict: 'Keep your logo as SVG (plus a PNG for places that need it) so it never goes blurry.',
  },
  {
    a: S('Vector', 'vector graphics', 'vectors'),
    b: S('Raster', 'bitmap', 'raster graphics', 'pixel art', 'pixels'),
    rows: [
      ['Made of', 'Paths and shapes', 'Pixels'],
      ['Scaling', 'Infinite, always sharp', 'Loses quality when enlarged'],
      ['Tools', 'Illustrator, Figma, Inkscape', 'Photoshop, Procreate'],
      ['Best for', 'Logos, signage, embroidery artwork', 'Photos and painted art'],
    ],
    verdict: 'Logos and anything printed large should start as vector. Photos are raster by nature.',
  },
  {
    a: S('Illustrator', 'adobe illustrator'),
    b: S('Photoshop', 'adobe photoshop'),
    rows: [
      ['Works with', 'Vectors', 'Pixels / photos'],
      ['Use it for', 'Logos, icons, posters with crisp type', 'Photo editing, retouching, textures'],
    ],
    verdict: 'Illustrator for logos and layouts; Photoshop for photo work. Most brand jobs use both.',
  },
  {
    a: S('CMYK'),
    b: S('RGB'),
    rows: [
      ['Used for', 'Print', 'Screens'],
      ['Colour made by', 'Mixing inks on paper', 'Mixing light'],
      ['Gamut', 'Narrower, duller brights', 'Wider, glowing brights'],
    ],
    verdict: 'Design in RGB for screens and convert to CMYK for print so you can check the colours before they reach the press.',
  },
  {
    a: S('OLED', 'amoled'),
    b: S('LCD', 'ips', 'ips lcd', 'led screen'),
    rows: [
      ['Blacks / contrast', 'Perfect blacks, rich contrast', 'Greyer blacks'],
      ['Brightness', 'Great, can dim at max', 'Often brighter'],
      ['Lifespan', 'Pixels can age / burn in', 'Very stable'],
      ['Repair cost', 'Usually higher', 'Usually lower'],
    ],
    verdict: 'OLED for the best picture; LCD if you want cheaper repairs and no burn-in worries.',
  },
  {
    a: S('Wi-Fi', 'wifi', 'wireless'),
    b: S('Ethernet', 'lan cable', 'wired', 'network cable'),
    rows: [
      ['Speed and stability', 'Good, drops with distance and walls', 'Fastest and steadiest'],
      ['Latency', 'Higher, varies', 'Low and consistent'],
      ['Convenience', 'No cables', 'Needs a cable run'],
    ],
    verdict: 'Use Ethernet for desktops, consoles and video calls where stability matters; Wi-Fi for everything mobile.',
  },
  {
    a: S('4G', 'lte', '4g lte'),
    b: S('5G'),
    rows: [
      ['Speed', 'Fast', 'Faster where available'],
      ['Coverage', 'Widespread', 'Still limited in many areas'],
      ['Battery', 'Lighter on battery', 'Can use more power'],
    ],
    verdict: 'Coverage matters more than the label. 5G only helps where your network actually offers it.',
  },
  {
    a: S('OEM screen', 'original screen', 'original part', 'oem', 'genuine part', 'original'),
    b: S('Aftermarket screen', 'copy screen', 'aftermarket', 'compatible screen', 'copy', 'generic part', 'duplicate'),
    rows: [
      ['Picture and touch', 'Matches the original', 'Varies: can be dimmer or less responsive'],
      ['Price', 'Higher', 'Lower'],
      ['Durability', 'Best', 'Depends on the grade'],
      ['Special features', 'Face ID / true tone / in-display sensors usually work', 'May lose some features'],
    ],
    verdict: 'If the phone matters to you (or has in-screen sensors), original-quality is worth it. A good aftermarket part is fine for older, lower-cost phones.',
    tip: 'The owner can tell you which grade is available for your model when quoting.',
  },
  {
    a: S('WordPress', 'wordpress site', 'wix', 'squarespace', 'website builder'),
    b: S('Custom website', 'custom site', 'next.js', 'nextjs', 'custom code', 'coded website', 'react site', 'custom built'),
    rows: [
      ['Speed to launch', 'Fast with templates', 'Slower, built to fit'],
      ['Performance', 'Depends on plugins and theme', 'Very fast when built well'],
      ['Uniqueness', 'Template look unless customised heavily', 'Exactly what you design'],
      ['Editing content', 'Easy for non-coders', 'Needs a CMS or developer help'],
      ['Running cost', 'Plugin and hosting upkeep', 'Low hosting, development cost up front'],
    ],
    verdict: 'A builder for a quick simple site; custom for speed, a distinctive look and full control.',
  },
  {
    a: S('Logo', 'a logo', 'logo design'),
    b: S('Brand identity', 'branding', 'brand', 'brand design', 'brand package'),
    rows: [
      ['What it is', 'One mark that represents you', 'The whole system: logo, colours, fonts, tone'],
      ['Deliverables', 'Logo files (vector + PNG)', 'Logo, palette, typography, guidelines, assets'],
      ['Best for', 'A quick, clean start', 'A business that wants to look consistent everywhere'],
    ],
    verdict: 'A logo is one piece of a brand identity. Start with the logo if the budget is tight and grow into the full identity.',
  },
  {
    a: S('UI', 'user interface', 'ui design'),
    b: S('UX', 'user experience', 'ux design'),
    rows: [
      ['Focus', 'How it looks', 'How it works and feels'],
      ['Deals with', 'Colours, type, buttons, layout', 'Flows, structure, ease of use'],
      ['Question it answers', '“Is it clear and attractive?”', '“Can people do what they came to do?”'],
    ],
    verdict: 'Both matter: UX decides if the product makes sense, UI makes it feel good.',
  },
  {
    a: S('Cloud backup', 'cloud', 'online backup', 'google drive', 'icloud'),
    b: S('Local backup', 'external drive', 'external hard drive', 'usb drive', 'offline backup'),
    rows: [
      ['Access', 'From anywhere with internet', 'Only where the drive is'],
      ['Cost', 'Subscription for large space', 'One-time drive purchase'],
      ['Risk', 'Account or connection problems', 'Theft, fire, drive failure'],
    ],
    verdict: 'Use both: a local copy for speed and a cloud copy for safety (the 3-2-1 rule).',
  },
  {
    a: S('Repair', 'repair it', 'fix it', 'fix'),
    b: S('Replace', 'replace it', 'buy new', 'new one', 'new phone', 'new laptop', 'upgrade'),
    rows: [
      ['Up-front cost', 'Usually lower', 'Higher'],
      ['Best when', 'Fault is a known part (screen, battery, port)', 'Device is very old or several things fail'],
      ['Data', 'Stays on the device', 'Needs transferring'],
    ],
    verdict: 'If one part is failing and the device is otherwise healthy, repair. If it is old and failing in several ways, replace. I can walk you through a quick repair-or-replace check.',
    tip: 'Say “repair or replace” and I will ask a few quick questions.',
  },
];

/* ------------------------------------------------------------------ matching */

const flat = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9+.# '-]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (phrase: string, alias: string) => {
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(phrase);
};
const sideMatches = (side: Side, phrase: string) => side.al.some((a) => has(phrase, a));
/** The shorter an alias that matched, the weaker the match: prefer the entry with the longest matching alias. */
const strength = (side: Side, phrase: string) => Math.max(0, ...side.al.filter((a) => has(phrase, a)).map((a) => a.length));

function findComparison(x: string, y: string): Comparison | null {
  const px = flat(x), py = flat(y);
  let best: { c: Comparison; score: number } | null = null;
  for (const c of COMPARISONS) {
    const fwd = sideMatches(c.a, px) && sideMatches(c.b, py);
    const rev = sideMatches(c.a, py) && sideMatches(c.b, px);
    if (!fwd && !rev) continue;
    const score = fwd ? strength(c.a, px) + strength(c.b, py) : strength(c.a, py) + strength(c.b, px);
    if (!best || score > best.score) best = { c, score };
  }
  return best ? best.c : null;
}

function splitSides(s: string): [string, string] | null {
  let m: RegExpExecArray | null;
  if ((m = /^(?:what(?:'s| is| are) the )?(?:differences?|distinction) between (.+?) and (.+)$/.exec(s))) return [m[1], m[2]];
  if ((m = /^(?:which is better|which one is better|which is best|which should i (?:get|choose|pick|use|buy)),? (.+?) (?:or|vs\.?|versus) (.+)$/.exec(s))) return [m[1], m[2]];
  if ((m = /^(?:should i (?:get|choose|pick|use|buy|go for)|is it (?:better|worth) to (?:get|use|buy)) (.+?) (?:or|vs\.?|versus) (.+)$/.exec(s))) return [m[1], m[2]];
  if ((m = /^is (.+?) better than (.+)$/.exec(s))) return [m[1], m[2]];
  if ((m = /^compare (.+?) (?:and|with|to|vs\.?|versus) (.+)$/.exec(s))) return [m[1], m[2]];
  if ((m = /^(.+?) (?:vs\.?|versus|compared (?:to|with)|against) (.+?)(?: (?:which|what).*| comparison| difference)?$/.exec(s))) return [m[1], m[2]];
  if ((m = /^(.+?) or (.+?)(?:,? which(?: one)?(?: is| one is)? (?:better|best|faster|cheaper))?$/.exec(s))) return [m[1], m[2]];
  return null;
}

export interface CompareAnswer {
  human: string;
  expert: string;
  suggestions: string[];
}

export function tryCompare(input: string): CompareAnswer | null {
  const s = flat(input).replace(/[?!.]+$/g, '');
  if (!s || s.length > 120) return null;
  const sides = splitSides(s);
  if (!sides) return null;
  const c = findComparison(sides[0], sides[1]);
  if (!c) return null;
  const aFirst = sideMatches(c.a, flat(sides[0])) && sideMatches(c.b, flat(sides[1]));
  const [A, B] = aFirst ? [c.a, c.b] : [c.b, c.a];
  const rows = c.rows.map(([label, a, b]) => (aFirst ? [label, a, b] : [label, b, a]));
  const table = [`| | ${A.name} | ${B.name} |`, '|---|---|---|', ...rows.map(([l, a, b]) => `| **${l}** | ${a} | ${b} |`)].join('\n');
  return {
    human: `**${A.name} vs ${B.name}**\n\n${table}\n\n**Bottom line:** ${c.verdict}${c.tip ? `\n\n${c.tip}` : ''}`,
    expert: `COMPARE // ${A.name} vs ${B.name}\n${rows.map(([l, a, b]) => `- ${l}: ${A.name}=${a} | ${B.name}=${b}`).join('\n')}\nVERDICT // ${c.verdict}`,
    suggestions: ['Which is better for me?', 'Get a quote', 'Show me your services'],
  };
}

/** Recover the comparison behind a previous answer ("**SSD vs HDD** ...") so follow-ups like "which is better for me?" can reason about it. */
export function comparisonFromAnswer(text: string): { a: string; b: string; rows: Array<[string, string, string]>; verdict: string; tip?: string } | null {
  const m = /\*\*([^*|]+?) vs ([^*|]+?)\*\*/.exec(text || '');
  if (!m) return null;
  const an = m[1].trim().toLowerCase();
  const bn = m[2].trim().toLowerCase();
  for (const c of COMPARISONS) {
    const x = c.a.name.toLowerCase();
    const y = c.b.name.toLowerCase();
    if (x === an && y === bn) return { a: c.a.name, b: c.b.name, rows: c.rows, verdict: c.verdict, tip: c.tip };
    if (x === bn && y === an) return { a: c.b.name, b: c.a.name, rows: c.rows.map(([l, p, q]) => [l, q, p] as [string, string, string]), verdict: c.verdict, tip: c.tip };
  }
  return null;
}
