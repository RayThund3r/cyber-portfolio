// src/utils/chatEngine/glossary.ts
//
// Plain-English definitions for the words visitors actually run into, each with a one-line
// "explain it like I'm five" version. Pure data + a tiny matcher; works with no AI model.
//
// Add a term by copying one entry. `names` are what people type (lowercase); the first is the title.

export interface Term {
  names: string[];
  /** 1-2 sentence plain definition. */
  def: string;
  /** Everyday comparison, shown for "explain ... like I'm five" / "simply". */
  eli5: string;
  /** Optional follow-up the visitor might want. */
  more?: string;
}

export const GLOSSARY: Term[] = [
  { names: ['latency', 'ping', 'lag'], def: 'The delay between doing something and seeing the result — usually how long data takes to travel to a server and back, measured in milliseconds (ms).', eli5: 'It is how long you wait for an echo after you shout. Short wait = fast connection.' },
  { names: ['bandwidth', 'internet speed'], def: 'How much data a connection can carry per second (Mbps). It is capacity, not delay — latency is the delay.', eli5: 'A wider pipe lets more water through at once. Bandwidth is how wide the pipe is.' },
  { names: ['dns', 'domain name system'], def: 'The internet’s phone book: it turns a name like example.com into the numeric address (IP) computers use to find the server.', eli5: 'You say your friend’s name and the phone looks up their number for you.' },
  { names: ['ip address', 'ip'], def: 'A number that identifies a device on a network so data knows where to go. Your home router has a public one; your devices get private ones.', eli5: 'It is your house’s street address, so letters know where to be delivered.' },
  { names: ['vpn', 'virtual private network'], def: 'A service that encrypts your traffic and sends it through another server, hiding what you do from the local network and masking your location from sites.', eli5: 'Like putting your letters in a sealed envelope and posting them from a different town.' },
  { names: ['cache', 'cached'], def: 'A small, fast store of data kept close by so it does not have to be fetched or recalculated each time. Browsers, CPUs and phones all use caches.', eli5: 'Keeping your favourite snack on your desk instead of walking to the kitchen every time.', more: 'If a site looks outdated, clearing the browser cache usually fixes it.' },
  { names: ['ram', 'memory'], def: 'Your device’s short-term working memory: it holds whatever apps and tabs are open right now and is cleared when you power off. More RAM means more things at once without slowing down.', eli5: 'Your desk: the bigger it is, the more things you can work on at the same time.' },
  { names: ['ssd', 'solid state drive', 'solid-state drive'], def: 'Storage built from flash chips with no moving parts. Much faster, quieter and tougher than a hard disk, and the single best upgrade for an old computer.', eli5: 'A bookshelf where any book is grabbed instantly, instead of a librarian walking to find it.' },
  { names: ['hdd', 'hard drive', 'hard disk'], def: 'Storage that uses spinning magnetic platters. Cheap per gigabyte but slower and easier to damage if dropped.', eli5: 'A record player: it has to wait for the right spot to spin under the needle.' },
  { names: ['cpu', 'processor'], def: 'The chip that does the thinking: it runs instructions for the operating system and apps. Cores let it do several jobs at once.', eli5: 'The brain of the computer — it decides what to do next, very fast.' },
  { names: ['gpu', 'graphics card', 'graphics processor'], def: 'A chip specialised for drawing images and doing many simple calculations in parallel — games, video editing, 3D and AI.', eli5: 'A team of thousands of little painters working together while the CPU is one clever artist.' },
  { names: ['motherboard', 'mainboard', 'logic board'], def: 'The main circuit board that connects the CPU, memory, storage and everything else, and gives them power.', eli5: 'The city map and roads that let every building in a computer talk to the others.' },
  { names: ['firmware'], def: 'Small permanent software stored on a device’s own chip that makes the hardware work (routers, phones, SSDs, printers). Updating it can fix bugs and security holes.', eli5: 'The built-in instructions the gadget was born knowing.' },
  { names: ['driver', 'drivers'], def: 'A small program that lets the operating system talk to a piece of hardware like a printer, graphics card or Wi-Fi chip. Wrong or missing drivers cause many “it does not work” problems.', eli5: 'A translator between you and a friend who speaks another language.' },
  { names: ['bios', 'uefi'], def: 'The first software that runs when a PC starts: it checks the hardware and then hands over to Windows or Linux. You can open it at boot to change the boot order or settings.', eli5: 'The morning checklist the computer runs before it starts the day.' },
  { names: ['operating system', 'os'], def: 'The main software that manages the hardware and runs your apps — Windows, macOS, Linux, Android and iOS are operating systems.', eli5: 'The manager that tells every app when it may use the screen, memory and keyboard.' },
  { names: ['malware', 'virus'], def: 'Software made to harm or spy: viruses, ransomware, spyware, trojans. It usually arrives through fake downloads, email attachments or dodgy links.', eli5: 'A pretend-friend program that sneaks in to do naughty things.', more: 'If you suspect it: disconnect from the internet, back up your files, then run a scan or ask for a clean reinstall.' },
  { names: ['phishing'], def: 'Fake emails, messages or sites that pretend to be a bank or service to trick you into giving passwords or money. Check the sender address and never log in through a link you did not expect.', eli5: 'A stranger dressing up as your friend to get your keys.' },
  { names: ['two-factor authentication', '2fa', 'mfa', 'two factor'], def: 'A second proof it is you (a code from an app or SMS) on top of your password, so a stolen password alone is not enough.', eli5: 'The door needs your key AND a secret knock.' },
  { names: ['encryption', 'encrypted'], def: 'Scrambling data with a key so only someone with the key can read it. It protects messages, payments and stored files.', eli5: 'Writing in a secret code that only you and your friend can read.' },
  { names: ['backup', 'backups'], def: 'A separate copy of your files kept somewhere else (another drive or the cloud) so you can recover after a failure, theft or accident. A good rule is 3 copies, 2 kinds of storage, 1 off-site.', eli5: 'Making a photocopy of your homework and keeping it at grandma’s house.' },
  { names: ['cloud', 'cloud storage'], def: 'Using someone else’s servers over the internet to store files or run software instead of your own device — Google Drive, iCloud and Dropbox are examples.', eli5: 'Keeping your toys at a big shared toy library you can visit from anywhere.' },
  { names: ['api'], def: 'A set of rules that lets one program ask another for data or actions — like a weather app asking a weather service for today’s forecast.', eli5: 'A waiter: you tell the waiter what you want, the kitchen does the work, the waiter brings it back.' },
  { names: ['html'], def: 'The language that gives a web page its structure — headings, paragraphs, images, links. Browsers read it to build what you see.', eli5: 'The skeleton of a web page.' },
  { names: ['css'], def: 'The language that styles web pages: colours, fonts, spacing and layout. Tailwind is a popular toolkit built on it.', eli5: 'The clothes and make-up for the skeleton (HTML).' },
  { names: ['javascript', 'js'], def: 'The programming language that makes web pages interactive — menus, animations, forms and apps run in the browser.', eli5: 'The muscles that make the page move.' },
  { names: ['react'], def: 'A JavaScript library for building user interfaces from reusable pieces called components. Next.js builds on it.', eli5: 'Building a website out of LEGO bricks you can reuse.' },
  { names: ['next.js', 'nextjs', 'next js'], def: 'A framework on top of React that adds routing, server rendering and easy deployment (this site uses it).', eli5: 'A ready-made workshop with all the tools set up for building React sites.' },
  { names: ['responsive design', 'responsive'], def: 'Designing a site so the layout adapts to any screen size, from phones to wide monitors, using flexible grids and breakpoints.', eli5: 'Clothes that stretch to fit whoever wears them.' },
  { names: ['ux', 'user experience'], def: 'How a product feels to use: is it easy to find things, understand and finish a task? Good UX removes confusion.', eli5: 'Whether a toy is fun and easy to play with, or frustrating.' },
  { names: ['ui', 'user interface'], def: 'What you see and touch in a product — buttons, colours, text and layout. UI is the look; UX is how it works for people.', eli5: 'The buttons and pictures on the toy.' },
  { names: ['wireframe'], def: 'A simple black-and-white sketch of a page’s layout that shows where things go before any colours or final design.', eli5: 'A pencil drawing of a house plan before you build it.' },
  { names: ['prototype', 'prototyping'], def: 'A clickable mock-up of a design (for example in Figma) that behaves like the real thing so you can test it before development.', eli5: 'A cardboard model of the toy that you can already play with.' },
  { names: ['vector', 'vector graphics', 'svg'], def: 'Images made from mathematical shapes instead of pixels, so they stay perfectly sharp at any size. Logos should be delivered as vectors (SVG, AI, EPS).', eli5: 'A drawing described with instructions (“circle here, line there”) so it never gets blurry.' },
  { names: ['raster', 'bitmap', 'pixel image'], def: 'Images made of a grid of coloured pixels (JPG, PNG, WEBP). They look blurry when enlarged beyond their resolution.', eli5: 'A mosaic of tiny coloured tiles — look too close and you see the tiles.' },
  { names: ['dpi', 'ppi', 'resolution'], def: 'How many dots (or pixels) fit in an inch. 72–96 is fine for screens; 300 is the usual minimum for sharp print.', eli5: 'How many tiny dots are packed into each inch of the picture — more dots, smoother picture.' },
  { names: ['cmyk'], def: 'The four inks printers use (cyan, magenta, yellow, black). Colours are mixed on paper, so print files should be set to CMYK to avoid dull surprises.', eli5: 'Paint colours for paper.' },
  { names: ['rgb'], def: 'Red, green and blue light mixed by screens to make every colour. Use RGB for anything shown on a display.', eli5: 'Colours made by shining three coloured torches together.' },
  { names: ['hex code', 'hex colour', 'hex color'], def: 'A six-character code like #22d3ee that names an RGB colour for web and design tools (two characters each for red, green, blue).', eli5: 'A colour’s secret name tag.' },
  { names: ['kerning'], def: 'Adjusting the space between two particular letters so the text looks evenly spaced (for example between “A” and “V”).', eli5: 'Nudging letters closer or apart so they sit comfortably together.' },
  { names: ['typography', 'typeface', 'font'], def: 'The art of choosing and arranging type so text is readable and has personality. A typeface is the design family; a font is one weight or size of it.', eli5: 'How letters are dressed up to feel serious, friendly or fun.' },
  { names: ['brand identity', 'branding'], def: 'The whole visual and verbal personality of a business — logo, colours, fonts, tone — so people recognise and trust it everywhere.', eli5: 'A company’s face, voice and clothes all matching so you know it is them.' },
  { names: ['seo', 'search engine optimisation', 'search engine optimization'], def: 'Making a site easier for search engines to understand so it shows higher in results: clear content, fast loading, good titles and links.', eli5: 'Putting a clear sign on your shop so people searching can find it.' },
  { names: ['domain name', 'domain'], def: 'A website’s human-friendly address (example.com) that you register yearly and point at your hosting.', eli5: 'The name painted on your shop’s door.' },
  { names: ['hosting', 'web hosting'], def: 'A server that stores your website and serves it to visitors 24/7. Vercel, Netlify and shared hosts are examples.', eli5: 'The plot of land where your shop is built.' },
  { names: ['ssl', 'https', 'tls', 'ssl certificate'], def: 'The padlock in the browser: it encrypts the connection between you and the site so passwords and payments cannot be read in transit.', eli5: 'A private tunnel between you and the shop so nobody listens in.' },
  { names: ['router'], def: 'The box that shares your internet connection with all the devices at home and directs traffic between them and the internet.', eli5: 'A traffic officer at the crossroads sending each car the right way.' },
  { names: ['wifi', 'wi-fi'], def: 'Wireless networking that connects devices to a router with radio waves. Speed drops with distance, walls and crowded channels.', eli5: 'An invisible cable that reaches through the air.' },
  { names: ['bluetooth'], def: 'Short-range wireless for connecting headphones, keyboards and speakers directly to a device, using little power.', eli5: 'A whisper between two gadgets sitting close together.' },
  { names: ['usb-c', 'usb c', 'type-c', 'type c'], def: 'The small oval, reversible connector now used for charging, data and video. Not all USB-C cables are equal — some only charge slowly or carry no video.', eli5: 'A plug that fits whichever way you put it in.' },
  { names: ['thermal paste', 'thermal compound'], def: 'A grey paste between a chip and its cooler that fills microscopic gaps so heat moves out efficiently. It dries out after a few years, causing overheating and fan noise.', eli5: 'Butter between two slices of toast so the warmth passes through evenly.', more: 're-pasting is a standard part of this site’s laptop and PC servicing.' },
  { names: ['overclocking'], def: 'Running a chip faster than its factory speed for extra performance, at the cost of more heat, power and possible instability.', eli5: 'Making a runner sprint faster than normal — quicker, but they tire and get hot.' },
  { names: ['throttling', 'thermal throttling'], def: 'A chip slowing itself down on purpose when it gets too hot to protect itself — the reason a hot laptop or phone suddenly feels sluggish.', eli5: 'When you are too hot you slow down to cool off.' },
  { names: ['mah', 'milliamp hour', 'milliamp-hour'], def: 'A battery’s capacity: bigger mAh usually means longer life between charges (a 5000 mAh phone battery outlasts a 3000 mAh one, all else equal).', eli5: 'The size of the fuel tank.' },
  { names: ['oled'], def: 'A screen where every pixel makes its own light, giving true blacks and rich contrast. Pixels can age or burn in if a static image stays for years.', eli5: 'Every dot is its own tiny lamp that can switch completely off.' },
  { names: ['lcd', 'ips'], def: 'A screen lit by a backlight shining through coloured liquid-crystal pixels. IPS panels give good colour from wide angles.', eli5: 'A window with coloured blinds and one big lamp behind it.' },
  { names: ['pixel', 'pixels'], def: 'The smallest dot of a digital image or screen. A 1920×1080 display has about two million of them.', eli5: 'One tiny square of colour in a big picture.' },
  { names: ['jailbreak', 'rooting', 'root'], def: 'Removing the maker’s restrictions on a phone to gain full control. It can break security, void warranties and cause instability.', eli5: 'Taking the safety cover off a machine: more freedom, more ways to get hurt.' },
  { names: ['factory reset', 'hard reset'], def: 'Erasing a device and returning it to its original state. It fixes many software problems, but removes your data — back up first.', eli5: 'Wiping the whiteboard clean and starting again.' },
  { names: ['partition'], def: 'A section of a drive treated as its own separate disk (for example C: and D:), useful for dual-booting or keeping files apart from the system.', eli5: 'Dividing one big cupboard into separate rooms.' },
  { names: ['bit', 'byte', 'bytes'], def: 'A bit is a single 1 or 0; a byte is 8 bits (one character of text). Kilobyte, megabyte and gigabyte are thousands, millions and billions of bytes.', eli5: 'A bit is one light switch (on/off); a byte is a row of eight of them.' },
  { names: ['pwa', 'progressive web app'], def: 'A website that can be installed to the home screen and work offline like an app, without an app store.', eli5: 'A website wearing an app costume.' },
  { names: ['open source', 'open-source'], def: 'Software whose code is public so anyone can inspect, use and improve it (Linux, Firefox, many web libraries).', eli5: 'A recipe everyone is allowed to read, cook and improve.' },
];

/* ------------------------------------------------------------------ matching */

const flat = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9+.#' -]/g, ' ').replace(/\s+/g, ' ').trim();
const INDEX = new Map<string, Term>();
for (const t of GLOSSARY) for (const n of t.names) INDEX.set(flat(n), t);

export function findTerm(phrase: string): Term | null {
  let p = flat(phrase).replace(/^(the|a|an|my|your)\s+/, '').replace(/\s+(thing|stuff|word|term)$/, '').trim();
  if (!p) return null;
  if (INDEX.has(p)) return INDEX.get(p)!;
  if (p.endsWith('s') && INDEX.has(p.slice(0, -1))) return INDEX.get(p.slice(0, -1))!;
  if (INDEX.has(p + 's')) return INDEX.get(p + 's')!;
  return null;
}

export interface TermQuery {
  term: Term;
  simple: boolean;
  /** true for an explicit "define / what does X mean / explain" form (vs a plain "what is X"). */
  explicit: boolean;
}

const ELI5 = /\b(?:like (?:i'?m|i am|im) (?:5|five|a kid|a child|stupid|new)|eli5|for (?:a )?(?:beginners?|kids?|dummies)|in (?:simple|plain|easy) (?:terms|words|english)|simply|in layman'?s terms|in layman terms|for a child)\b/;

export function tryGlossary(input: string, allowBare = false): TermQuery | null {
  const s = flat(input).replace(/[?!.]+$/g, '');
  if (!s || s.length > 100) return null;
  const simple = ELI5.test(s);
  const stripped = s.replace(ELI5, ' ').replace(/\s+/g, ' ').trim();
  let m: RegExpExecArray | null;
  if (
    (m = /^(?:please |pls )?(?:define|definition of|meaning of|what does (.+) mean|explain|eli5|describe|tell me about|what'?s the meaning of|what is the meaning of)\b ?(.*)$/.exec(stripped))
  ) {
    const phrase = (m[1] || m[2] || '').replace(/^(?:what is|what's|what are|to me|the meaning of|me)\s+/, '').trim();
    const t = findTerm(phrase);
    if (t) return { term: t, simple, explicit: true };
  }
  if ((m = /^(.+?) (?:meaning|definition)$/.exec(stripped))) {
    const t = findTerm(m[1]);
    if (t) return { term: t, simple, explicit: true };
  }
  if ((m = /^(?:what is|what's|whats|what are|who is) (.+)$/.exec(stripped))) {
    const t = findTerm(m[1]);
    if (t && (simple || allowBare)) return { term: t, simple, explicit: false };
  }
  if (simple) {
    const t = findTerm(stripped.replace(/^(?:explain|what is|what's|what are|tell me about)\s+/, ''));
    if (t) return { term: t, simple, explicit: true };
  }
  return null;
}

export function termReply(q: TermQuery): { human: string; expert: string; suggestions: string[] } {
  const title = q.term.names[0].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(Ssd|Hdd|Cpu|Gpu|Ram|Dns|Ip|Vpn|Api|Html|Css|Ux|Ui|Seo|Ssl|Cmyk|Rgb|Dpi|Oled|Lcd|Bios|Os|Pwa|Mah|Svg)\b/g, (x) => x.toUpperCase());
  const lines = [`**${title}**`, q.term.def];
  if (q.simple) lines.push(`🧒 In simple terms: ${q.term.eli5}`);
  else lines.push(`💡 Like this: ${q.term.eli5}`);
  if (q.term.more) lines.push(q.term.more[0].toUpperCase() + q.term.more.slice(1));
  return {
    human: lines.join('\n\n'),
    expert: `DEFINE // ${title}: ${q.term.def}`,
    suggestions: q.simple ? ['More detail', 'Explain another term'] : ['Explain it simply', 'Explain another term'],
  };
}
