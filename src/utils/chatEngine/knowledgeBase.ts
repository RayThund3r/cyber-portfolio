// src/utils/chatEngine/knowledgeBase.ts
//
// Each entry has:
//   keywords / title / content -> used by the retriever to find the right entry (typo tolerant)
//   content                    -> plain facts, handed to the AI model as grounding
//   reply / expert             -> canned answers used when no AI model is running
//
// Add entries freely: the retriever picks them up automatically.

import { KnowledgeEntry } from './types';
import { SITE } from './siteConfig';
import { SERVICES } from '@/data/servicesData';
import { TECH_FACTS } from './techFacts';

const TIME = (i: number) => SERVICES[i]?.timeline || 'agreed per job';

const contactLine = [
  SITE.whatsapp && `WhatsApp: ${SITE.whatsapp}`,
  SITE.email && `Email: ${SITE.email}`,
  SITE.hours && `Hours: ${SITE.hours}`,
]
  .filter(Boolean)
  .join(' | ');

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'about',
    domain: 'PORTFOLIO',
    title: 'About and services overview',
    keywords: ['about', 'who', 'services', 'offer', 'portfolio', 'skills', 'specialty', 'what you do', 'experience'],
    content: `Services: ${SITE.services.join('; ')}. Based in ${SITE.location}.`,
    reply:
      "I'm a hardware repair technician, designer and web developer. In short:\n- **Repairs:** phones and PCs, from screens and batteries to board-level faults\n- **Design:** logos, branding, posters, UI/UX, plus embroidery and fabric-print files\n- **Web:** Next.js / React / Tailwind sites\n\nWhich of these do you need?",
    expert:
      'SYS_PROFILE // Modules: [HARDWARE_REPAIR] [DESIGN_BRANDING] [WEB_ENGINEERING] [EMBROIDERY_PRINT_PREP]. Specify module.',
    suggestions: ['Repair services', 'Design services', 'Web development', 'Get a quote'],
  },
  {
    id: 'phone-repair',
    domain: 'HARDWARE_REPAIR',
    title: 'Phone repair',
    keywords: ['phone', 'mobile', 'smartphone', 'android', 'iphone', 'tecno', 'infinix', 'samsung', 'handset', 'cell phone', 'cracked', 'shattered', 'smashed', 'broken screen', 'screen replacement', 'charging port', 'battery replacement', 'water damage', 'repair'],
    content:
      'Phone repair covers cracked or dead screens, battery replacement, charging port faults, water damage cleanup, software faults and board-level repair. The technician needs the phone model and the exact symptom to diagnose.',
    reply:
      "I repair phones: cracked or dead screens, batteries that drain fast, charging port faults, water damage and board-level problems. 📱\n\nTell me the **model** and **what exactly is happening** (won't charge, no display, restarts...) and I'll point you in the right direction.",
    expert:
      'SYS_MOBILE_REPAIR // Scope: display assembly, battery cell, charge IC/port, liquid ingress cleanup, board-level faults. Provide: model + symptom + recent events (drop/water).',
    suggestions: ['Screen is cracked', "Phone won't charge", 'Battery drains fast', 'Get a quote'],
  },
  {
    id: 'pc-repair',
    domain: 'HARDWARE_REPAIR',
    title: 'PC and laptop repair',
    keywords: ['pc', 'laptop', 'computer', 'desktop', 'motherboard', 'keyboard', 'hinge', 'ram', 'ssd', 'hdd', 'hard drive', 'upgrade', 'windows', 'reinstall', 'notebook', 'macbook', 'chromebook', 'data recovery', 'repair'],
    content:
      'PC and laptop service: diagnostics, screen/keyboard/battery replacement, RAM and SSD upgrades, OS reinstall, malware removal, thermal service, motherboard-level repair and data recovery attempts.',
    reply:
      "For PCs and laptops I do diagnostics, screen/keyboard/battery replacement, RAM & SSD upgrades, OS reinstalls, virus removal, cooling service and motherboard-level repair. 💻\n\nWhat's the make/model and what is it doing?",
    expert:
      'SYS_PC_SERVICE // Scope: POST/boot diagnostics, rail tracing, RAM/SSD upgrades, OS recovery, thermal service, data recovery. Provide: model + symptom + OS.',
    suggestions: ['Laptop won\'t turn on', 'PC is slow', 'Overheating', 'Data recovery'],
  },
  {
    id: 'no-power',
    domain: 'HARDWARE_REPAIR',
    title: "Device won't turn on or charge",
    keywords: ["won't turn on", 'wont turn on', 'dead', 'no power', 'not charging', "won't charge", 'wont charge', 'not turning on', 'black screen', 'stuck on logo', 'boot loop', 'no display', 'shuts down', 'restarts'],
    content:
      "Won't power on: check the charger and cable on another device, try a different outlet, hold power 15-30 seconds, remove external devices, and for laptops try without the battery if removable. If still dead it is usually a charge circuit, battery, or board fault that needs bench diagnosis. Do not keep forcing charge on a swollen battery.",
    reply:
      "Dead or not charging? Quick checks first:\n1. Try a **different charger/cable** (and another outlet)\n2. Hold the power button **15–30 seconds** to reset\n3. Unplug USB devices; on laptops, remove the battery if it's removable\n\nIf it's still dead, it's usually the battery, charge circuit or board and needs a bench check. If the battery looks **swollen**, stop charging it. What's the model?",
    expert:
      'SYS_POWER_DIAG // 1) Validate charger/cable on known-good unit. 2) Hard reset (15-30s). 3) Isolate peripherals. 4) If no response: measure charge rail/battery voltage; suspect charge IC, battery, or short on main rail. WARNING: swollen cell = disconnect immediately.',
    suggestions: ['Battery looks swollen', 'Book a repair', 'Get a quote'],
  },
  {
    id: 'overheating',
    domain: 'HARDWARE_REPAIR',
    title: 'Overheating and fan noise',
    keywords: ['hot', 'overheat', 'overheating', 'thermal', 'fan', 'loud fan', 'throttling', 'heat', 'temperature', 'cooling', 'thermal paste'],
    content:
      'Overheating is commonly dried thermal paste, clogged vents/dust, failing fan, blocked airflow (using laptop on soft surfaces), or heavy background load. Fixes: clean vents and fans, replace thermal paste/pads, use a hard surface or cooling pad, check Task Manager for runaway processes.',
    reply:
      "Running hot is usually **dried thermal paste, dust-clogged vents/fans**, blocked airflow (laptop on a bed/sofa), or something hammering the CPU in the background. 🔥\n\nQuick wins: use it on a hard surface, check Task Manager for runaway processes, and don't ignore it — heat shortens component life. A proper clean + fresh thermal paste usually fixes it. Desktop or laptop?",
    expert:
      'SYS_THERMAL_DIAG // Likely: TIM degradation, intake/heatsink fouling, fan bearing wear, airflow obstruction, runaway process. Action: inspect temps under load, service cooler, repaste CPU/GPU, verify fan curve.',
    suggestions: ['It is a laptop', 'It is a desktop', 'Book a cleaning'],
    image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'slow-pc',
    domain: 'HARDWARE_REPAIR',
    title: 'Slow or laggy computer',
    keywords: ['slow', 'lag', 'laggy', 'freeze', 'freezing', 'hang', 'hanging', 'takes long', 'performance', 'startup', 'bloat', 'speed up', 'blue screen', 'bsod'],
    content:
      'Slow PC causes: old HDD instead of SSD, low RAM, too many startup apps, malware, full disk, overheating, failing drive. Fixes: upgrade to SSD, add RAM, disable startup apps, free disk space, scan for malware, check drive health (SMART).',
    reply:
      "A slow PC is most often one of these: **an old hard drive (swap to an SSD — biggest upgrade)**, too little RAM, too many startup apps, a nearly full disk, malware, or heat.\n\nTry: disable startup apps (Task Manager → Startup), free up disk space, and run a malware scan. If it's still sluggish, an SSD/RAM upgrade is usually the answer. What are the specs?",
    expert:
      'SYS_PERF_DIAG // Check: disk type + SMART health, RAM pressure, startup load, thermals, malware. Highest-impact fix: HDD->SSD, then RAM to >=8GB.',
    suggestions: ['Upgrade to SSD', 'Remove viruses', 'Book a check-up'],
  },
  {
    id: 'gaming-pc',
    domain: 'HARDWARE_REPAIR',
    title: 'Gaming PC advice and builds',
    keywords: ['gaming', 'gaming pc', 'build', 'custom pc', 'gpu', 'graphics card', 'cpu', 'processor', 'rtx', 'radeon', 'best pc', 'pc purchase', 'which laptop', 'recommend'],
    content:
      'General gaming PC advice: spend most of the budget on the GPU, pair it with a balanced modern CPU, use an NVMe SSD, 16GB RAM minimum (dual channel), a quality power supply from a reputable brand, and good airflow. Avoid bottlenecks and cheap unbranded PSUs. Prices vary, so confirm current availability and budget with the technician.',
    reply:
      "For a gaming PC the sweet spot is: **put most of the budget into the GPU**, pair it with a balanced modern CPU, use an **NVMe SSD**, **16GB RAM** (two sticks), a **quality branded PSU**, and a case with good airflow. Skip no-name power supplies — they're the part that can take other parts with them. 🎮\n\nWhat's your budget and what games do you play? I can suggest a balanced setup.",
    expert:
      'SYS_BUILD_ADVISOR // Priority: GPU > CPU balance > NVMe > 16GB dual-channel RAM > certified PSU > airflow. Provide: budget, target resolution/FPS, titles.',
    suggestions: ['Budget build', 'Upgrade my current PC', 'Get a quote'],
  },
  {
    id: 'data-recovery',
    domain: 'HARDWARE_REPAIR',
    title: 'Data recovery and backups',
    keywords: ['data recovery', 'recover', 'recover data', 'recover files', 'lost files', 'lost data', 'dead hard drive', 'dead drive', 'dead disk', 'failed drive', 'deleted', 'backup', 'photos', 'corrupted', 'formatted', 'clicking drive'],
    content:
      'If a drive is clicking, stop using it immediately. For deleted files stop writing to the disk. Recovery success depends on damage; physical failure may not be recoverable. Backups: keep 3 copies, 2 media types, 1 offsite.',
    reply:
      "Lost files? **Stop using the device** right now — every write lowers the chance of recovery. If a drive is clicking or not detected, power it off. I can attempt recovery depending on the damage (no guarantees on physically failed drives). And once sorted: keep a backup in two places.",
    expert:
      'SYS_RECOVERY // Cease writes. Image the drive before any repair attempt. Physical failure (clicking/undetected) -> power down. Success probability depends on damage class.',
    suggestions: ['Drive is clicking', 'Deleted by mistake', 'Get a quote'],
  },
  {
    id: 'design',
    domain: 'DESIGN_BRANDING',
    title: 'Graphic and brand design',
    keywords: ['design', 'logo', 'brand', 'branding', 'identity', 'graphic', 'poster', 'flyer', 'banner', 'business card', 'photoshop', 'illustrator', 'vector', 'canva', 'social media'],
    content:
      'Design services: logos, brand identity (colors, typography, guidelines), posters, flyers, business cards, social media graphics. Tools: Adobe Photoshop, Illustrator, Figma. Deliverables include scalable vector files plus print-ready exports.',
    reply:
      "I design logos, full brand identities, posters, flyers, business cards and social graphics using Photoshop, Illustrator and Figma. 🎨 You get **scalable vector files** and print-ready exports.\n\nWhat's the business or project, and do you already have colours or a style in mind?",
    expert:
      'DESIGN_ENGINE // Deliverables: SVG/AI vector masters, PNG/PDF print exports, brand guidelines. Toolchain: Illustrator, Photoshop, Figma.',
    suggestions: ['I need a logo', 'Brand identity', 'Poster / flyer', 'Get a quote'],
  },
  {
    id: 'embroidery',
    domain: 'DESIGN_BRANDING',
    title: 'Embroidery and fabric print prep',
    keywords: ['embroidery', 'embroider', 'fabric', 'print', 'printing', 'dst', 'pes', 'name list', 'uniform', 'jersey', 'tshirt', 't-shirt', 'stitch', 'digitizing', 'digitising'],
    content:
      'Embroidery and fabric print preparation: converting artwork into machine-ready formats (DST, PES), formatting name lists for batch embroidery/printing, cleaning and vectorising logos so they stitch or print cleanly at small sizes.',
    reply:
      "I prepare artwork and name lists for **embroidery and fabric printing**: cleaning/vectorising logos, setting them up for small sizes, and exporting machine formats like **DST/PES**. Great for uniforms, jerseys and branded wear. 🧵\n\nWhat machine or format does your printer/embroiderer need?",
    expert:
      'EMB_PREP // Pipeline: vectorise -> simplify for stitch density -> export DST/PES; batch name-list formatting for print/embroidery. Provide: target machine, garment, size.',
    suggestions: ['Name list formatting', 'Digitise my logo', 'Get a quote'],
  },
  {
    id: 'web-dev',
    domain: 'WEB_DEV',
    title: 'Web development',
    keywords: ['website', 'web', 'web app', 'next.js', 'nextjs', 'react', 'tailwind', 'frontend', 'landing page', 'portfolio site', 'ecommerce', 'online shop', 'seo', 'hosting', 'domain', 'code', 'developer', 'framer'],
    content:
      'Web development with Next.js, React, TypeScript, Tailwind CSS and Framer Motion: portfolio sites, business sites, landing pages, dashboards and small web apps; responsive design, SEO basics, and deployment help.',
    reply:
      "I build fast, responsive sites with **Next.js, React, TypeScript and Tailwind** (with Framer Motion for polish): business sites, portfolios, landing pages, dashboards and small web apps. 🌐\n\nWhat do you want the site to do, and do you have a deadline or reference sites you like?",
    expert:
      'WEB_ENGINEERING // Stack: Next.js, React, TS, Tailwind, Framer Motion. Output: responsive SSR/SSG apps, SEO baseline, deploy pipeline.',
    suggestions: ['Business website', 'Portfolio website', 'Web app', 'Get a quote'],
  },
  {
    id: 'computer-types',
    domain: 'GENERAL_QA',
    title: 'Types of computers',
    keywords: ['examples of computers', 'types of computers', 'kinds of computers', 'categories of computers', 'computer categories', 'what are the types of computer'],
    content:
      'Main categories of computers: personal computers (desktops and laptops), mobile devices (smartphones and tablets, ARM based), servers and cloud nodes, workstations for 3D/video/CAD work, and embedded systems (microcontrollers in appliances, cars and IoT).',
    reply:
      "Here are the main categories of computers used today:\n\n1. **Personal Computers (PCs):** Desktops and laptops (macOS, Windows, Linux) for daily productivity and gaming.\n2. **Mobile Devices:** Smartphones and tablets powered by ARM architectures.\n3. **Servers & Cloud Nodes:** High-performance infrastructure hosting databases and APIs.\n4. **Workstations:** Systems built for heavy 3D rendering, video editing, or CAD.\n5. **Embedded Systems:** Microcontrollers operating smart appliances, automotive modules, and IoT tech.",
    expert:
      'SYS_TAXONOMY // Classes: [1. PC: desktop/laptop] [2. Mobile: ARM smartphones/tablets] [3. Server/cloud nodes] [4. Workstations: render/CAD] [5. Embedded: MCU/IoT/automotive].',
    suggestions: ['Fix my computer', 'Upgrade my PC', 'Gaming PC advice'],
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'this-site',
    domain: 'PORTFOLIO',
    title: 'About this website',
    keywords: ['this site', 'this website', 'this portfolio', 'how was this built', 'built with', 'made with', 'tech stack', 'stack', 'framer motion', 'theme', 'archive', 'projects page'],
    content:
      'This portfolio is built with Next.js, Tailwind CSS and Framer Motion, with a custom cyber-industrial look, switchable colour themes, and a built-in chat assistant. It highlights dual expertise as a hardware repair technician and multi-disciplinary designer, with a project archive showing technical builds.',
    reply:
      "This portfolio highlights my dual expertise as a **hardware repair technician** and **multi-disciplinary designer**. It's built with **Next.js, Tailwind CSS and Framer Motion**, with switchable colour themes and this chat assistant. You can explore the project archive to see detailed breakdowns of my technical builds — want me to scroll you there?",
    expert:
      'SYS_ARCH // Built with Next.js, Tailwind CSS, Framer Motion. Features: cyber-industrial aesthetic, dynamic theme switching, local client telemetry analysis, embedded chat engine.',
    suggestions: ['Show me your projects', 'Web development', 'Get a quote'],
  },

  {
    id: 'custom-business-sites',
    domain: 'WEB_DEV',
    title: 'Complete custom business websites',
    keywords: ['online shop', 'ecommerce', 'e-commerce', 'booking website', 'booking system', 'appointment website', 'salon website', 'shop website', 'business website', 'full website', 'website with cart', 'whatsapp ordering', 'order on whatsapp', 'catalogue website', 'catalog website', 'website with admin', 'quote website', 'website for my business', 'large website', 'responsive website', 'website design service', 'build me a website', 'custom website'],
    content:
      'We design complete, responsive business websites made to order: hero slideshow, product or service catalogue with search and categories, cart with WhatsApp ordering, appointment booking or quote requests, reviews, gallery, FAQ, light and dark modes, English/Swahili/Luganda, and an owner admin page. Examples are in the portfolio with working live demos.',
    reply:
      "Yes, we build **complete business websites** to order. 🌐\n\nA typical site has:\n- a hero slideshow, about, services and a **product catalogue** with search\n- a **cart that sends orders to your WhatsApp**\n- **appointment booking** or **quote requests**\n- reviews, gallery, FAQ, light & dark mode and **English / Swahili / Luganda**\n- an **owner admin page** to manage products and orders\n\nIt looks great on phones, tablets and computers. Open the **portfolio** to try live demos, then send a request and we will quote you before any work starts.",
    expert:
      'CUSTOM_SITES // Made-to-order responsive business sites: slideshow, catalogue, cart->WhatsApp, booking or quote flow, reviews, gallery, FAQ, light/dark, EN/SW/LG, owner admin. Live demos in portfolio. Quote before work.',
    suggestions: ['Show me your websites', 'Request a custom website', 'How much does it cost?', 'Open the template builder'],
  },
  {
    id: 'template-builder',
    domain: 'WEB_DEV',
    title: 'Website template builder',
    keywords: ['template', 'templates', 'website template', 'website builder', 'site builder', 'build my own website', 'make my own website', 'diy website', 'no code', 'without coding', 'download website', 'zip', 'bootstrap', 'customize website', 'cheap website', 'ready made website'],
    content:
      'The Template Builder lets anyone pick a ready-made website template (business, portfolio, restaurant, product landing page), customize every text, photo, colour, font and section with a live preview and no coding, then confirm it is ready, pay by mobile money, and download the finished site as a zip (HTML, CSS, JavaScript, Bootstrap) to upload to any hosting. Prices are shown on each template.',
    reply:
      "You can build your own website here **without any coding**! 🎨\n\n1. **Pick a template** (business, portfolio, restaurant, product page)\n2. **Make it yours** — change every word, photo, colour, font and section with a live preview\n3. **Confirm it's ready**, pay by mobile money, then **download your site as a .zip** to upload to any hosting\n\nSay **\"open the template builder\"** and I'll take you there.",
    expert:
      'TEMPLATE_BUILDER // Flow: choose template -> customize (no code, live preview) -> confirm -> mobile-money payment -> download .zip (HTML/CSS/JS/Bootstrap). Say "open template builder".',
    suggestions: ['Open template builder', 'How much do templates cost?', 'Request a custom website', 'Track my request'],
  },
  {
    id: 'site-navigation',
    domain: 'PORTFOLIO',
    title: 'Getting around this site with the chat',
    keywords: ['navigate', 'navigation', 'menu', 'where is', 'where can i find', 'site map', 'sitemap', 'pages', 'sections', 'find my way', 'can you open', 'can you take me', 'move around', 'control the site'],
    content:
      'The chat assistant can move visitors around the site: it can open the portfolio, services, contact, home, games, template builder, request-tracking or privacy pages, filter the project archive by category (UI/UX, branding, web apps, hardware), search it, open a specific project, open the contact form already set to repair or design, change the colour theme, and scroll to the top or bottom.',
    reply:
      "I can take you around the site — just ask! For example:\n- \"Show me your projects\"\n- \"Show hardware projects\"\n- \"Open services\"\n- \"Book a repair\" (opens the form ready for a repair)\n- \"Open the template builder\"\n- \"Track my request\"\n- \"Switch to the amber theme\"\n\nWhere would you like to go?",
    expert:
      'NAV // Voice-style navigation enabled: projects | <category> projects | open <project> | services | home | contact [repair|design] | builder | track [SYS-XXXXXX] | privacy | games | theme <cyan|amber|emerald> | top | back.',
    suggestions: ['Show me your projects', 'Open services', 'Book a repair'],
  },

  {
    id: 'pricing',
    domain: 'PRICING_RATES',
    title: 'Pricing and quotes',
    keywords: ['price', 'prices', 'pricing', 'cost', 'rate', 'rates', 'quote', 'charge', 'fee', 'budget', 'cheap', 'affordable', 'how much', 'estimate', 'payment'],
    content:
      'Pricing depends on the device/model and fault (repairs), or scope and deliverables (design/web). The owner gives a quote after diagnosis or a short brief. No exact prices are published in this chat, so do not state numbers.',
    reply:
      "Pricing depends on the job: for repairs it's the **device + fault** (and parts), for design/web it's the **scope and deliverables**. I don't want to guess numbers here — send me the details and you'll get a clear, straightforward quote with no hidden fees. 💬",
    expert:
      'SLA_PRICING // Quote basis: diagnostic tier + parts (repair) | scope + deliverables (design/web). No hidden fees. Submit details via contact module.',
    suggestions: ['Quote for a repair', 'Quote for a website', 'Quote for a logo', 'Contact'],
  },
  {
    id: 'contact',
    domain: 'CONTACT',
    title: 'Contact and location',
    keywords: ['contact', 'hire', 'reach', 'email', 'whatsapp', 'call', 'phone number', 'location', 'where', 'address', 'ndejje', 'kampala', 'uganda', 'visit', 'shop', 'book', 'booking', 'appointment', 'located', 'find you', 'directions', 'map'],
    content: `Location: ${SITE.location}. ${contactLine || 'Use the contact section of the website to send a message.'}`,
    reply: `I'm based in **${SITE.location}**. ${
      contactLine ? contactLine + '. ' : ''
    }The quickest way to reach me is the contact section of this site — I can take you there. 📍`,
    expert: `NODE_LOCATION // ${SITE.location}. ${contactLine || 'Direct link: contact module.'}`,
    suggestions: ['Open contact section', 'Get a quote'],
  },
  {
    id: 'turnaround',
    domain: 'HARDWARE_REPAIR',
    title: 'Turnaround time',
    keywords: ['how long', 'take', 'takes', 'turnaround', 'time', 'days', 'fast', 'quick', 'urgent', 'same day', 'deadline', 'ready', 'logo', 'poster', 'brand', 'website', 'embroidery', 'repair', 'screen', 'battery'],
    content:
      `Typical timelines from the services page: hardware diagnostics and repair ${TIME(0)}; brand identity and graphic design ${TIME(1)}; UI/UX and web layouts ${TIME(2)}; file conversion and embroidery digitizing ${TIME(3)}. These are typical, not guarantees; the owner confirms the real timeline with the quote.`,
    reply:
      `Typical timelines: **repairs ${TIME(0)}**, **logos & brand design ${TIME(1)}**, **file conversion / embroidery ${TIME(3)}**, and **websites / UI ${TIME(2).toLowerCase()}** (depends on size). Those are typical, not promises. You get the real timeline with your quote. ⏱️ Got a deadline?`,
    expert:
      `SYS_ETA // repair ${TIME(0)} | design ${TIME(1)} | assets ${TIME(3)} | web/UI ${TIME(2)}. Typical only; confirmed with quote.`,
    suggestions: ['It is urgent', 'Get a quote'],
  },
  {
    id: 'hours',
    domain: 'CONTACT',
    title: 'Opening hours and availability',
    keywords: ['hours', 'opening hours', 'open', 'opened', 'closed', 'closing', 'sunday', 'saturday', 'weekend', 'weekday', 'available', 'availability', 'when are you', 'schedule', 'walk in', 'appointment'],
    content: SITE.hours ? `Hours: ${SITE.hours}.` : 'Opening hours are not published in this chat. Do not guess hours; direct the visitor to message the owner.',
    reply: SITE.hours
      ? `Hours: **${SITE.hours}**. For anything urgent, message me through the contact section. 🕒`
      : "I don't have set opening hours listed, and I won't guess. 🕒 The quickest way to find out if someone's free is to send a message. I can pass your question to the owner for you.",
    expert: SITE.hours ? `HOURS // ${SITE.hours}` : 'HOURS // not published. Use contact module or SEND_TO_OWNER.',
    suggestions: ['Send my question to the owner', 'Open contact section'],
  },
  {
    id: 'warranty',
    domain: 'HARDWARE_REPAIR',
    title: 'Warranty and guarantees',
    keywords: ['warranty', 'guarantee', 'guaranteed', 'refund', 'return', 'comes back', 'breaks again', 'fails again', 'after repair', 'covered'],
    content: 'Warranty and guarantee terms are not published in this chat. Do not state any warranty length or refund policy; the owner confirms terms per job.',
    reply: "Warranty terms depend on the job and the part, so I won't quote one I can't back up. 🛡️ The owner confirms exactly what's covered when they quote. I can add \"what's the warranty?\" to your message so it's answered up front.",
    expert: 'WARRANTY // terms job-specific; confirmed by owner at quote. Not stated here.',
    suggestions: ['Send my question to the owner', 'Get a quote'],
  },
  {
    id: 'payment',
    domain: 'PRICING_RATES',
    title: 'Payment methods',
    keywords: ['pay', 'paying', 'payment', 'payments', 'mobile money', 'momo', 'mtn', 'airtel', 'cash', 'card', 'bank', 'transfer', 'deposit', 'upfront', 'invoice', 'installments', 'instalments', 'receipt'],
    content: 'Accepted payment methods and deposit rules are not published in this chat. Do not claim any method is or is not accepted.',
    reply: "I don't have the accepted payment methods or deposit rules on hand, and I'd rather not say \"yes\" to something that isn't true. 💳 Ask in your message and the owner will confirm when they send the quote. I can pass that question along.",
    expert: 'PAYMENT // methods not published here. Confirmed by owner with quote.',
    suggestions: ['Send my question to the owner', 'Get a quote'],
  },
  {
    id: 'pickup-delivery',
    domain: 'HARDWARE_REPAIR',
    title: 'Drop-off, pickup and delivery',
    keywords: ['pickup', 'pick up', 'collect', 'collection', 'drop off', 'dropoff', 'bring', 'deliver', 'delivery', 'courier', 'ship', 'shipping', 'post', 'mail', 'remote', 'online', 'home visit', 'come to me', 'on site'],
    content: 'Drop-off, pickup, delivery and remote options are not published in this chat. Do not promise any of them. For design and web projects, work is done remotely and files are shared digitally.',
    reply: "Design and web work is done remotely: files travel online, so you can be anywhere. 🌍 For **device repairs**, how it gets to and from the workshop (drop-off, pickup, delivery) is arranged per job, and I don't want to promise something I can't confirm. I can ask the owner for you.",
    expert: 'LOGISTICS // design+web remote. Device drop-off/pickup arranged per job by owner.',
    suggestions: ['Send my question to the owner', 'Book a repair'],
  },
  /* ------------------------------------------------------------------ */
  /* Everyday tech, security and design know-how (works without AI)      */
  /* ------------------------------------------------------------------ */
  {
    id: 'ram-explained',
    domain: 'GENERAL_QA',
    title: 'RAM and memory',
    keywords: ['ram', 'what is ram', 'how much ram', 'more ram', 'ram vs storage', 'memory vs storage', '8gb ram', '16gb ram', 'upgrade ram'],
    content:
      'RAM is the short-term working memory used by open apps; storage (SSD/HDD) is where files live. More RAM helps multitasking but cannot fix a slow hard drive. For everyday Windows use 8GB is a practical minimum and 16GB is comfortable; gaming and editing like 16GB or more, ideally two matching sticks (dual channel). Some laptops and phones have soldered RAM that cannot be upgraded.',
    reply:
      "**RAM** is your device's short-term working memory — it holds whatever apps and tabs are open right now. **Storage** (SSD/HDD) is where your files live permanently.\n\n- **8GB** is a practical minimum for Windows today, **16GB** is comfortable, and gaming/editing like 16GB+\n- Two matching sticks run faster than one (dual channel)\n- More RAM won't fix a slow old hard drive — an SSD will\n- Some laptops have RAM soldered on and can't be upgraded\n\nTell me your model and I'll tell you if it can be upgraded.",
    expert:
      'SYS_MEM_INFO // RAM = volatile working memory; storage = persistent. Targets: 8GB min, 16GB comfortable, dual-channel preferred. Check if soldered. HDD->SSD outranks RAM upgrades on slow systems.',
    suggestions: ['Upgrade my laptop', 'SSD vs HDD', 'Get a quote'],
  },
  {
    id: 'cpu-gpu',
    domain: 'GENERAL_QA',
    title: 'CPU vs GPU',
    keywords: ['cpu vs gpu', 'difference between cpu and gpu', 'what is a cpu', 'what is a gpu', 'processor', 'graphics card', 'integrated graphics', 'dedicated graphics', 'vram'],
    content:
      'The CPU is the general-purpose processor that runs the system and apps; the GPU is specialised for massive parallel work such as graphics, gaming, video rendering and AI. Gaming performance depends mostly on the GPU; office work depends mostly on CPU, RAM and SSD. Integrated graphics share the CPU and system RAM; a dedicated GPU has its own VRAM.',
    reply:
      "The **CPU** is the all-round brain that runs your system and apps. The **GPU** is a specialist for graphics and other massively parallel work (games, video rendering, AI).\n\n- **Gaming / 3D / video editing:** the GPU matters most\n- **Office / browsing / coding:** CPU + RAM + SSD matter most\n- **Integrated graphics** share the CPU and RAM; a **dedicated GPU** has its own memory (VRAM) and is much stronger\n\nWhat will you use it for?",
    expert:
      'SYS_HW_INFO // CPU: general compute. GPU: parallel compute (graphics/render/AI). Gaming ~ GPU-bound. Office ~ CPU/RAM/SSD-bound. iGPU shares system RAM; dGPU has dedicated VRAM.',
    suggestions: ['Gaming PC advice', 'Upgrade my PC', 'Get a quote'],
  },
  {
    id: 'ssd-hdd',
    domain: 'GENERAL_QA',
    title: 'SSD vs HDD',
    keywords: ['ssd', 'hdd', 'ssd vs hdd', 'nvme', 'hard disk', 'solid state', 'upgrade to ssd', 'sata'],
    content:
      'SSDs have no moving parts, boot and load far faster, and survive drops better than HDDs. NVMe SSDs are faster than SATA SSDs. HDDs are cheaper per gigabyte and suit bulk storage but are slow and fragile. Replacing an HDD with an SSD is the single biggest speed upgrade for an old PC; reinstalling or cloning the OS is needed.',
    reply:
      "**SSD vs HDD** in short:\n\n- **SSD:** no moving parts, boots in seconds, much more drop-resistant. **NVMe** SSDs are faster still than SATA ones\n- **HDD:** cheaper per GB, fine for bulk storage, but slow and fragile\n\nSwapping an old HDD for an SSD is usually the **biggest speed boost** you can give an older PC or laptop. I can clone or reinstall your system so you don't lose anything. 🚀",
    expert:
      'SYS_STORAGE // SSD: no moving parts, high IOPS. NVMe > SATA SSD > HDD. HDD: capacity/cost. Best upgrade path for legacy systems: HDD -> SSD with OS clone/reinstall.',
    suggestions: ['Upgrade to SSD', 'My PC is slow', 'Get a quote'],
  },
  {
    id: 'phone-slow',
    domain: 'HARDWARE_REPAIR',
    title: 'Slow phone or storage full',
    keywords: ['storage full', 'memory full', 'low storage', 'phone hangs', 'phone lag', 'phone slow', 'phone freezing', 'clear cache', 'phone is slow', 'not enough storage', 'phone heating'],
    content:
      'Slow phones are usually full storage, too many background apps, outdated software, or a worn battery. Fixes: restart, update, uninstall unused apps, clear app caches (not data), move photos and videos to a computer or cloud, disable heavy widgets and animations, check battery health. Factory reset is the last resort after a backup.',
    reply:
      "A slow phone is usually **full storage**, too many background apps, old software or a worn battery. Try this:\n1. **Restart** it and install pending updates\n2. **Free space** — move photos/videos to a PC or cloud, delete unused apps and big WhatsApp media\n3. **Clear app caches** (not app data) for the heaviest apps\n4. Check **battery health** — a tired battery can slow the phone down\n5. **Factory reset** only as a last resort, *after* a backup\n\nStill sluggish? Tell me the model and I'll take a look.",
    expert:
      'SYS_MOBILE_PERF // Causes: storage saturation, background load, outdated OS, degraded battery. Steps: reboot, update, free >=15% storage, clear caches, check battery health, factory reset after backup.',
    suggestions: ['Battery drains fast', 'Get a quote'],
  },
  {
    id: 'battery-care',
    domain: 'HARDWARE_REPAIR',
    title: 'Battery life and swollen batteries',
    keywords: ['battery drains', 'battery life', 'battery health', 'swollen battery', 'bloated battery', 'battery bulging', 'battery draining', 'battery dies', 'charging tips', 'battery care'],
    content:
      'Batteries age with heat and full charge cycles. Tips: avoid heat, avoid leaving the device at 100% or 0% for long periods, use quality chargers. Replace when capacity is low or the device shuts down unexpectedly. A swollen or bulging battery is dangerous: stop charging and using the device and have it replaced safely; do not puncture or press it.',
    reply:
      "To keep a battery healthy: **avoid heat**, don't leave it at 0% or pinned at 100% for long, and use a **quality charger**. If it drains fast or shuts off unexpectedly, the battery is probably worn and a replacement fixes it. 🔋\n\n⚠️ If the battery looks **swollen or the back is lifting**, stop charging and using the device straight away and have it replaced — never press or puncture it.",
    expert:
      'SYS_BATT // Degradation drivers: heat, high SoC dwell, poor chargers. Replace at low capacity or unexpected shutdowns. SWELLING = safety hazard: cease charging, do not puncture, replace.',
    suggestions: ['Battery replacement', 'Get a quote'],
  },
  {
    id: 'malware-virus',
    domain: 'HARDWARE_REPAIR',
    title: 'Viruses and malware',
    keywords: ['virus', 'malware', 'infected', 'trojan', 'adware', 'popups', 'pop-ups', 'ransomware', 'antivirus', 'spyware', 'virus removal', 'redirects'],
    content:
      'Signs of malware: sudden slowness, pop-ups, browser redirects, unknown apps or toolbars, battery drain, disabled antivirus. PC steps: run a full scan with Microsoft Defender (and an offline scan), uninstall unknown programs and browser extensions, update Windows, and avoid cracked software and unknown downloads. Phones: remove unknown apps, check device-admin permissions, run Play Protect or a reputable scanner, avoid installing APKs from unknown sources. If banking or ID was exposed, change passwords from a clean device. Severe infections may need a clean OS reinstall.',
    reply:
      "Signs of a virus or malware: **sudden slowness, pop-ups, browser redirects, apps or toolbars you didn't install**, battery drain. 🛡️\n\n**On a PC:**\n- Run a **full scan** with Windows Security (Microsoft Defender), plus an **offline scan**\n- Uninstall unknown programs and browser extensions, then update Windows\n- Avoid cracked software and shady downloads — the most common way in\n\n**On a phone:** remove unknown apps, don't install APKs from random sources, and run Play Protect.\n\nIf you logged into banking or email while infected, **change those passwords from a clean device**. For stubborn infections I can do a proper cleanup or a clean reinstall.",
    expert:
      'SYS_MALWARE_TRIAGE // Indicators: perf drop, popups, redirects, unknown apps, AV disabled. PC: Defender full + offline scan, remove PUPs/extensions, patch OS. Phone: remove unknown apps, check device-admin, Play Protect. Rotate credentials from clean device. Severe: clean OS reinstall.',
    suggestions: ['Clean my PC', 'My account was hacked', 'Get a quote'],
  },
  {
    id: 'hacked-account',
    domain: 'GENERAL_QA',
    title: 'Hacked or locked-out account',
    keywords: ['hacked', 'got hacked', 'account hacked', 'whatsapp hacked', 'facebook hacked', 'instagram hacked', 'someone logged in', 'recover account', 'account recovery', 'password changed', 'locked out account', 'compromised'],
    content:
      'If an account is compromised: use the platform\'s official recovery page from a trusted device, change the password (and the email password if reused), turn on two-step verification, sign out of all other sessions, remove unknown devices and linked apps, check recovery email/phone, and warn contacts not to trust messages from the account. Never pay anyone claiming they can recover an account.',
    reply:
      "Sorry that happened — act fast. 🔐 In this order:\n1. Use the **official recovery page** of the app (WhatsApp, Facebook, Gmail...) from a device you trust\n2. **Change the password** — and your **email password** too if it's the same or related\n3. Turn on **two-step verification**\n4. **Sign out of all other sessions** and remove unknown devices / linked apps\n5. **Warn your contacts** not to trust messages or money requests from your account\n\n⚠️ Never pay someone who promises to \"recover\" it for you — that's usually a scam. If you think your phone or PC itself is infected, I can check it.",
    expert:
      'SYS_INCIDENT // Account compromise: 1) official recovery flow from trusted device. 2) rotate password (+ email). 3) enable 2FA. 4) revoke sessions/devices/apps. 5) notify contacts. Do not engage paid "recovery" services. Scan endpoint for malware.',
    suggestions: ['Scan my phone for viruses', 'Phishing and scams', 'Contact'],
  },
  {
    id: 'phishing-scams',
    domain: 'GENERAL_QA',
    title: 'Phishing and scams',
    keywords: ['phishing', 'what is phishing', 'scam', 'scammer', 'fraud', 'suspicious link', 'fake message', 'otp', 'mobile money scam', 'suspicious sms', 'fake website'],
    content:
      'Phishing and scam messages create urgency, ask for passwords, PINs or one-time codes (OTP), or send links to fake websites. Never share a PIN or OTP with anyone, even someone claiming to be from your bank, mobile-money provider or tech support. Check the real web address, do not click links in unexpected messages, and confirm through an official channel.',
    reply:
      "**Phishing / scams** try to rush you into giving away passwords, PINs or codes. Red flags:\n- **Urgency** (\"your account will be closed today!\")\n- A request for your **PIN, password or OTP** — never share these with *anyone*, even \"the bank\", your mobile-money provider or \"tech support\"\n- **Links** in unexpected messages, or a web address that's slightly off\n- Prizes, lottery wins, or \"send money to receive money\"\n\nWhen in doubt: don't click, and confirm through the **official app or phone number**. Already clicked or shared something? Change your passwords now and tell your provider.",
    expert:
      'SYS_SCAM_AWARE // Indicators: urgency, credential/OTP requests, mismatched URLs, advance-fee. Rule: never disclose PIN/OTP. Verify via official channel. If exposed: rotate credentials, notify provider.',
    suggestions: ['My account was hacked', 'Virus removal'],
  },
  {
    id: 'water-damage',
    domain: 'HARDWARE_REPAIR',
    title: 'Water or liquid damage',
    keywords: ['water damage', 'dropped in water', 'spilled', 'liquid damage', 'wet phone', 'rain', 'coffee spill', 'tea spill', 'fell in water', 'submerged'],
    content:
      'Liquid damage first aid: switch the device off immediately, do not charge or try to turn it on, remove the case, SIM and any removable battery, wipe the outside and let it dry in open air. Rice is not reliable. Corrosion starts quickly, so internal cleaning by a technician as soon as possible gives the best chance. Sugary or salty liquids are worse than plain water.',
    reply:
      "Liquid damage — act quickly: 💧\n1. **Switch it off now** and don't try to charge or power it on\n2. Remove the **case, SIM and battery** (if removable) and wipe the outside\n3. Let it dry in open air — **rice doesn't really work** and can leave dust behind\n4. **Don't use a hairdryer** on high heat\n5. **Bring it in as soon as you can** — corrosion starts within hours, and an internal clean is what saves it\n\nSugary or salty liquids (juice, tea, sea water) are worse than plain water.",
    expert:
      'SYS_LIQUID // Power down, no charging. Remove case/SIM/battery. Air-dry; avoid high heat; rice ineffective. Time-critical: corrosion progresses; ultrasonic/IPA cleaning by technician. Sugary/saline liquids = higher risk.',
    suggestions: ['Book a repair', 'Get a quote'],
  },
  {
    id: 'screen-flicker',
    domain: 'HARDWARE_REPAIR',
    title: 'Flickering screen, lines or ghost touch',
    keywords: ['flicker', 'flickering', 'lines on screen', 'black spots', 'green line', 'pink line', 'ghost touch', 'touch not working', 'screen goes black', 'dim screen', 'display problem', 'dead pixels'],
    content:
      'Flicker, coloured lines, black spots or ghost touch are usually a failing display or digitizer (often after a drop or pressure), a loose display connector, or on PCs a graphics driver issue. For a laptop, test with an external monitor: if the external display is fine, the laptop panel or cable is at fault. For phones, display replacement is the usual fix. Update drivers first on PCs.',
    reply:
      "Flicker, coloured lines, black spots or ghost touches usually mean a **failing display or digitizer** (often after a drop or pressure), a **loose connector**, or on PCs a **graphics driver problem**. 📺\n\n- **Laptop:** plug in an external monitor — if that looks fine, the laptop's panel or cable is the issue; if not, it's the GPU/driver\n- **PC:** update or roll back the graphics driver and test with another cable\n- **Phone:** if it started after a drop or pressure, it's almost always a display replacement\n\nWhat's the device and when did it start?",
    expert:
      'SYS_DISPLAY_DIAG // Artifacts: panel/digitizer fault, connector, or GPU/driver. Isolate: external monitor test (laptop), driver rollback + cable swap (PC). Phone post-impact: display assembly replacement.',
    suggestions: ['Screen replacement', 'Get a quote'],
  },
  {
    id: 'windows-wont-boot',
    domain: 'HARDWARE_REPAIR',
    title: "Windows won't start or boot loops",
    keywords: ['windows not starting', 'windows wont start', 'boot loop', 'no bootable device', 'startup repair', 'automatic repair', 'stuck on logo', 'black screen on startup', 'operating system not found', 'reinstall windows', 'blue screen'],
    content:
      'If Windows will not start: force-shutdown three times during boot to enter the recovery environment, then try Startup Repair, Safe Mode, or System Restore. "No bootable device" can mean the drive is not detected, the boot order is wrong, or the drive is failing. Check cables, RAM seating and drive health; a clean reinstall is the last resort and wipes the system drive, so back up first or have the drive imaged.',
    reply:
      "If Windows won't start, try this:\n1. Power on, and when the logo appears **hold the power button to force a shutdown — repeat 3 times**. That opens the **recovery environment**\n2. Choose **Startup Repair**, then **Safe Mode**, then **System Restore** if needed\n3. **\"No bootable device\"?** The drive may not be detected, the boot order may be wrong, or the drive is failing\n4. A **clean reinstall** is the last resort — it wipes the system drive, so get your files off first\n\nDon't reinstall yet if you need your files — I can back them up first.",
    expert:
      'SYS_BOOT_DIAG // Trigger WinRE via 3 interrupted boots -> Startup Repair / Safe Mode / System Restore. "No bootable device": check drive detection, boot order, SMART, cabling. Reinstall last; image/backup first.',
    suggestions: ['Recover my files', 'Book a repair', 'Get a quote'],
  },
  {
    id: 'wifi-internet',
    domain: 'GENERAL_QA',
    title: 'Wi-Fi and internet problems',
    keywords: ['wifi', 'wi-fi', 'no internet', 'internet slow', 'router', 'wifi slow', 'cant connect', 'wifi keeps disconnecting', 'network problem', 'limited connection'],
    content:
      'Wi-Fi troubleshooting: check whether other devices also fail (if yes, restart the router/modem and check the provider; if only one device fails, forget and rejoin the network, toggle airplane mode, restart the device, update network drivers). Place the router centrally and away from walls and appliances. On Windows, flushing DNS or running the network troubleshooter can help.',
    reply:
      "Internet or Wi-Fi acting up? First check **is it just one device or all of them?** 📶\n\n**All devices:** restart the router/modem (off for 30 seconds), check for provider outages or an unpaid/finished data bundle.\n**Only one device:** turn Wi-Fi/airplane mode off and on, **forget the network and rejoin**, restart the device, and on a PC run the **network troubleshooter** / update the Wi-Fi driver.\n\nFor weak signal, move the router to a central, open spot away from walls and appliances. If only one laptop or phone keeps failing, it may be the Wi-Fi card — I can test it.",
    expert:
      'SYS_NET_DIAG // Scope: all clients vs single client. Global: power-cycle modem/router, check ISP. Single: forget/rejoin, airplane toggle, reboot, driver update, DNS flush. RF: centralise AP, avoid obstructions/interference.',
    suggestions: ['Only my laptop fails', 'Get a quote'],
  },
  {
    id: 'file-formats',
    domain: 'DESIGN_BRANDING',
    title: 'Design file formats and print resolution',
    keywords: ['vector vs raster', 'file format', 'file formats', 'png vs jpg', 'jpg vs png', 'dpi', 'resolution', 'svg', 'print ready', 'pdf for print', 'cmyk', 'rgb', 'vector file'],
    content:
      'Vector files (SVG, AI, EPS, PDF) scale to any size without losing quality and suit logos, signs, embroidery and print. Raster files (PNG, JPG) are made of pixels and blur when enlarged. PNG supports transparency; JPG is smaller for photos. For print, use about 300 DPI at final size and CMYK colour; for screens use RGB. Ask for a vector master of any logo.',
    reply:
      "Quick guide to file formats: 🖼️\n\n- **Vector** (SVG, AI, EPS, PDF): scales to *any* size with no quality loss — best for **logos, signs, embroidery and print**\n- **Raster** (PNG, JPG): made of pixels, blurs when enlarged. **PNG** keeps transparency, **JPG** is smaller for photos\n- **Print:** about **300 DPI** at final size, **CMYK** colours. **Screens:** RGB\n\nAlways get a **vector master** of your logo — I can convert or redraw yours if you only have a small PNG.",
    expert:
      'DESIGN_SPEC // Vector (SVG/AI/EPS/PDF) = resolution independent; raster (PNG/JPG) = pixel-bound. Print: 300 DPI @ final size, CMYK. Screen: RGB. Deliver vector master + exports.',
    suggestions: ['Redraw my logo', 'Embroidery files', 'Get a quote'],
  },
  {
    id: 'web-process',
    domain: 'WEB_DEV',
    title: 'How a website project works',
    keywords: ['website process', 'how does it work', 'what do you need from me', 'steps to build a website', 'how to start a website', 'website content', 'responsive', 'mobile friendly', 'domain name', 'maintenance'],
    content:
      'A typical website project: 1) short brief (purpose, pages, style, references), 2) design/layout, 3) build, 4) review and changes, 5) launch. The client provides text, logo and photos, and a domain name (renewed yearly) plus hosting; many small sites can be hosted on free or low-cost platforms. Sites are built mobile-first and responsive. Timelines and prices are agreed per project.',
    reply:
      "Here's how a website project usually goes: 🌐\n1. **Brief** — what the site is for, pages needed, style, sites you like\n2. **Design** — layout and look for your approval\n3. **Build** — responsive, mobile-friendly, fast\n4. **Review** — you test and request changes\n5. **Launch** — domain + hosting connected, site goes live\n\n**What I need from you:** your text, logo and photos (or I can help create them), plus a domain name (renewed yearly) and hosting — many small sites can run on free or low-cost platforms. Timeline and price are agreed after the brief.",
    expert:
      'WEB_PIPELINE // Brief -> design -> build (mobile-first, responsive) -> review -> launch. Client inputs: copy, brand assets, domain, hosting. Timeline/price per scope.',
    suggestions: ['Get a quote', 'Portfolio website', 'Business website'],
  },
  // Extra everyday tech answers (see techFacts.ts)
  ...TECH_FACTS,
];

/**
 * Original API, kept for compatibility. The knowledge base is now searched by the retriever
 * (typo-tolerant, ranked) instead of this list being scanned with `includes()`.
 */
export function getActiveKnowledgeBase(): KnowledgeEntry[] {
  return KNOWLEDGE;
}
