// src/data/devProfile.ts — EDIT ME: the "About the developer" block on the home page.
// Nothing here is sent anywhere; it is plain text shown on the site. Leave a field empty ('') to hide it.
import { SITE } from '@/utils/chatEngine/siteConfig';

export const DEV = {
  name: SITE.ownerName && SITE.ownerName !== 'the owner' ? SITE.ownerName : 'Your developer',
  role: 'Hardware technician · UI/UX designer · web developer',
  blurb:
    'I fix the hardware, design the brand and build the website, so one person owns the whole job from the broken screen to the finished app. ' +
    'This portfolio is built the way I work: fast, tidy, and tested before it ships.',
  // Short, honest bullet points (edit to match your real experience).
  facts: [
    { icon: 'wrench', title: 'Hands-on repair', text: 'Phone and PC diagnostics down to board level.' },
    { icon: 'layout', title: 'Design that ships', text: 'Logos, posters, UI/UX in Figma, print-ready files.' },
    { icon: 'code', title: 'Modern web', text: 'Next.js, React, Tailwind and a lot of care for phones.' },
  ] as const,
  skills: ['Next.js', 'React', 'TypeScript', 'Tailwind', 'Figma', 'Board-level repair', 'Embroidery files'],
  // Optional links shown as buttons. Use full https:// URLs.
  links: [
    { label: 'GitHub', href: 'https://github.com/RayThund3r' },
  ] as Array<{ label: string; href: string }>,
};
