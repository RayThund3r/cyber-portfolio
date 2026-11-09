import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portfolio',
  description: 'Selected branding, UI/UX, web and technical projects.',
  alternates: { canonical: '/portfolio' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
