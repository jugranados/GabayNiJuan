import type { SupabaseClient } from '@supabase/supabase-js';

import type { RowQuery, RowSource, TableName } from '@/data/repositories/rowSource';
import { publicColumnsFor } from '@/data/supabase/publicColumns';

export class BackendRequestError extends Error {
  override readonly name = 'BackendRequestError';
}

/**
 * RowSource backed by Supabase/PostgREST. Returns rows as `unknown[]`; the
 * repositories validate them. Requests explicit columns because the public
 * role has column-level SELECT only (see publicColumns.ts).
 */
export function createSupabaseRowSource(client: SupabaseClient): RowSource {
  return {
    async select(table: TableName, query: RowQuery = {}) {
      if (query.in && query.in.values.length === 0) {
        return [];
      }
      let request = client.from(table).select(publicColumnsFor(table).join(','));
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
  };
}
