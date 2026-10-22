import type { NextConfig } from 'next';

import { parseAppConfig } from './src/lib/config';

// Validated at build time: an unsafe environment (for example a service-role key in a
// public variable) fails the build instead of producing a deployment.
const appConfig = parseAppConfig({
  DATA_SOURCE: process.env.DATA_SOURCE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  SITE_INDEXABLE: process.env.SITE_INDEXABLE,
});

const NO_INDEX = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];

const nextConfig: NextConfig = {
  // Public pages use route-level revalidation (docs/WEB_MIGRATION.md, "Caching").
  cacheComponents: false,
  poweredByHeader: false,
  async headers() {
    // Indexing is opt-in (SITE_INDEXABLE=true with DATA_SOURCE=supabase). Until then every
    // response carries a noindex header, in addition to robots.txt and the page metadata, so
    // no route can be indexed by forgetting something. /admin is never indexable.
    return [
      { source: '/admin/:path*', headers: NO_INDEX },
      ...(appConfig.indexable ? [] : [{ source: '/:path*', headers: NO_INDEX }]),
    ];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
