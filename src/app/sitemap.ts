import type { MetadataRoute } from 'next';
import { SITE } from '@/utils/chatEngine/siteConfig';
import { getProjects, getSiteContent } from '@/server/store';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = ['', '/portfolio', '/services', '/builder', '/contact', '/guides', '/track', '/privacy'].map((p) => ({
    url: `${SITE.url}${p}`, lastModified: now, changeFrequency: 'monthly' as const, priority: p === '' ? 1 : 0.7,
  }));
  const projects = (await getProjects()).map((p) => ({
    url: `${SITE.url}/portfolio/${p.id}`, lastModified: now, changeFrequency: 'yearly' as const, priority: 0.5,
  }));
  const guides = (await getSiteContent().catch(() => null))?.guides.filter((g) => g.published).map((g) => ({ url: `${SITE.url}/guides/${g.id}`, lastModified: g.date ? new Date(g.date) : now, changeFrequency: 'monthly' as const, priority: 0.6 })) ?? [];
  return [...pages, ...projects, ...guides];
}
