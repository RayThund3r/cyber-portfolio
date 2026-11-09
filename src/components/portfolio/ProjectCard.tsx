// src/components/portfolio/ProjectCard.tsx
//
// One card in the archive grid. Memoised so the grid doesn't re-render while the project popup
// (which now owns its own gallery state) is animating its slideshow.
'use client';

import { forwardRef, memo } from 'react';
import { motion } from 'framer-motion';
import type { ProjectItem } from '@/data/portfolioData';
import ProjectImage from '@/components/ProjectImage';

interface Props {
  project: ProjectItem;
  /** Position in the visible grid: the first row loads eagerly (helps first paint). */
  index: number;
  onOpen: (id: string) => void;
}

// forwardRef is required: AnimatePresence (popLayout) measures its direct children by ref.
const ProjectCard = forwardRef<HTMLDivElement, Props>(function ProjectCard({ project, index, onOpen }, ref) {
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
      onClick={() => onOpen(project.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(project.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open project ${project.id}: ${project.title}`}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 transition-colors duration-300 hover:border-accent/40 hover:shadow-2xl focus-visible:border-accent/60"
    >
      <div>
        <div className="relative h-52 overflow-hidden bg-zinc-950">
          {/* next/image: resized to the screen, lazy-loaded; the first row is prioritised for faster first paint */}
          <ProjectImage
            src={project.image}
            alt={project.title}
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            priority={index < 3}
            className="object-cover opacity-75 transition-transform duration-700 group-hover:scale-110 group-hover:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60" />
          <div className="absolute left-3 top-3 rounded border border-zinc-800 bg-zinc-950/90 px-2.5 py-1 font-mono text-[10px] text-accent backdrop-blur-md">
            [{project.category}]
          </div>
        </div>
        <div className="p-5">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
            <span>ID: {project.id}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 transition-colors group-hover:bg-accent" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 transition-colors duration-300 group-hover:text-accent">{project.title}</h3>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">{project.description}</p>

          {project.tools && project.tools.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {project.tools.map((tool) => (
                <span key={tool} className="rounded border border-zinc-800/80 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                  {tool}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-800/50 p-5 pt-4">
        <span className="font-mono text-[10px] text-accent opacity-80">{project.metrics ?? project.category}</span>
        <span className="inline-flex items-center gap-1 font-mono text-xs text-zinc-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-accent">
          INSPECT <span aria-hidden="true">→</span>
        </span>
      </div>
    </motion.div>
  );
});

export default memo(ProjectCard);
