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
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import ChromeGate from '@/components/layout/ChromeGate';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import { ThemeProvider } from '@/context/ThemeContext';
import { ProjectsProvider } from '@/context/ProjectsContext';
import { getProjects } from '@/server/store';
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

export const metadata: Metadata = {
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-accent-strong selection:text-black">
        <ThemeProvider>
          <ProjectsProvider projects={projects}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded focus:bg-accent-strong focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:font-semibold focus:text-black"
            >
              SKIP_TO_CONTENT
            </a>
            <BackgroundFX />
            {/* /admin and the template editor are full-screen tools with their own toolbars */}
            <ChromeGate>
              <AnnouncementBar />
              <SiteNav />
            </ChromeGate>
            {/* Page transition is handled by app/template.tsx. Pages render <div>/<section> inside this one <main>. */}
            <main id="main" className="flex-1 flex flex-col">
              {children}
            </main>
            <ChromeGate>
              <SiteFooter />
            </ChromeGate>
            {/* Loaded after the page is idle so it never competes with first paint */}
            <ChromeGate>
              <ChatLoader />
            </ChromeGate>
            <Analytics />
            <PageMotion />
            <PressFeedback />
            <OfflineNotice />
          </ProjectsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
