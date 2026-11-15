import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Website Template Builder — customize & download',
  description: 'Pick a website template, customize everything with no code — text, photos, colours, sections — then download your finished website as a zip.',
  alternates: { canonical: '/builder' },
};

const CSS = `
.bld-skel{background:linear-gradient(90deg,#18181b 0%,#27272a 50%,#18181b 100%);background-size:220% 100%;animation:bld-shimmer 1.5s linear infinite}
@keyframes bld-shimmer{to{background-position:-220% 0}}
@keyframes bld-sheet{from{transform:translateY(28px);opacity:0}to{transform:none;opacity:1}}
@keyframes bld-fade{from{opacity:0}to{opacity:1}}
@keyframes bld-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes bld-pulse-ring{0%{box-shadow:0 0 0 0 rgba(34,211,238,.45)}100%{box-shadow:0 0 0 12px rgba(34,211,238,0)}}
.bld-sheet{animation:bld-sheet .24s cubic-bezier(.2,.8,.2,1) both}
.bld-fade{animation:bld-fade .2s ease-out both}
.bld-pop{animation:bld-pop .45s cubic-bezier(.2,.8,.2,1) both}
.bld-ring{animation:bld-pulse-ring 1.8s ease-out infinite}
.bld-scan{background-image:linear-gradient(rgba(34,211,238,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.05) 1px,transparent 1px);background-size:28px 28px}
.bld-noscroll-x{overflow-x:clip}
@media (prefers-reduced-motion:reduce){
  .bld-skel{animation:none}
  .bld-sheet,.bld-fade,.bld-pop,.bld-ring{animation:none!important}
  .bld-motion{transition:none!important;transform:none!important}
}
`;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{CSS}</style>
      {children}
    </>
  );
}
