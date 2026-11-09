// src/app/template.tsx
//
// Page transition. It used framer-motion with `initial={{ opacity: 0 }}`, which put opacity:0 into the
// server-rendered HTML — on a slow phone the page stayed blank until JavaScript hydrated, and
// reduced-motion visitors got the animation anyway (`exit` also does nothing in the App Router).
// This version is pure CSS (see .animate-page-in in globals.css): it plays on first paint with no
// JavaScript and is switched off by the prefers-reduced-motion block.

export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in flex flex-1 flex-col">{children}</div>;
}
