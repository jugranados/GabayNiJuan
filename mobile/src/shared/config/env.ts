/**
 * Validated public configuration.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time, and only when each
 * variable is accessed with a static property name, so they are read
 * individually below. Everything here ships inside the app binary: it must
 * be public. Privileged keys are rejected outright.
 */
import { z } from 'zod';

export const DATA_SOURCES = ['mock', 'supabase'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export type AppConfig =
  { dataSource: 'mock' } | { dataSource: 'supabase'; supabaseUrl: string; supabaseAnonKey: string };

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

type RawEnv = {
  EXPO_PUBLIC_DATA_SOURCE?: string;
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
};

function decodeJwtRole(key: string): string | undefined {
  const payload = key.split('.')[1];
  if (!payload) {
    return undefined;
  }
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(json);
    return parsed &&
      typeof parsed === 'object' &&
      'role' in parsed &&
      typeof parsed.role === 'string'
      ? parsed.role
      : undefined;
  } catch {
    return undefined;
  }
}

/** True for keys that bypass Row Level Security and must never ship in a client. */
export function isPrivilegedSupabaseKey(key: string): boolean {
  return key.startsWith('sb_secret_') || decodeJwtRole(key) === 'service_role';
}

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  EXPO_PUBLIC_DATA_SOURCE: z.preprocess(emptyToUndefined, z.enum(DATA_SOURCES).default('mock')),
  EXPO_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
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

  if (env.EXPO_PUBLIC_DATA_SOURCE === 'mock') {
    return { dataSource: 'mock' };
  }

  if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    throw new ConfigError(
      'EXPO_PUBLIC_DATA_SOURCE=supabase requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  if (isPrivilegedSupabaseKey(env.EXPO_PUBLIC_SUPABASE_ANON_KEY)) {
    throw new ConfigError(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY is a service-role/secret key. Never ship it in the mobile app; use the anon/publishable key.',
    );
  }
  return {
    dataSource: 'supabase',
    supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function readAppConfig(): AppConfig {
  return parseAppConfig({
    EXPO_PUBLIC_DATA_SOURCE: process.env.EXPO_PUBLIC_DATA_SOURCE,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}
