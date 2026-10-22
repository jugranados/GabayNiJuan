import { devFixtureTables } from '@/data/fixtures/devFixtures';
import type { FixtureTables } from '@/data/repositories/inMemoryRowSource';
import { createInMemoryDirectorySource } from '@/data/repositories/inMemoryDirectorySource';
import { createInMemoryRowSource } from '@/data/repositories/inMemoryRowSource';
import { createInMemoryCorrectionRepository } from '@/data/repositories/inMemoryCorrectionRepository';
import { createRepositories } from '@/data/repositories/tableRepositories';
import type { Repositories } from '@/domain/repositories';

/**
 * Repositories over in-memory tables (fictional fixtures by default). `now` is
 * injectable so date-dependent rules ("current affiliation") are testable.
 */
export function createMockRepositories(
  tables: FixtureTables = devFixtureTables,
  now?: () => Date,
): Repositories {
  return createRepositories(
    createInMemoryRowSource(tables),
    createInMemoryDirectorySource(tables, now),
    createInMemoryCorrectionRepository(),
  );
}
