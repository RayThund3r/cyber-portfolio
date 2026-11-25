// src/components/layout/SiteFooter.tsx
'use client';

import SessionLine from '@/components/site/SessionLine';
import Link from 'next/link';
import { ROUTES } from '@/lib/siteMap';
import { openChat } from '@/lib/chatBus';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { SITE, hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';
import Icon from '@/components/ui/Icon';
import { NodeFooter } from '@/components/site/VisitorNode';

/** Pages that aren't in the main menu but should always be one click away. */
const EXTRA_LINKS = [
  { path: '/builder', label: 'TEMPLATES' },
  { path: '/guides', label: 'GUIDES' },
  { path: '/track', label: 'TRACK_REQUEST' },
  { path: '/privacy', label: 'PRIVACY' },
];

const SOCIAL_BASE: Record<string, string> = { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', tiktok: 'https://tiktok.com/@', youtube: 'https://youtube.com/@', x: 'https://x.com/' };

export default function SiteFooter() {
  const { social } = useSiteSettings();
  const socials = Object.entries(social).filter(([, v]) => v).map(([k, v]) => [k, /^https:\/\//i.test(v) ? v : SOCIAL_BASE[k] + v] as const);
  return (
    // Extra bottom padding on phones keeps the floating chat button from covering the links.
    <footer className="border-t border-zinc-900 bg-zinc-950">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 pb-24 pt-8 font-mono text-xs text-zinc-500 sm:flex-row sm:px-8 sm:pb-10">
        <div className="text-center sm:text-left">
          <div className="text-zinc-400">SYS_PORTFOLIO.v1 // SECURE ENVIRONMENT</div>
          <NodeFooter />
          <SessionLine />
          {SITE.hours && <div className="mt-1 text-[10px] text-zinc-500">Hours: {SITE.hours}</div>}
          {socials.length > 0 && (
            <div className="mt-1 flex flex-wrap justify-center gap-x-3 sm:justify-start">
              {socials.map(([k, href]) => <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="py-1 uppercase text-zinc-400 hover:text-accent">{k}</a>)}
            </div>
          )}
          {hasWhatsApp() && (
            <div className="mt-1">
              <a
                href={whatsappLink('Hello, I found you on your website. ')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block py-1 text-emerald-400 hover:underline"
              >
                <Icon name="chat" size={13} className="mr-1 align-[-2px]" />WhatsApp: {SITE.whatsapp}
              </a>
            </div>
          )}
        </div>
        <nav aria-label="Footer" className="flex min-w-0 flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-end">
          {ROUTES.map((r) => (
            <Link key={r.path} href={r.path} className="hit py-1 transition-colors hover:text-accent">
              {r.label}
            </Link>
          ))}
          {EXTRA_LINKS.map((r) => (
            <Link key={r.path} href={r.path} className="hit py-1 transition-colors hover:text-accent">
              {r.label}
            </Link>
          ))}
          <Link href="/admin" prefetch={false} className="hit py-1 text-accent/80 transition-colors hover:text-accent" aria-label="Admin panel" title="Owner panel (sign-in required)">
            <Icon name="lock" size={12} className="mr-1 align-[-1px]" />ADMIN
          </Link>
          <button type="button" onClick={() => openChat()} className="hit py-1 transition-colors hover:text-accent">
            ASK_AI
          </button>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="hit py-1 transition-colors hover:text-accent"
            aria-label="Back to top"
          >
            <Icon name="arrowUp" size={12} className="mr-0.5 align-[-1px]" />TOP
          </button>
        </nav>
      </div>
    </footer>
  );
}
