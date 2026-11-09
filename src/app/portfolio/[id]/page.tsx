// src/app/portfolio/[id]/page.tsx
//
// Project deep-dive. The page-level nav that used to live here is gone (the shared SiteNav in
// layout.tsx covers it); this page keeps a breadcrumb row plus previous / next project links.
'use client';

import { use } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { notFound } from 'next/navigation';
import { useProjects } from '@/context/ProjectsContext';
import ProjectImage from '@/components/ProjectImage';
import { portfolioUrl } from '@/lib/siteUrls';

export default function ProjectDeepDivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Projects come from the CMS (/admin) and fall back to the built-in list.
  const { all } = useProjects();
  const index = all.findIndex((p) => p.id === id);

  if (index < 0) notFound();

  const project = all[index];
  const prev = all[(index - 1 + all.length) % all.length];
  const next = all[(index + 1) % all.length];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center justify-between gap-3 font-mono text-xs">
        <Link href={portfolioUrl()} className="inline-flex min-h-10 items-center gap-1.5 text-accent transition-opacity hover:opacity-80">
          <span aria-hidden="true">←</span> BACK_TO_ARCHIVE
        </Link>
        <span className="truncate text-zinc-500">SECURE_MODULE // ID: {project.id}</span>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header metadata */}
        <div className="mb-4 flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="rounded border border-accent/30 bg-accent/10 px-3 py-1 text-accent">[{project.category}]</span>
          <span className="text-zinc-500" aria-hidden="true">•</span>
          <span className="text-zinc-400">{project.clientType || 'Technical Service'}</span>
        </div>

        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-5xl">{project.title}</h1>

        <p className="mb-8 rounded-r border-l-2 border-accent bg-zinc-900/30 py-2 pl-4 text-base leading-relaxed text-zinc-300 sm:text-lg">
          {project.description}
        </p>

        {/* Hero image */}
        <div data-reveal className="relative mb-10 h-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 sm:h-96">
          <ProjectImage src={project.image} alt={project.title} sizes="(min-width: 1024px) 1024px, 100vw" priority className="object-cover" />
        </div>

        {project.liveUrl?.startsWith('/demo/') && (
          <section data-reveal className="mb-10" aria-label="Live preview">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent">[LIVE PREVIEW // TRY IT]</div>
            <div className="mx-auto w-full max-w-[380px] rounded-[2.2rem] border-4 border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
              <iframe src={project.liveUrl} title={`${project.title} live preview`} loading="lazy" className="h-[640px] w-full rounded-[1.7rem] border-0 bg-white" />
            </div>
            <p className="mt-3 text-center font-mono text-[11px] text-zinc-500">This is the real, working site. Scroll, open products, switch language or theme.</p>
          </section>
        )}

        {/* Stats */}
        <div className="mb-12 grid grid-cols-1 gap-4 font-mono text-xs sm:grid-cols-2">
          {project.liveUrl && (
            <div data-reveal className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 sm:col-span-2">
              <span className="mb-1 block text-emerald-400">LIVE SITE</span>
              <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-emerald-300 underline">Open the working website ↗</a>
            </div>
          )}
          {/* Only shown when a real result has been entered for the project */}
          {project.metrics && (
            <div data-reveal className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="mb-1 block text-zinc-500">RESULT</span>
              <span className="text-sm font-semibold text-accent">{project.metrics}</span>
            </div>
          )}
          <div data-reveal className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <span className="mb-1 block text-zinc-500">DEPLOYED TOOLCHAIN</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(project.tools ?? []).map((tool, idx) => (
                <span key={idx} className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-zinc-300">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Process */}
        <section className="mb-14 space-y-8">
          <h2 className="flex items-center gap-2 border-b border-zinc-900 pb-3 font-mono text-lg font-bold text-zinc-100 sm:text-xl">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
            TECHNICAL EXECUTION GUIDE &amp; PROCESS
          </h2>
          <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
            {[
              ['01. Initial Diagnostics & Requirements Scope', 'Every operational module starts with rigorous scoping. For this project, parameters were mapped out to ensure high reliability, zero latency overhead, and optimal compatibility across target deployment platforms.'],
              ['02. Implementation & Asset Optimization', 'Utilizing industry-standard tooling, assets were structured, formatted, and fine-tuned. Code architecture and layout spacing were cross-checked to meet rigorous performance standards.'],
              ['03. Final Deployment & Quality Assurance', 'Post-implementation testing guarantees robust performance under stress loads, ensuring seamless user experiences and professional polish.'],
            ].map(([title, body]) => (
              <div key={title} data-reveal className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 sm:p-6">
                <h3 className="mb-2 font-mono font-semibold text-accent">{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feedback */}
        <section className="mb-14">
          <h2 className="mb-6 flex items-center gap-2 border-b border-zinc-900 pb-3 font-mono text-lg font-bold text-zinc-100 sm:text-xl">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
            VERIFIED CLIENT FEEDBACK
          </h2>
          <blockquote data-reveal className="relative rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-8">
            <span className="absolute right-6 top-4 font-serif text-5xl text-zinc-800" aria-hidden="true">“</span>
            <p className="relative z-10 mb-4 text-sm italic text-zinc-200 sm:text-base">
              &ldquo;The precision and speed delivered on this module completely exceeded expectations. The workflow integration was smooth, professional, and built to absolute perfection.&rdquo;
            </p>
            <footer className="font-mono text-xs text-accent">— Verified Project Stakeholder &amp; Partner</footer>
          </blockquote>
        </section>

        {/* Previous / next */}
        <nav aria-label="More projects" className="mb-8 grid grid-cols-2 gap-3 font-mono text-xs">
          <Link
            href={`/portfolio/${prev.id}`}
            className="group rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-accent/40"
          >
            <span className="block text-zinc-500">← PREVIOUS</span>
            <span className="mt-1 line-clamp-2 block text-zinc-200 group-hover:text-accent">{prev.title}</span>
          </Link>
          <Link
            href={`/portfolio/${next.id}`}
            className="group rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-right transition-colors hover:border-accent/40"
          >
            <span className="block text-zinc-500">NEXT →</span>
            <span className="mt-1 line-clamp-2 block text-zinc-200 group-hover:text-accent">{next.title}</span>
          </Link>
        </nav>

        {/* Action footer */}
        <div className="flex flex-col items-stretch justify-between gap-4 border-t border-zinc-900 pt-8 sm:flex-row sm:items-center">
          <Link href={portfolioUrl()} className="inline-flex min-h-10 items-center font-mono text-xs text-zinc-400 transition-colors hover:text-accent">
            ← RETURN TO ARCHIVE GRID
          </Link>
          <Link
            href="/contact"
            className="touch-target inline-flex items-center justify-center rounded bg-accent-strong px-6 py-3 text-center font-mono text-xs font-semibold text-black transition-all duration-300 hover:bg-accent glow-accent"
          >
            INITIATE_SIMILAR_PROJECT →
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
