// src/context/SiteContentContext.tsx — the owner-editable trust content (reviews, prices, FAQ…), available to every page (see lib/siteContent.ts).
'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { DEFAULT_CONTENT, contentFacts, type SiteContent } from '@/lib/siteContent';
import { setOwnerFacts } from '@/utils/chatEngine/promptBuilder';

const Ctx = createContext<SiteContent>(DEFAULT_CONTENT);
export const useSiteContent = () => useContext(Ctx);
export function SiteContentProvider({ content, children }: { content: SiteContent; children: ReactNode }) {
  useEffect(() => { setOwnerFacts(contentFacts(content)); }, [content]);
  return <Ctx.Provider value={content}>{children}</Ctx.Provider>;
}
