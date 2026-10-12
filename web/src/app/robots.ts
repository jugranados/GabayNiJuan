import type { MetadataRoute } from 'next';

import { getAppConfig } from '@/server/config';

/** /robots.txt. Nothing is crawlable unless indexing is explicitly on; /admin never is. */
export default function robots(): MetadataRoute.Robots {
  const config = getAppConfig();
  if (!config.indexable) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/corrections'] }],
    sitemap: `${config.siteUrl}/sitemap.xml`,
  };
}
