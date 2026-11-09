// src/utils/useProjectRef.ts
//
// Resolves WHICH customer site to open from the URL (?id=…&key=…) or from this browser's saved list.
//
// Two fixes are combined here:
//  • "project doesn't exist": React runs effects twice in development. The key is remembered BEFORE it is removed from
//    the address bar, and the whole lookup is idempotent (a second run can never find the key already gone).
//  • blocked storage (private browsing): the key goes to localStorage, then sessionStorage, then memory (lib/builder/access.ts),
//    and is only removed from the address bar once it is really remembered — otherwise a reload would lose the site.
'use client';

import { useEffect, useState } from 'react';
import { findProject, forgetProject as forget, listProjects, rememberProject as remember, type SavedProject } from '@/lib/builder/access';

export type { SavedProject };
export type ProjectRef = { id: string; key: string } | 'bad' | undefined; // undefined = still resolving ('bad' = needs the recovery screen)

export const readSaved = (): SavedProject[] => listProjects();
export const forgetProject = (id: string) => forget(id);
export function rememberProject(p: Partial<SavedProject> & { id: string; key: string }): boolean {
  const prev = findProject(p.id);
  return remember({ id: p.id, key: p.key, name: p.name || prev?.name || p.id, template: p.template || prev?.template || '' });
}

export function useProjectRef(): ProjectRef {
  const [ref, setRef] = useState<ProjectRef>(undefined);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = (q.get('id') || '').toUpperCase();
    const key = q.get('key') || '';
    if (id && key) {
      const persisted = rememberProject({ id, key });
      if (persisted && findProject(id)?.key === key) {
        try { window.history.replaceState(null, '', `${window.location.pathname}?id=${encodeURIComponent(id)}`); } catch { /* ignore */ }
      }
      setRef({ id, key });
      return;
    }
    const saved = id ? findProject(id) : undefined;
    setRef(saved ? { id: saved.id, key: saved.key } : 'bad');
  }, []);
  return ref;
}
