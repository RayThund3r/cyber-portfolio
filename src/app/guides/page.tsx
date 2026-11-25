// src/app/guides/page.tsx — short how-to articles the owner writes in Admin → Content → Guides. Server-rendered so Google can read them.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteContent } from '@/server/store';

export const metadata: Metadata = {
  title: 'Guides',
  description: 'Simple, practical guides on phone and computer repair, websites and design, written for people in Uganda.',
  alternates: { canonical: '/guides' },
};
export const dynamic = 'force-dynamic';

export default async function GuidesPage() {
  const guides = (await getSiteContent().catch(() => null))?.guides.filter((g) => g.published).sort((a, b) => b.date.localeCompare(a.date)) ?? [];
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent sm:text-xs">[SECTION // KNOWLEDGE_BASE]</div>
      <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl">Guides</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">Straight answers to common phone, computer, website and design questions.</p>
      {guides.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">New guides are on the way. In the meantime, <Link href="/contact" className="text-accent underline">ask us anything</Link>.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {guides.map((g) => (
            <li key={g.id}>
              <Link href={`/guides/${g.id}`} className="block rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 transition hover:border-accent/50">
                <h2 className="text-lg font-bold text-zinc-100">{g.title}</h2>
                {g.summary && <p className="mt-1 text-sm leading-relaxed text-zinc-400">{g.summary}</p>}
                <span className="mt-3 inline-block font-mono text-xs text-accent">READ_GUIDE →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
