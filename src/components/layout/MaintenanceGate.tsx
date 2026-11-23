// src/components/layout/MaintenanceGate.tsx
//
// When maintenance mode is on (Admin → SETTINGS) visitors see a friendly message instead of the pages. The admin area, the sign-in
// and the API keep working, so the owner can always get in and switch it off.
'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { useSiteSettings } from '@/context/SiteSettingsContext';

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const { maintenance, business } = useSiteSettings();
  const path = usePathname() || '';
  if (!maintenance.enabled || path === '/admin' || path.startsWith('/admin/')) return <>{children}</>;
  return (
    <div role="status" className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent"><Icon name="wrench" size={28} /></span>
      <h1 className="text-2xl font-bold text-zinc-100">{business.name || 'We will be right back'}</h1>
      <p className="text-zinc-400">{maintenance.message}</p>
      {business.whatsapp && <a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded border border-emerald-500/50 px-4 text-sm text-emerald-400"><Icon name="message-circle" /> Message us on WhatsApp</a>}
    </div>
  );
}
