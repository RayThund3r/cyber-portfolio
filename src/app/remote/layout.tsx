import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Remote Support — Fix Your Computer From Home',
  description: 'Slow computer, viruses, setup help or software problems fixed remotely, with clear prices and no travel. Based in Ndejje, Uganda.',
  alternates: { canonical: '/remote' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
