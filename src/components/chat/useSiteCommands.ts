// src/components/chat/useSiteCommands.ts
//
// Executes a SiteCommand (produced by the chat engine) against the real site: client-side route
// changes, smooth scrolling, theme changes. Returns whether the command moved the visitor to
// something they now need to SEE — the widget uses that to tuck itself away on phones.
'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { SiteCommand } from '@/utils/chatEngine/types';
import { contactUrl, portfolioUrl } from '@/lib/siteUrls';
import { runInTerminal } from '@/lib/terminalBus';

/** Sections render after a route change, so wait (briefly) for the element before scrolling. */
function scrollToIdWhenReady(id: string, tries = 30, firstDelay = 0) {
  const attempt = (left: number) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (left > 0) window.setTimeout(() => attempt(left - 1), 80);
  };
  // After a route change Next resets scroll to the top as the page commits; scrolling a few
  // hundred ms later means our smooth scroll is not immediately undone by that reset.
  if (firstDelay > 0) window.setTimeout(() => attempt(tries), firstDelay);
  else attempt(tries);
}

export function useSiteCommands() {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme, cycleTheme } = useTheme();

  /** @returns true when the visitor should now look at the page (navigation / scroll). */
  const run = useCallback(
    (cmd: SiteCommand): boolean => {
      switch (cmd.type) {
        case 'navigate':
          if (pathname === cmd.path) window.scrollTo({ top: 0, behavior: 'smooth' });
          else router.push(cmd.path);
          return true;

        case 'scroll':
          if (pathname === '/') {
            scrollToIdWhenReady(cmd.id);
          } else {
            router.push('/');
            scrollToIdWhenReady(cmd.id, 40, 350); // waits for the home page to mount + settle
          }
          return true;

        case 'portfolio':
          router.push(portfolioUrl({ category: cmd.category, query: cmd.query }));
          return true;

        case 'project':
          router.push(cmd.view === 'page' ? `/portfolio/${cmd.id}` : portfolioUrl({ open: cmd.id }));
          return true;

        case 'contact':
          router.push(contactUrl(cmd.kind, true));
          return true;

        case 'theme':
          if (cmd.theme) setTheme(cmd.theme);
          else cycleTheme();
          return false; // the visitor stays where they are

        case 'top':
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return true;

        case 'bottom':
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
          return true;

        case 'back':
          if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
          else router.push('/');
          return true;

        case 'terminal':
          if (pathname !== '/') router.push('/');
          scrollToIdWhenReady('terminal', 40, pathname === '/' ? 0 : 350);
          if (cmd.cmd) {
            const c = cmd.cmd;
            // Wait for the scroll / route change, then type it in; the terminal also queues it if it is not mounted yet.
            window.setTimeout(() => runInTerminal(c), pathname === '/' ? 500 : 900);
          }
          return true;

        case 'close-chat':
          return false; // handled by the widget itself
      }
    },
    [router, pathname, setTheme, cycleTheme]
  );

  return { run, pathname };
}
