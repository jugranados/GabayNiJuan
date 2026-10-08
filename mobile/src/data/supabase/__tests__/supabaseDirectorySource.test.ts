import type { SupabaseClient } from '@supabase/supabase-js';

import { createInMemoryRowSource } from '@/data/repositories/inMemoryRowSource';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { createSupabaseDirectorySource } from '@/data/supabase/supabaseDirectorySource';
import { BackendRequestError } from '@/data/supabase/supabaseRowSource';
import { normalizeDirectoryQuery } from '@/domain/directory';
import { DataValidationError } from '@/domain/validation/errors';

function fakeClient(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = jest
    .fn()
    .mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const page = {
  total: 1,
  items: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      first_name: 'Juan',
      middle_name: null,
      last_name: 'Dela Cruz',
      suffix: null,
      preferred_name: null,
      photo_asset_id: null,
      participations: [
        {
          office_name: 'Mayor (fictional)',
          election_name: 'Election (fictional)',
          election_date: '2027-05-10',
          status: 'OFFICIAL_CANDIDATE',
          effective_from: '2026-09-15',
        },
      ],
      affiliation: null,
    },
  ],
};

describe('Supabase directory source', () => {
  it('sends one search_directory call with every filter mapped to its parameter', async () => {
    const { client, rpc } = fakeClient({ data: page });
    const source = createSupabaseDirectorySource(client);
    await source.search(
      normalizeDirectoryQuery({
        query: '  Juan  ',
        filters: {
          electionId: 'e',
          officeId: 'o',
          officeLevel: 'CITY',
          participationStatus: 'FILED_COC',
          organizationId: 'org',
          jurisdictionId: 'j',
        },
        page: { limit: 10, offset: 20 },
      }),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('search_directory', {
      p_query: 'Juan',
      p_election_id: 'e',
      p_office_id: 'o',
      p_office_level: 'CITY',
      p_participation_status: 'FILED_COC',
      p_organization_id: 'org',
      p_jurisdiction_id: 'j',
      p_limit: 10,
      p_offset: 20,
    });
  });

  it('sends nulls, not undefined, for absent filters and ignores too-short queries', async () => {
    const { client, rpc } = fakeClient({ data: page });
    await createSupabaseDirectorySource(client).search(normalizeDirectoryQuery({ query: 'j' }));
    expect(rpc).toHaveBeenCalledWith('search_directory', {
      p_query: null,
      p_election_id: null,
      p_office_id: null,
      p_office_level: null,
      p_participation_status: null,
      p_organization_id: null,
      p_jurisdiction_id: null,
      p_limit: 20,
      p_offset: 0,
    });
  });

  it('turns a backend error into a BackendRequestError', async () => {
    const { client } = fakeClient({ error: { message: 'TypeError: Network request failed' } });
    await expect(
      createSupabaseDirectorySource(client).search(normalizeDirectoryQuery({})),
    ).rejects.toBeInstanceOf(BackendRequestError);
  });

  it('goes through Zod and the mapper in the repository', async () => {
    const { client } = fakeClient({ data: page });
    const repos = createRepositories(
      createInMemoryRowSource({}),
      createSupabaseDirectorySource(client),
    );
    const result = await repos.people.searchDirectory({});
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      displayName: 'Juan Dela Cruz',
      photoAssetId: undefined,
      participations: [
        {
          officeName: 'Mayor (fictional)',
          electionName: 'Election (fictional)',
          electionDate: '2027-05-10',
          status: 'OFFICIAL_CANDIDATE',
          effectiveFrom: '2026-09-15',
        },
      ],
      affiliation: undefined,
    });
    expect(result.nextOffset).toBeUndefined();
  });

  it('computes the next offset from the total', async () => {
    const { client } = fakeClient({ data: { ...page, total: 45 } });
    const repos = createRepositories(
      createInMemoryRowSource({}),
      createSupabaseDirectorySource(client),
    );
    expect(
      (await repos.people.searchDirectory({ page: { limit: 20, offset: 20 } })).nextOffset,
    ).toBe(21);
  });

  it('rejects a malformed or unexpected payload instead of showing it', async () => {
    const bad = {
      total: 1,
      items: [
        {
          ...page.items[0],
          participations: [{ ...page.items[0]!.participations[0], status: 'FRONTRUNNER' }],
        },
      ],
    };
    const repos = createRepositories(
      createInMemoryRowSource({}),
      createSupabaseDirectorySource(fakeClient({ data: bad }).client),
    );
    await expect(repos.people.searchDirectory({})).rejects.toBeInstanceOf(DataValidationError);

    const notAPage = createRepositories(
      createInMemoryRowSource({}),
      createSupabaseDirectorySource(fakeClient({ data: [{ nope: true }] }).client),
    );
    await expect(notAPage.people.searchDirectory({})).rejects.toBeInstanceOf(DataValidationError);
  });
});
