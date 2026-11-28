// src/components/site/ActionBar.tsx — phones only: Call, WhatsApp and Book pinned to the bottom of every public page, so a visitor
// is always one tap from reaching you. The number and WhatsApp come from Admin → Settings; a button with no data is left out.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';

const HIDE_ON = ['/contact', '/track'];
const BAR_H = '4.5rem';

export default function ActionBar() {
  const { business } = useSiteSettings();
  const path = usePathname() || '';
  const [ready, setReady] = useState(false);
  const [typing, setTyping] = useState(false);
  const hidden = HIDE_ON.some((p) => path === p || path.startsWith(`${p}/`));
  const tel = (business.phone || '').replace(/[^\d+]/g, '');
  const wa = hasWhatsApp() ? whatsappLink('Hello, I found you on your website. ') : '';

  useEffect(() => { const t = window.setTimeout(() => setReady(true), 700); return () => window.clearTimeout(t); }, []);
  // the on-screen keyboard must not push the bar over a form
  useEffect(() => {
    const on = (e: FocusEvent) => { const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) setTyping(true); };
    const off = () => setTyping(false);
    document.addEventListener('focusin', on); document.addEventListener('focusout', off);
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); };
  }, []);
  const show = ready && !typing && !hidden;
  // the chat button and the back-to-top button rise above the bar (see --bar-h in ChatLauncher / BackToTop)
  useEffect(() => {
    const root = document.documentElement;
    if (show) root.style.setProperty('--bar-h', BAR_H); else root.style.removeProperty('--bar-h');
    return () => root.style.removeProperty('--bar-h');
  }, [show]);

  const item = 'flex min-h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-zinc-200 transition active:scale-95 active:bg-white/10';
  return (
    <>
      {!hidden && <div aria-hidden="true" className="h-[4.5rem] sm:hidden" />}
      <nav aria-label="Quick contact" className={`fixed inset-x-3 z-50 flex gap-1 rounded-2xl border border-white/10 bg-zinc-950/85 p-1.5 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-[transform,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)] sm:hidden motion-reduce:transition-none ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
        style={{ bottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
        {tel.length >= 6 && <a href={`tel:${tel}`} className={item}><Icon name="phone" size={18} className="text-accent" />Call</a>}
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={item}><Icon name="chat" size={18} className="text-emerald-400" />WhatsApp</a>}
        <Link href="/contact?type=repair" className={`${item} !flex-[1.3] rounded-xl bg-accent-strong !text-black active:!bg-accent`}><Icon name="wrench" size={18} />Book a repair</Link>
      </nav>
    </>
  );
}
