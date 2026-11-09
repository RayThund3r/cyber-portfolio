import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact & Booking',
  description: 'Request a phone/PC repair or start a design or web project. Send details by form or WhatsApp and get a reply.',
  alternates: { canonical: '/contact' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
