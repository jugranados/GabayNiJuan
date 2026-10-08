import type { SupabaseClient } from '@supabase/supabase-js';

import type { RowQuery, RowSource, TableName } from '@/data/repositories/rowSource';

export class BackendRequestError extends Error {
  override readonly name = 'BackendRequestError';
}

/** Characters with meaning in PostgREST filter syntax or LIKE patterns. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_*,()\\."']/g, ' ').trim();
}

/**
 * RowSource backed by Supabase/PostgREST. Returns rows as `unknown[]`; the
 * repositories validate them. Table names are provisional until the
 * Milestone 1 schema is migrated.
 */
export function createSupabaseRowSource(client: SupabaseClient): RowSource {
  return {
    async select(table: TableName, query: RowQuery = {}) {
      if (query.in && query.in.values.length === 0) {
        return [];
      }
      let request = client.from(table).select('*');
      for (const [column, value] of Object.entries(query.eq ?? {})) {
        request = request.eq(column, value);
      }
      if (query.in) {
        request = request.in(query.in.column, [...query.in.values]);
      }
      const { data, error } = await request;
      if (error) {
        throw new BackendRequestError(`Failed to read ${table}: ${error.message}`);
      }
      return (data ?? []) as unknown[];
    },

    async search(table: TableName, columns: readonly string[], term: string) {
      const safe = sanitizeSearchTerm(term);
      if (!safe) {
        return [];
      }
      const filter = columns.map((column) => `${column}.ilike.%${safe}%`).join(',');
      const { data, error } = await client.from(table).select('*').or(filter);
      if (error) {
        throw new BackendRequestError(`Failed to search ${table}: ${error.message}`);
      }
      return (data ?? []) as unknown[];
    },
  };
}
