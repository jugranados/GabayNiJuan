import type { SupabaseClient } from '@supabase/supabase-js';

import type { DirectorySource } from '@/data/repositories/directorySource';
import { BackendRequestError } from '@/data/supabase/supabaseRowSource';

/** Arguments of the `search_directory` database function; schemaDrift.ts checks them against the generated types. */
export type SearchDirectoryArgs = {
  p_query: string | null;
  p_election_id: string | null;
  p_office_id: string | null;
  p_office_level: string | null;
  p_participation_status: string | null;
  p_organization_id: string | null;
  p_jurisdiction_id: string | null;
  p_limit: number;
  p_offset: number;
};

/**
 * Directory search in the database: one call to the `search_directory`
 * function (security invoker, so Row Level Security and the anon column grants
 * still apply). Filtering, ordering and paging never happen on the device.
 */
export function createSupabaseDirectorySource(client: SupabaseClient): DirectorySource {
  return {
    async search(params) {
      const { filters } = params;
      const args: SearchDirectoryArgs = {
        p_query: params.query ?? null,
        p_election_id: filters.electionId ?? null,
        p_office_id: filters.officeId ?? null,
        p_office_level: filters.officeLevel ?? null,
        p_participation_status: filters.participationStatus ?? null,
        p_organization_id: filters.organizationId ?? null,
        p_jurisdiction_id: filters.jurisdictionId ?? null,
        p_limit: params.limit,
        p_offset: params.offset,
      };
      const { data, error } = await client.rpc('search_directory', args);
      if (error) {
        throw new BackendRequestError(`Failed to search the directory: ${error.message}`);
      }
      return data as unknown;
    },
  };
}
