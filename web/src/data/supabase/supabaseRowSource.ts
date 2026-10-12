import type { SupabaseClient } from '@supabase/supabase-js';

import type { RowQuery, RowSource, TableName } from '@/data/repositories/rowSource';
import { publicColumnsFor } from '@/data/supabase/publicColumns';
import { isUuid } from '@/domain/slug';

/** uuid columns the repositories filter on. A value that is not a uuid cannot match a row. */
const UUID_FILTER_COLUMNS = new Set(['id', 'person_id', 'subject_person_id', 'claim_id']);

export class BackendRequestError extends Error {
  override readonly name = 'BackendRequestError';
}

/**
 * RowSource backed by Supabase/PostgREST. Returns rows as `unknown[]`; the
 * repositories validate them. Requests explicit columns because the public
 * role has column-level SELECT only (see publicColumns.ts).
 */
const PAGE_SIZE = 1000;

export function createSupabaseRowSource(client: SupabaseClient): RowSource {
  return {
    async selectAll(table: TableName) {
      const rows: unknown[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await client
          .from(table)
          .select(publicColumnsFor(table).join(','))
          .order('id')
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          throw new BackendRequestError(`Failed to read ${table}: ${error.message}`);
        }
        rows.push(...((data ?? []) as unknown[]));
        if (!data || data.length < PAGE_SIZE) return rows;
      }
    },

    async select(table: TableName, query: RowQuery = {}) {
      if (query.in && query.in.values.length === 0) {
        return [];
      }
      // PostgREST answers a malformed uuid with an error; for a visitor it is simply "not found".
      const eqEntries = Object.entries(query.eq ?? {});
      if (eqEntries.some(([column, value]) => UUID_FILTER_COLUMNS.has(column) && !isUuid(value))) {
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
