import type { MetadataRoute } from 'next';
import { SITE } from '@/utils/chatEngine/siteConfig';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/track', '/builder/edit'] },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
