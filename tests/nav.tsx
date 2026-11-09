import React, { useEffect, useState } from 'react';
export const go = (url: string) => { history.pushState(null, '', url); window.dispatchEvent(new Event('app:nav')); };
const useLoc = () => { const [, f] = useState(0); useEffect(() => { const h = () => f((n) => n + 1); window.addEventListener('app:nav', h); window.addEventListener('popstate', h); return () => { window.removeEventListener('app:nav', h); window.removeEventListener('popstate', h); }; }, []); return location; };
export const useRouter = () => ({ push: go, replace: (u: string) => { history.replaceState(null, '', u); window.dispatchEvent(new Event('app:nav')); }, back: () => history.back(), refresh() {}, prefetch() {} });
export const usePathname = () => useLoc().pathname;
export const useSearchParams = () => new URLSearchParams(useLoc().search);
export const notFound = () => { throw new Error('not found'); };
export default function Link({ href, children, onClick, ...p }: any) { return <a href={String(href)} onClick={(e) => { onClick?.(e); if (e.defaultPrevented || e.metaKey || e.ctrlKey || p.target) return; if (String(href).startsWith('/')) { e.preventDefault(); go(String(href)); } }} {...p}>{children}</a>; }
