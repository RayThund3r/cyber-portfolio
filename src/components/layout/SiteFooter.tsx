// src/components/layout/SiteFooter.tsx
'use client';

import Link from 'next/link';
import { ROUTES } from '@/lib/siteMap';
import { openChat } from '@/lib/chatBus';
import { SITE, hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';

/** Pages that aren't in the main menu but should always be one click away. */
const EXTRA_LINKS = [
  { path: '/builder', label: 'TEMPLATES' },
  { path: '/track', label: 'TRACK_REQUEST' },
  { path: '/privacy', label: 'PRIVACY' },
];

export default function SiteFooter() {
  return (
    // Extra bottom padding on phones keeps the floating chat button from covering the links.
    <footer className="border-t border-zinc-900 bg-zinc-950">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 pb-24 pt-8 font-mono text-xs text-zinc-500 sm:flex-row sm:px-8 sm:pb-10">
        <div className="text-center sm:text-left">
          <div className="text-zinc-400">SYS_PORTFOLIO.v1 // SECURE ENVIRONMENT</div>
          <div className="mt-1 text-[10px] text-zinc-600">NODE: {SITE.location}</div>
          {SITE.hours && <div className="mt-1 text-[10px] text-zinc-500">Hours: {SITE.hours}</div>}
          {hasWhatsApp() && (
            <div className="mt-1">
              <a
                href={whatsappLink('Hello, I found you on your website. ')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block py-1 text-emerald-400 hover:underline"
              >
                💬 WhatsApp: {SITE.whatsapp}
              </a>
            </div>
          )}
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {ROUTES.map((r) => (
            <Link key={r.path} href={r.path} className="py-1 transition-colors hover:text-accent">
              {r.label}
            </Link>
          ))}
          {EXTRA_LINKS.map((r) => (
            <Link key={r.path} href={r.path} className="py-1 transition-colors hover:text-accent">
              {r.label}
            </Link>
          ))}
          <button type="button" onClick={() => openChat()} className="py-1 transition-colors hover:text-accent">
            ASK_AI
          </button>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="py-1 transition-colors hover:text-accent"
            aria-label="Back to top"
          >
            ↑ TOP
          </button>
        </nav>
      </div>
    </footer>
  );
}
