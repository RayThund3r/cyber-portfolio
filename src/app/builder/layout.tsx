import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Website Template Builder — customize & download',
  description: 'Pick a website template, customize everything with no code — text, photos, colours, sections — then download your finished website as a zip.',
  alternates: { canonical: '/builder' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
