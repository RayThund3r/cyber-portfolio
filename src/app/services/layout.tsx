import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services — Repair, Design & Web',
  description: 'Phone and PC repair, graphic and brand design, embroidery file preparation and web development in Ndejje, Uganda.',
  alternates: { canonical: '/services' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
