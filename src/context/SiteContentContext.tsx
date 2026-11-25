// src/context/SiteContentContext.tsx — the owner-editable trust content (reviews, prices, FAQ…), available to every page (see lib/siteContent.ts).
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_CONTENT, type SiteContent } from '@/lib/siteContent';

const Ctx = createContext<SiteContent>(DEFAULT_CONTENT);
export const useSiteContent = () => useContext(Ctx);
export function SiteContentProvider({ content, children }: { content: SiteContent; children: ReactNode }) {
  return <Ctx.Provider value={content}>{children}</Ctx.Provider>;
}
