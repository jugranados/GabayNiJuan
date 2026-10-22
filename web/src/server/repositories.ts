import 'server-only';

import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { createPublicSupabaseClient } from '@/data/supabase/client';
import { createSupabaseCorrectionRepository } from '@/data/supabase/supabaseCorrectionRepository';
import { createSupabaseDirectorySource } from '@/data/supabase/supabaseDirectorySource';
import { createSupabaseRowSource } from '@/data/supabase/supabaseRowSource';
import type { Repositories } from '@/domain/repositories';
import type { AppConfig } from '@/lib/config';
import { getAppConfig } from '@/server/config';

/**
 * Composition root for public data access. Pages and server actions call
 * `getRepositories()` and receive validated domain models only; raw rows,
 * generated database types and the Supabase client never leave `src/data`.
 *
 * Public reads always use the anonymous client, so they can never return more
 * than an anonymous visitor may see, whoever is signed in to /admin.
 */
export function createAppRepositories(config: AppConfig): Repositories {
  if (config.dataSource === 'supabase' && config.supabase) {
    const client = createPublicSupabaseClient(config.supabase.url, config.supabase.anonKey);
    return createRepositories(
      createSupabaseRowSource(client),
      createSupabaseDirectorySource(client),
      createSupabaseCorrectionRepository(client),
    );
  }
  return createMockRepositories();
}

let cached: Repositories | undefined;

export function getRepositories(): Repositories {
  cached ??= createAppRepositories(getAppConfig());
  return cached;
}

/** Corrections need a real backend; the fictional mock data has nowhere to send them. */
export function correctionsAvailable(): boolean {
  return getAppConfig().dataSource === 'supabase';
}
