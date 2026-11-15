// src/components/builder/ProContent.tsx — edits a Pro (shop / booking / quote) site: one collapsible group per part of the site,
// rendered from the same schema (PRO_GROUPS) that drives validation, the generator and the AI.
'use client';

import { useState, type ReactElement } from 'react';
import { PRO_GROUPS } from '@/lib/builder/pro';
import { FieldForm } from './FieldForm';
import type { EditorApi } from './editorApi';
import { IconBulb, IconCaretDown, IconCaretRight, IconCart, IconClock, IconHome, IconImage, IconLayers, IconLock, IconMessage, IconPalette, IconPencil, IconPhoneCall, IconSearch, IconSettings, IconSparkle, IconTag } from './icons';

const GROUP_ICON: Record<string, (p: { size?: number }) => ReactElement> = {
  setup: IconLayers, business: IconHome, look: IconPalette, hero: IconImage, about: IconPencil, services: IconTag, catalog: IconCart, booking: IconClock,
  gallery: IconImage, reviews: IconMessage, faq: IconBulb, contact: IconPhoneCall, features: IconSettings, owner: IconLock, seo: IconSearch,
};

const SECTION_OF: Record<string, string> = { hero: 'home', about: 'about', services: 'services', catalog: 'catalog', gallery: 'gallery', reviews: 'testimonials', faq: 'faq', contact: 'contact' };

export default function ProContent({ api, goSection }: { api: EditorApi; goSection: (sec: string) => void }) {
  const pro = api.cfg.pro!;
  const mode = pro.setup.mode as string;
  const [open, setOpen] = useState<string | null>('setup');

  const relevant = (id: string) => (id === 'catalog' ? mode === 'shop' : id === 'booking' ? mode === 'book' || mode === 'quote' : true);
  const toggle = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) { const sec = id === 'booking' ? (mode === 'quote' ? 'quote' : 'book') : SECTION_OF[id]; if (sec) goSection(sec); }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-zinc-500">Open a group to edit it — the preview jumps to that part of your site. Everything saves automatically.</p>
      {PRO_GROUPS.filter((g) => relevant(g.id)).map((g) => {
        const isOpen = open === g.id;
        return (
          <section key={g.id} className={`rounded-lg border ${isOpen ? 'border-cyan-500/50' : 'border-zinc-800'} bg-zinc-900/40`}>
            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer" aria-expanded={isOpen} onClick={() => toggle(g.id)}>
              <span className="text-cyan-400">{(() => { const I = GROUP_ICON[g.id] || IconSparkle; return <I size={18} />; })()}</span><span className="flex-1 text-sm font-semibold">{g.title}</span><span className="text-zinc-500 text-xs">{isOpen ? <IconCaretDown /> : <IconCaretRight />}</span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-zinc-800 space-y-3">
                {g.help && <p className="text-[11px] text-zinc-400">{g.help}</p>}
                <FieldForm fields={g.fields} value={pro[g.id]} ctx={api.ctx} tag={`pro.${g.id}`} onChange={(nv, tag) => api.edit(tag, (c) => { if (c.pro) c.pro[g.id] = nv; })} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
