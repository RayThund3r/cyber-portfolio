// src/app/portfolio/page.tsx
//
// The archive. Its state lives in the URL so the chat (and shared links, and the back button) can
// drive it:   /portfolio?cat=BRANDING&q=figma&open=03
'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjects } from '@/context/ProjectsContext';
import { CATEGORIES } from '@/lib/siteMap';
import { parseCategory, portfolioUrl } from '@/lib/siteUrls';
import { openChat } from '@/lib/chatBus';
import ProjectCard from '@/components/portfolio/ProjectCard';
import ProjectModal from '@/components/portfolio/ProjectModal';

const FILTERS = ['ALL', ...CATEGORIES] as const;

function PortfolioInner() {
  // Projects come from the CMS (/admin) and fall back to the built-in list.
  const { all: ALL_PROJECTS } = useProjects();
  /** How many projects each filter chip will show. */
  const categoryCounts = useMemo(
    () => ALL_PROJECTS.reduce((acc, p) => ({ ...acc, [p.category]: (acc[p.category] ?? 0) + 1 }), { ALL: ALL_PROJECTS.length } as Record<string, number>),
    [ALL_PROJECTS]
  );
  const router = useRouter();
  const params = useSearchParams();

  // --- URL is the source of truth for category + open project ---
  const selectedCategory = parseCategory(params.get('cat') ?? params.get('category'));
  const urlQuery = params.get('q') ?? '';
  const openId = params.get('open');
  const activeModalProject = useMemo(() => ALL_PROJECTS.find((p) => p.id === openId) ?? null, [ALL_PROJECTS, openId]);

  // --- search text: local so typing is instant, mirrored into the URL (debounced) ---
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const lastWritten = useRef(urlQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // A change we did not make ourselves (the chat searched, or back/forward) -> adopt it.
    if (urlQuery !== lastWritten.current) {
      // Never overwrite text the visitor is typing right now (a slow earlier URL update could
      // otherwise land after newer keystrokes and revert the box).
      if (document.activeElement === searchInputRef.current) return;
      lastWritten.current = urlQuery;
      setSearchQuery(urlQuery);
    }
  }, [urlQuery]);

  const writeUrl = useCallback(
    (next: { cat?: string; q?: string; open?: string | null }, mode: 'push' | 'replace' = 'replace') => {
      const url = portfolioUrl({
        category: next.cat ?? selectedCategory,
        query: next.q ?? searchQuery,
        open: next.open === undefined ? openId ?? undefined : next.open ?? undefined,
      });
      if (next.q !== undefined) lastWritten.current = next.q.trim().slice(0, 60);
      router[mode](url, { scroll: false });
    },
    [router, selectedCategory, searchQuery, openId]
  );

  useEffect(() => {
    if (searchQuery.trim().slice(0, 60) === urlQuery) return;
    const t = window.setTimeout(() => writeUrl({ q: searchQuery }), 350);
    return () => window.clearTimeout(t);
  }, [searchQuery, urlQuery, writeUrl]);

  const [mounted, setMounted] = useState(false);

  // Portal can only be used after the component has mounted on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter projects based on category and search term
  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ALL_PROJECTS.filter((project) => {
      const matchesCategory = selectedCategory === 'ALL' || project.category === selectedCategory;
      const matchesSearch =
        !query ||
        project.title?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.category.toLowerCase().includes(query) ||
        project.tools?.some((t) => t.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Cards are memoised, so they get one stable callback that always calls the latest writeUrl.
  const writeUrlRef = useRef(writeUrl);
  useEffect(() => {
    writeUrlRef.current = writeUrl;
  });
  const openProject = useCallback((id: string) => writeUrlRef.current({ open: id }, 'push'), []);
  const closeModal = useCallback(() => writeUrl({ open: null }, 'replace'), [writeUrl]);
  const resetFilters = () => {
    setSearchQuery('');
    lastWritten.current = '';
    router.replace(portfolioUrl({ open: openId ?? undefined }), { scroll: false });
  };

  // Previous / next inside the popup: steps through what the grid shows (or everything, when the
  // opened project isn't part of the current filter).
  const stepList = useMemo(
    () => (openId && filteredProjects.some((p) => p.id === openId) ? filteredProjects : ALL_PROJECTS),
    [filteredProjects, openId]
  );
  const position = useMemo(() => {
    if (!activeModalProject) return null;
    const index = stepList.findIndex((p) => p.id === activeModalProject.id);
    return index < 0 ? null : { index, total: stepList.length };
  }, [activeModalProject, stepList]);
  const stepProject = useCallback(
    (dir: -1 | 1) => {
      if (!position) return;
      const next = stepList[(position.index + dir + stepList.length) % stepList.length];
      writeUrl({ open: next.id }, 'replace');
    },
    [position, stepList, writeUrl]
  );

  // "/" jumps to the search box (like most sites with a search field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || activeModalProject) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeModalProject]);

  const filtersActive = selectedCategory !== 'ALL' || searchQuery.trim() !== '';

  return (
    <div className="flex-1 overflow-x-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Header */}
      <header className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-3xl">
          <div className="rise mb-4 inline-flex animate-cyber-glow items-center gap-2 rounded border border-zinc-800 bg-zinc-900/90 px-3 py-1 font-mono text-[10px] text-accent sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            <span>DATABASE: {String(ALL_PROJECTS.length).padStart(2, '0')} OPERATIONAL MODULES LOADED</span>
          </div>
          <h1 className="rise text-3xl font-extrabold tracking-tight text-gradient-zinc sm:text-5xl" style={{ '--d': '90ms' } as React.CSSProperties}>
            Complete Design &amp; Technical Archive
          </h1>
          <p className="rise mt-4 font-sans text-sm leading-relaxed text-zinc-400 sm:text-base" style={{ '--d': '180ms' } as React.CSSProperties}>
            Explore a comprehensive collection of UI/UX layouts, cyber-industrial brand identities, software development setups, and hardware diagnostics systems.
          </p>
        </div>

        {/* Controls bar */}
        <div className="mt-10 flex flex-col items-stretch justify-between gap-4 border-t border-zinc-900 pt-8 lg:flex-row lg:items-center">
          <div
            className="flex flex-wrap gap-2 font-mono text-xs max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1"
            role="group"
            aria-label="Filter by category"
          >
            {FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => writeUrl({ cat: cat === 'ALL' ? '' : cat })}
                className={`min-h-10 rounded border px-3.5 py-2 transition-all duration-300 active:scale-95 max-sm:shrink-0 ${
                  selectedCategory === cat
                    ? 'scale-105 border-accent bg-accent-strong font-semibold text-black glow-accent-md'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                [{cat}]
                <span className={`ml-1.5 ${selectedCategory === cat ? 'opacity-70' : 'text-zinc-600'}`}>{categoryCounts[cat] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search projects"
              placeholder="SEARCH_MODULES..."
              value={searchQuery}
              maxLength={60}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 pr-20 font-mono text-xs text-zinc-100 placeholder-zinc-600 transition-all duration-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            {!searchQuery && (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-zinc-700 px-1.5 font-mono text-[10px] text-zinc-500 lg:block"
              >
                /
              </kbd>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500 transition-colors hover:text-accent max-sm:-mr-2 max-sm:px-2 max-sm:py-3"
              >
                [CLEAR]
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-zinc-500" aria-live="polite">
          <span>
            {filteredProjects.length} / {ALL_PROJECTS.length} MODULES
            {selectedCategory !== 'ALL' ? ` · ${selectedCategory}` : ''}
            {searchQuery.trim() ? ` · "${searchQuery.trim()}"` : ''}
          </span>
          <span className="flex items-center gap-4">
            {filtersActive && (
              <button type="button" onClick={resetFilters} className="transition-colors hover:text-accent max-sm:py-2">
                [RESET]
              </button>
            )}
            <button type="button" onClick={() => openChat({ prefill: 'Show me ' })} className="transition-colors hover:text-accent max-sm:py-2">
              💬 ask the assistant
            </button>
          </span>
        </div>
      </header>

      {/* Projects grid with fluid layout animations */}
      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-8">
        {filteredProjects.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-zinc-900 bg-zinc-900/20 py-20 text-center font-mono">
            <p className="text-sm text-zinc-400">NO MATCHING OPERATIONAL MODULES FOUND.</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent transition-all duration-300 hover:scale-105"
            >
              RESET_FILTERS
            </button>
            <button type="button" onClick={() => openChat({ prefill: 'Show me ' })} className="mt-3 block w-full py-2 text-xs text-zinc-500 transition-colors hover:text-accent">
              or ask the assistant to find it →
            </button>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} onOpen={openProject} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Modal: rendered in a portal on document.body so no transformed ancestor
          (like the page-transition wrapper) can offset its fixed positioning */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {activeModalProject && (
              <ProjectModal project={activeModalProject} position={position} onClose={closeModal} onStep={stepProject} />
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

export default function PortfolioPage() {
  // useSearchParams() needs a Suspense boundary so the page can still be pre-rendered.
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-24 font-mono text-xs tracking-widest text-accent" role="status">
          LOADING_ARCHIVE...
        </div>
      }
    >
      <PortfolioInner />
    </Suspense>
  );
}
