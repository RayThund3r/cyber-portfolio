// src/lib/siteMap.ts
//
// Single source of truth for the site's routes and anchor ids. The navigation, footer and the
// chat assistant (which can navigate for the visitor) all read this.

export interface RouteInfo {
  path: string;
  label: string;
  title: string;
  /** Words visitors use for this page; the chat uses them to understand "take me to ..." */
  aliases: string[];
}

export const ROUTES: RouteInfo[] = [
  { path: '/', label: 'HOME', title: 'Home', aliases: ['home', 'homepage', 'home page', 'main page', 'landing', 'start', 'root', 'top page'] },
  { path: '/portfolio', label: 'PORTFOLIO', title: 'Portfolio archive', aliases: ['portfolio', 'archive', 'projects', 'project page', 'work', 'my work', 'gallery', 'showcase', 'case studies'] },
  { path: '/services', label: 'SERVICES', title: 'Services', aliases: ['services', 'service page', 'what you offer', 'offerings', 'pricing page', 'rates page', 'timelines'] },
  { path: '/contact', label: 'CONTACT', title: 'Contact', aliases: ['contact', 'contact page', 'contact form', 'form', 'booking', 'book', 'hire', 'get in touch', 'inquiry'] },
  { path: '/games', label: 'GAMES', title: 'Games', aliases: ['games', 'game page', 'games page', 'arcade', 'brain games', 'play'] },
];

/** Anchor ids that exist on the home page. */
export const HOME_SECTIONS: Record<string, { id: string; aliases: string[] }> = {
  terminal: { id: 'terminal', aliases: ['terminal', 'command line', 'console', 'cli'] },
  stack: { id: 'stack', aliases: ['stack', 'tech stack', 'skills', 'capabilities', 'tools', 'proficiencies'] },
  projects: { id: 'projects', aliases: ['featured projects', 'featured work', 'featured', 'previews'] },
};

export const CATEGORIES = ['UI/UX', 'BRANDING', 'WEBAPP', 'HARDWARE'] as const;
export type Category = (typeof CATEGORIES)[number];

export function isActivePath(current: string | null, path: string): boolean {
  if (!current) return false;
  if (path === '/') return current === '/';
  return current === path || current.startsWith(path + '/');
}
