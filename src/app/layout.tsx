// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ChatLoader from '@/components/ChatLoader';
import Analytics from '@/components/Analytics';
import PageMotion from '@/components/motion/PageMotion';
import PressFeedback from '@/components/motion/PressFeedback';
import OfflineNotice from '@/components/ui/OfflineNotice';
import BackgroundFX from '@/components/fx/BackgroundFX';
import ScrollScene from '@/components/fx/ScrollScene';
import LiveUpdates from '@/components/site/LiveUpdates';
import { getSiteVersion } from '@/server/liveVersion';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import ChromeGate from '@/components/layout/ChromeGate';
import EventRibbon from '@/components/site/EventRibbon';
import FxLayer from '@/components/site/FxLayer';
import EasterEggs from '@/components/site/EasterEggs';
import CyberMotion from '@/components/site/CyberMotion';
import BackToTop from '@/components/site/BackToTop';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import { ThemeProvider } from '@/context/ThemeContext';
import { ProjectsProvider } from '@/context/ProjectsContext';
import { getProjects, getSiteContent, getSiteSettings } from '@/server/store';
import { DEFAULT_CONTENT } from '@/lib/siteContent';
import { SiteContentProvider } from '@/context/SiteContentContext';
import { DEFAULT_SETTINGS } from '@/lib/siteSettings';
import { SiteSettingsProvider } from '@/context/SiteSettingsContext';
import MaintenanceGate from '@/components/layout/MaintenanceGate';
import { SITE, whatsappDigits } from '@/utils/chatEngine/siteConfig';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "System Portfolio // Phone & PC Repair, Design and Web Development in Ndejje";
const DESCRIPTION =
  "Phone and PC repair, graphic and brand design, UI/UX and web development in Ndejje, Makindye Ssabagabo, Uganda. Send your device details or project brief for a quote.";

const BASE_META: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: TITLE, template: "%s | System Portfolio" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "System Portfolio",
    locale: "en_UG",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: "/" },
};

/** The owner can set the Google/sharing title and description in Admin → SETTINGS; empty keeps the built-in text. */
export async function generateMetadata(): Promise<Metadata> {
  let t = TITLE, d = DESCRIPTION;
  try { const s = (await getSiteSettings()).seo; t = s.title || TITLE; d = s.description || DESCRIPTION; } catch { /* storage unavailable: keep defaults */ }
  return { ...BASE_META, title: { default: t, template: "%s | System Portfolio" }, description: d, openGraph: { ...BASE_META.openGraph, title: t, description: d }, twitter: { card: "summary_large_image", title: t, description: d } };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the chat/nav respect phone notches via env(safe-area-inset-*)
  themeColor: "#09090b",
};

/* Applies the saved accent theme AND light/dark mode BEFORE first paint, so a visitor who chose
   amber/emerald or light mode never sees a flash of the defaults while React hydrates. Dark stays
   the default for first-time visitors. Wrapped in try/catch: storage can be blocked. */
const THEME_BOOT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('sys_portfolio_theme');if(t==='cyan'||t==='amber'||t==='emerald'){d.setAttribute('data-theme',t)}var m=localStorage.getItem('sys_portfolio_mode');if(m==='light'||m==='dark'){d.setAttribute('data-mode',m);var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute('content',m==='light'?'#f4f4f5':'#09090b')}}catch(e){}})();`;

// Structured data so Google can show you as a local business.
// Fill SITE.whatsapp / SITE.email / SITE.hours (env vars) to include them.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "System Portfolio — Tech & Design Hub",
  description: DESCRIPTION,
  url: SITE.url,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Ndejje, Makindye Ssabagabo",
    addressCountry: "UG",
  },
  ...(whatsappDigits() ? { telephone: `+${whatsappDigits()}` } : {}),
  ...(SITE.email ? { email: SITE.email } : {}),
  ...(SITE.hours ? { openingHours: SITE.hours } : {}),
  makesOffer: SITE.services.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s } })),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Portfolio items come from the CMS (/admin) and fall back to the built-in list.
  // Admin edits call revalidatePath('/', 'layout'), so pages stay static between edits.
  const projects = await getProjects();
  const settings = await getSiteSettings().catch(() => null);
  const content = await getSiteContent().catch(() => null);
  const siteVersion = await getSiteVersion();
  // Local-business markup follows what the owner typed in Admin → Settings (address, phone, hours, social profiles).
  const ld: Record<string, unknown> = { ...jsonLd };
  if (settings) {
    const b = settings.business;
    if (b.name) ld.name = b.name;
    if (b.address) ld.address = { '@type': 'PostalAddress', streetAddress: b.address, addressCountry: 'UG' };
    const tel = b.phone || (b.whatsapp ? `+${b.whatsapp}` : '');
    if (tel) ld.telephone = tel;
    if (b.email) ld.email = b.email;
    if (b.hours) ld.openingHours = b.hours;
    const base: Record<string, string> = { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', tiktok: 'https://tiktok.com/@', youtube: 'https://youtube.com/@', x: 'https://x.com/' };
    const same = Object.entries(settings.social).filter(([, v]) => v).map(([k, v]) => (/^https:\/\//i.test(v) ? v : (base[k] || '') + v));
    if (same.length) ld.sameAs = same;
  }
  if (content?.local.mapsUrl) ld.hasMap = content.local.mapsUrl;
  if (content?.local.areas) ld.areaServed = content.local.areas.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const chatOn = settings ? settings.features.chat : true;
  return (
    <html
      lang="en"
      data-theme="cyan"
      data-mode="dark"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script
          // Hide the hero intro only when motion is allowed (see globals.css). Runs before first paint.
          dangerouslySetInnerHTML={{ __html: "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion-ready')}catch(e){}" }}
        />
        {/* Optional visitor statistics: only added when the owner sets the matching environment variable. */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && /^[a-z0-9.-]+$/i.test(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) && <script defer data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" />}
        {process.env.NEXT_PUBLIC_UMAMI_ID && /^[a-f0-9-]{36}$/i.test(process.env.NEXT_PUBLIC_UMAMI_ID) && <script defer data-website-id={process.env.NEXT_PUBLIC_UMAMI_ID} src={process.env.NEXT_PUBLIC_UMAMI_SRC && /^https:\/\//.test(process.env.NEXT_PUBLIC_UMAMI_SRC) ? process.env.NEXT_PUBLIC_UMAMI_SRC : 'https://cloud.umami.is/script.js'} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-accent-strong selection:text-black">
        <ThemeProvider>
          <ProjectsProvider projects={projects}>
            <SiteSettingsProvider settings={settings ?? DEFAULT_SETTINGS}>
            <SiteContentProvider content={content ?? DEFAULT_CONTENT}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded focus:bg-accent-strong focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:font-semibold focus:text-black"
            >
              SKIP_TO_CONTENT
            </a>
            <LiveUpdates version={siteVersion} />
            <BackgroundFX />
            <ChromeGate><ScrollScene /></ChromeGate>
            {/* /admin and the template editor are full-screen tools with their own toolbars */}
            <ChromeGate>
              <AnnouncementBar />
              <EventRibbon />
              <SiteNav />
            </ChromeGate>
            {/* Page transition is handled by app/template.tsx. Pages render <div>/<section> inside this one <main>. */}
            <main id="main" className="flex-1 flex flex-col">
              <MaintenanceGate>{children}</MaintenanceGate>
            </main>
            <ChromeGate>
              <SiteFooter />
            </ChromeGate>
            {/* Loaded after the page is idle so it never competes with first paint */}
            <ChromeGate>
              {chatOn && <ChatLoader />}
              <BackToTop />
              <FxLayer />
              <EasterEggs />
              <CyberMotion />
            </ChromeGate>
            <Analytics />
            <PageMotion />
            <PressFeedback />
            <OfflineNotice />
            </SiteContentProvider>
            </SiteSettingsProvider>
          </ProjectsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
