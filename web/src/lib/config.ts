/**
 * Validated configuration. Pure (no `process.env` access) so it can be tested;
 * src/server/config.ts feeds it the real environment.
 *
 * `NEXT_PUBLIC_*` values are inlined into browser bundles and are public. A
 * privileged Supabase key is rejected outright: this app never needs one.
 */
import { z } from 'zod';

export const DATA_SOURCES = ['mock', 'supabase'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export type SupabasePublicConfig = { url: string; anonKey: string };

export type AppConfig = {
  dataSource: DataSource;
  /** Present whenever both public Supabase variables are set (needed by /admin even in mock mode). */
  supabase?: SupabasePublicConfig;
  /** Origin used for canonical URLs, the sitemap and social metadata. No trailing slash. */
  siteUrl: string;
  /**
   * Search engines may index the site. Only ever true when it is explicitly
   * switched on AND the data comes from Supabase: fictional data is never indexed.
   */
  indexable: boolean;
};

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

export type RawEnv = {
  DATA_SOURCE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  SITE_INDEXABLE?: string;
};

function decodeJwtRole(key: string): string | undefined {
  const payload = key.split('.')[1];
  if (!payload) return undefined;
  try {
    const parsed: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return parsed && typeof parsed === 'object' && 'role' in parsed && typeof parsed.role === 'string'
      ? parsed.role
      : undefined;
  } catch {
    return undefined;
  }
}

/** True for keys that bypass Row Level Security and must never reach this app. */
export function isPrivilegedSupabaseKey(key: string): boolean {
  return key.startsWith('sb_secret_') || decodeJwtRole(key) === 'service_role';
}

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  DATA_SOURCE: z.preprocess(emptyToUndefined, z.enum(DATA_SOURCES).default('mock')),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    emptyToUndefined,
    z.url({ protocol: /^https?$/ }).default('http://localhost:3000'),
  ),
  SITE_INDEXABLE: z.preprocess(emptyToUndefined, z.enum(['true', 'false']).default('false')),
});

export function parseAppConfig(raw: RawEnv): AppConfig {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(
      `Invalid environment: ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }
  const env = result.data;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (anonKey && isPrivilegedSupabaseKey(anonKey)) {
    throw new ConfigError(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is a service-role/secret key. It would be sent to every browser; use the anon/publishable key.',
    );
  }
  if (env.DATA_SOURCE === 'supabase' && (!url || !anonKey)) {
    throw new ConfigError(
      'DATA_SOURCE=supabase requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  return {
    dataSource: env.DATA_SOURCE,
    supabase: url && anonKey ? { url, anonKey } : undefined,
    siteUrl: env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ''),
    indexable: env.SITE_INDEXABLE === 'true' && env.DATA_SOURCE === 'supabase',
  };
}
