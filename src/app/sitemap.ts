import type { MetadataRoute } from 'next';
import { SITE } from '@/utils/chatEngine/siteConfig';
import { getProjects } from '@/server/store';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = ['', '/portfolio', '/services', '/builder', '/contact', '/privacy'].map((p) => ({
    url: `${SITE.url}${p}`, lastModified: now, changeFrequency: 'monthly' as const, priority: p === '' ? 1 : 0.7,
  }));
  const projects = (await getProjects()).map((p) => ({
    url: `${SITE.url}/portfolio/${p.id}`, lastModified: now, changeFrequency: 'yearly' as const, priority: 0.5,
  }));
  return [...pages, ...projects];
}
