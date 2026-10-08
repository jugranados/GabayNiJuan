import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { createPublicSupabaseClient } from '@/data/supabase/client';
import { createSupabaseCorrectionRepository } from '@/data/supabase/supabaseCorrectionRepository';
import { createSupabaseDirectorySource } from '@/data/supabase/supabaseDirectorySource';
import { createSupabaseRowSource } from '@/data/supabase/supabaseRowSource';
import type { Repositories } from '@/domain/repositories';
import type { AppConfig } from '@/shared/config/env';

/**
 * Composition root for data access. Switching between fictional fixtures and
 * Supabase swaps the RowSource and DirectorySource; repositories and UI are unchanged.
 */
export function createAppRepositories(config: AppConfig): Repositories {
  switch (config.dataSource) {
    case 'mock':
      return createMockRepositories(devFixtureTables);
    case 'supabase': {
      const client = createPublicSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
      return createRepositories(
        createSupabaseRowSource(client),
        createSupabaseDirectorySource(client),
        createSupabaseCorrectionRepository(client),
      );
    }
  }
}
