import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track your request',
  description: 'Check the status of your repair or design request.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
