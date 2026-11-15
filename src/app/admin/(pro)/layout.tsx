// The extra admin tools (analytics, chat lab, site, health, security, board, shell, lab) share one frame.
// /admin itself (requests, bookings, portfolio, builder, studio) keeps its own page and login.
import AdminShell from '@/components/admin/AdminShell';
import AdminEggs from '@/components/admin/AdminEggs';

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}<AdminEggs /></AdminShell>;
}
