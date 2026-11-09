import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Edit your website', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
