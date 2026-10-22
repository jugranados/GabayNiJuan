import type { NormalizedDirectoryQuery } from '@/domain/directory';

/**
 * Runs a normalised directory query and returns the raw page as `unknown`
 * (shape: data/schemas/directory.ts). Implementations:
 *   - in-memory: computes it from fixture tables (development and tests)
 *   - Supabase:  calls the `search_directory` function, so filtering, ordering
 *                and paging happen in the database
 * Both must produce identical results; supabase.integration.test.ts checks it.
 */
export interface DirectorySource {
  search(params: NormalizedDirectoryQuery): Promise<unknown>;
}
