import { admin } from '@/lib/admin/api';
import { auditPaths } from '@/lib/admin/health';
import { ROUTES } from '@/lib/siteMap';
import { ALL_PROJECTS } from '@/data/portfolioData';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const GET = admin(async ({ req, url }) => {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;
  const paths = [...ROUTES.map((r) => r.path), ...ALL_PROJECTS.slice(0, 6).map((p) => `/portfolio/${p.id}`)];
  const pages = await auditPaths(origin, paths);
  const avg = pages.length ? Math.round(pages.reduce((a, p) => a + p.score, 0) / pages.length) : 0;
  return { origin, pages, avg, at: Date.now() };
});
