import 'server-only';

import { parseAppConfig, type AppConfig } from '@/lib/config';

let cached: AppConfig | undefined;

/** The validated environment. Throws ConfigError (and so fails the build or request) when it is unsafe. */
export function getAppConfig(): AppConfig {
  cached ??= parseAppConfig({
    DATA_SOURCE: process.env.DATA_SOURCE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SITE_INDEXABLE: process.env.SITE_INDEXABLE,
  });
  return cached;
}
