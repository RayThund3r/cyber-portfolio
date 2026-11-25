// src/app/guides/[slug]/page.tsx — one guide. Unpublished or unknown slugs are a real 404.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSiteContent } from '@/server/store';
import { renderGuide } from '@/lib/miniMarkdown';
import { SITE } from '@/utils/chatEngine/siteConfig';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
const find = async (slug: string) => (await getSiteContent().catch(() => null))?.guides.find((g) => g.id === slug && g.published) ?? null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await find((await params).slug);
  if (!g) return { title: 'Guide not found', robots: { index: false } };
  return { title: g.title, description: g.summary || g.body.slice(0, 160), alternates: { canonical: `/guides/${g.id}` }, openGraph: { type: 'article', title: g.title, description: g.summary || undefined } };
}

export default async function GuidePage({ params }: Props) {
  const g = await find((await params).slug);
  if (!g) notFound();
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.summary || undefined, datePublished: g.date || undefined, author: { '@type': 'Organization', name: 'System Portfolio' }, mainEntityOfPage: `${SITE.url}/guides/${g.id}` };
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <Link href="/guides" className="font-mono text-xs text-zinc-500 hover:text-accent">← ALL_GUIDES</Link>
      <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-zinc-100 sm:text-4xl">{g.title}</h1>
      {g.date && <time dateTime={g.date} className="mt-2 block font-mono text-xs text-zinc-500">{g.date}</time>}
      {g.summary && <p className="mt-4 text-base leading-relaxed text-zinc-400">{g.summary}</p>}
      <div className="mt-2 text-[15px]">{renderGuide(g.body)}</div>
      <div className="mt-12 rounded-2xl border border-accent/30 bg-accent/[0.05] p-5 text-center">
        <p className="text-sm font-semibold text-zinc-100">Need help with this?</p>
        <p className="mt-1 text-xs text-zinc-400">Send us the details and we will quote before any work starts.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/contact" className="inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-5 font-mono text-xs font-semibold text-black hover:bg-accent">CONTACT_US</Link>
          {hasWhatsApp() && <a href={whatsappLink(`Hello, I read your guide "${g.title}" and need help.`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-emerald-500/50 px-5 text-xs text-emerald-300 hover:bg-emerald-500/10">WhatsApp</a>}
        </div>
      </div>
    </article>
  );
}
