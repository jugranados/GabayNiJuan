import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createInMemoryDirectorySource } from '@/data/repositories/inMemoryDirectorySource';
import { createInMemoryRowSource, type FixtureTables } from '@/data/repositories/inMemoryRowSource';
import { createRepositories } from '@/data/repositories/tableRepositories';
import type { Repositories } from '@/domain/repositories';

/**
 * Repositories over in-memory tables (fictional fixtures by default). `now` is
 * injectable so date-dependent rules ("current affiliation") are testable.
 * Corrections are deliberately not wired: there is nowhere to send them, so
 * submitting fails instead of pretending to succeed.
 */
export function createMockRepositories(
  tables: FixtureTables = devFixtureTables,
  now?: () => Date,
): Repositories {
  return createRepositories(
    createInMemoryRowSource(tables),
    createInMemoryDirectorySource(tables, now),
  );
}
