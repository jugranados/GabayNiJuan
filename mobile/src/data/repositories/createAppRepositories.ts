import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createInMemoryRowSource } from '@/data/repositories/inMemoryRowSource';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { createPublicSupabaseClient } from '@/data/supabase/client';
import { createSupabaseRowSource } from '@/data/supabase/supabaseRowSource';
import type { Repositories } from '@/domain/repositories';
import type { AppConfig } from '@/shared/config/env';

/**
 * Composition root for data access. Switching between fictional fixtures and
 * Supabase changes only the RowSource; repositories and UI are unchanged.
 */
export function createAppRepositories(config: AppConfig): Repositories {
  switch (config.dataSource) {
    case 'mock':
      return createRepositories(createInMemoryRowSource(devFixtureTables));
    case 'supabase':
      return createRepositories(
        createSupabaseRowSource(
          createPublicSupabaseClient(config.supabaseUrl, config.supabaseAnonKey),
        ),
      );
  }
}
