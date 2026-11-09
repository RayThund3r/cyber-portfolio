// src/context/ProjectsContext.tsx — portfolio data from the CMS (falls back to the built-in list).
'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ProjectItem } from '@/data/portfolioData';

interface Ctx { all: ProjectItem[]; featured: ProjectItem[] }
const ProjectsCtx = createContext<Ctx | null>(null);

export function ProjectsProvider({ projects, children }: { projects: ProjectItem[]; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => {
    const flagged = projects.filter((p) => p.featured);
    return { all: projects, featured: (flagged.length ? flagged : projects).slice(0, 3) };
  }, [projects]);
  return <ProjectsCtx.Provider value={value}>{children}</ProjectsCtx.Provider>;
}

export function useProjects(): Ctx {
  const c = useContext(ProjectsCtx);
  if (!c) throw new Error('useProjects must be used within a ProjectsProvider');
  return c;
}
