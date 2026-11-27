import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Art',
  description: 'Graphic design work: logos, branding, posters, social media and illustration.',
  alternates: { canonical: '/art' },
};
export default function ArtLayout({ children }: { children: React.ReactNode }) { return children; }
