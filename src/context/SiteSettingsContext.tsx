// src/context/SiteSettingsContext.tsx — the owner-editable site settings, available to every page (see lib/siteSettings.ts).
'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type SiteSettings } from '@/lib/siteSettings';
import { applySiteOverrides } from '@/utils/chatEngine/siteConfig';

const Ctx = createContext<SiteSettings>(DEFAULT_SETTINGS);
export const useSiteSettings = () => useContext(Ctx);

export function SiteSettingsProvider({ settings, children }: { settings: SiteSettings; children: ReactNode }) {
  // the chat assistant and WhatsApp links read these too, so what the owner types here is what visitors get everywhere
  const o = { whatsapp: settings.business.whatsapp, email: settings.business.email, hours: settings.business.hours, location: settings.business.address };
  applySiteOverrides(o);
  useEffect(() => { applySiteOverrides(o); }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>;
}
