// src/utils/chatEngine/siteConfig.ts
//
// EDIT THIS FILE (or set the env vars in .env.local). Everything the assistant "knows" about
// you and your business lives here and in knowledgeBase.ts. The AI model is told NOT to invent
// facts, so anything you want it to state confidently (prices, hours, links) goes here.
//
// Contact details are read from NEXT_PUBLIC_* env vars so you can set them without code changes:
//   NEXT_PUBLIC_WHATSAPP="+256700000000"     (international format, digits and + only)
//   NEXT_PUBLIC_CONTACT_EMAIL="you@example.com"
//   NEXT_PUBLIC_HOURS="Mon–Sat, 8am–7pm"

export const SITE = {
  assistantName: 'Cyber Assistant',
  ownerName: 'the owner', // e.g. 'Spider' — used in the AI's persona
  location: 'Ndejje, Makindye Ssabagabo, Uganda',

  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || '',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
  hours: process.env.NEXT_PUBLIC_HOURS || '',

  // Public site URL (used for sitemap / social previews). No trailing slash.
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',

  // Element ids on your page that the chat can scroll to.
  projectsElementId: 'projects',
  contactElementId: 'contact',

  services: [
    'Phone and PC hardware repair (screens, batteries, charging ports, motherboard-level faults, diagnostics)',
    'Graphic and brand design (logos, posters, brand identity, UI/UX in Figma)',
    'Embroidery and fabric-print file preparation (name lists, vector artwork, DST/PES formats)',
    'Web development (Next.js, React, Tailwind CSS, Framer Motion)',
  ],
};

export const FALLBACK_SUGGESTIONS = [
  'My device is not working',
  'I need a logo',
  'Build me a website',
  'Get a quote',
  'Book a repair',
  'What pages are there?',
];

/** Digits-only WhatsApp number (wa.me format), or '' when not configured. */
export function whatsappDigits(): string {
  return SITE.whatsapp.replace(/[^\d]/g, '');
}

export function hasWhatsApp(): boolean {
  return whatsappDigits().length >= 9;
}

/** Click-to-chat link with an optional prefilled message. Returns '' when WhatsApp isn't configured. */
export function whatsappLink(text = ''): string {
  const n = whatsappDigits();
  if (n.length < 9) return '';
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text.slice(0, 900))}` : ''}`;
}
