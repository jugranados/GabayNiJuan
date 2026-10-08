/**
 * Integration test against a REAL Supabase project, using only the public
 * anon key, exactly like the mobile app.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... \
 *   npm run test:integration
 *
 * Requires the fictional seed (supabase/seed.sql) to be loaded. Not part of
 * `npm test` (it uses jest.integration.config.js, a plain Node environment,
 * because jest-expo stubs fetch). Every write attempted here is expected to
 * FAIL; the test never modifies data.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { createPublicSupabaseClient } from '@/data/supabase/client';
import { createSupabaseDirectorySource } from '@/data/supabase/supabaseDirectorySource';
import { createSupabaseRowSource } from '@/data/supabase/supabaseRowSource';
import type {
  DirectoryEntry,
  DirectoryFilterOptions,
  DirectoryFilters,
} from '@/domain/models/directory';
import { formatPersonName } from '@/domain/models/person';
import type { ClaimWithEvidence, PersonProfile } from '@/domain/models/personProfile';
import type { Repositories } from '@/domain/repositories';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Ids differ (fixtures use slugs, the database uses UUIDs), so compare content only. */
function claimView(items: ClaimWithEvidence[]) {
  return items
    .map(({ claim, evidence }) => ({
      statement: claim.statement,
      status: claim.verificationStatus,
      from: claim.effectiveFrom,
      to: claim.effectiveTo,
      reviewed: claim.lastReviewedAt,
      evidence: evidence
        .map((e) => `${e.source.title} | ${e.source.sourceType} | supports=${e.link.supports}`)
        .sort(),
    }))
    .sort((a, b) => a.statement.localeCompare(b.statement));
}

function profileView(profile: PersonProfile) {
  return {
    name: formatPersonName(profile.person),
    birthDate: profile.person.birthDate,
    identity: claimView(profile.identityClaims),
    participations: profile.electionParticipations.map((p) => ({
      office: p.record.office.name,
      election: p.record.election.name,
      status: p.record.participation.status,
      ballot: p.record.participation.ballotNumber,
      claims: claimView(p.claims),
    })),
    terms: profile.officeTerms.map((t) => ({
      office: t.record.office.name,
      from: t.record.term.startDate,
      to: t.record.term.endDate,
      claims: claimView(t.claims),
    })),
    affiliations: profile.affiliations.map((a) => ({
      organization: a.record.organization.name,
      type: a.record.affiliation.affiliationType,
      claims: claimView(a.claims),
    })),
    education: profile.education.map((e) => ({
      institution: e.record.institution,
      claims: claimView(e.claims),
    })),
    positions: profile.policyPositions.map((p) => ({
      text: p.record.positionText,
      claims: claimView(p.claims),
    })),
    sources: profile.sources.map((s) => s.title).sort(),
    summary: {
      claims: profile.evidenceSummary.claimCount,
      sources: profile.evidenceSummary.sourceCount,
    },
  };
}

// Real network calls (a profile is several requests): allow more than Jest's 5s default.
jest.setTimeout(60_000);

describe('Supabase (anon key) against the fictional seed', () => {
  const mock = createMockRepositories();
  let client: SupabaseClient;
  let remote: Repositories;

  beforeAll(() => {
    if (!url || !anonKey) {
      throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    }
    client = createPublicSupabaseClient(url, anonKey);
    remote = createRepositories(
      createSupabaseRowSource(client),
      createSupabaseDirectorySource(client),
    );
  });

  const listAll = async (repos: Repositories) =>
    (await repos.people.searchDirectory({ page: { limit: 50 } })).items;

  it('lists the same people as the fixtures, in the same order', async () => {
    const [remotePeople, mockPeople] = await Promise.all([listAll(remote), listAll(mock)]);
    expect(remotePeople.map((p) => p.displayName)).toEqual(mockPeople.map((p) => p.displayName));
  });

  it('returns profiles identical in content to the fixtures (claims, evidence, sources)', async () => {
    const mockPeople = await listAll(mock);
    const remotePeople = await listAll(remote);
    for (const mockPerson of mockPeople) {
      const remotePerson = remotePeople.find((p) => p.displayName === mockPerson.displayName);
      expect(remotePerson).toBeDefined();
      const [r, m] = await Promise.all([
        remote.people.getPersonProfile(remotePerson!.id),
        mock.people.getPersonProfile(mockPerson.id),
      ]);
      expect(profileView(r!)).toEqual(profileView(m!));
    }
  });

  it('serves a claim detail with supporting and contradicting evidence', async () => {
    const remotePeople = await listAll(remote);
    const maria = remotePeople.find((p) => p.displayName.includes('Makabayan'))!;
    const profile = await remote.people.getPersonProfile(maria.id);
    const disputed = profile!.officeTerms[0]!.claims[0]!;
    const detail = await remote.claims.getClaimDetail(disputed.claim.id);
    expect(detail?.claim.verificationStatus).toBe('DISPUTED');
    expect(detail?.evidence.map((e) => e.link.supports).sort()).toEqual([false, true]);
    expect(detail?.subject?.displayName).toContain('Makabayan');
  });

  describe('directory: mock and Supabase behave identically', () => {
    // Ids differ between backends (slugs vs UUIDs), so filters are translated by NAME.
    let mockOptions: DirectoryFilterOptions;
    let remoteOptions: DirectoryFilterOptions;

    beforeAll(async () => {
      [mockOptions, remoteOptions] = await Promise.all([
        mock.people.getDirectoryFilterOptions(),
        remote.people.getDirectoryFilterOptions(),
      ]);
    });

    const translate = (filters: DirectoryFilters): DirectoryFilters => {
      const byName = <T extends { id: string; name: string }>(from: T[], to: T[], id?: string) =>
        id === undefined
          ? undefined
          : to.find((t) => t.name === from.find((f) => f.id === id)?.name)?.id;
      return {
        ...filters,
        electionId: byName(mockOptions.elections, remoteOptions.elections, filters.electionId),
        officeId: byName(mockOptions.offices, remoteOptions.offices, filters.officeId),
        organizationId: byName(
          mockOptions.organizations,
          remoteOptions.organizations,
          filters.organizationId,
        ),
      };
    };

    /** Card content without ids, for comparison across backends. */
    const view = (entry: DirectoryEntry) => ({
      name: entry.displayName,
      participations: entry.participations,
      affiliation: entry.affiliation,
    });

    const compare = async (
      query: { query?: string; filters?: DirectoryFilters },
      limit = 50,
      offset = 0,
    ) => {
      const page = { limit, offset };
      const [m, r] = await Promise.all([
        mock.people.searchDirectory({ ...query, page }),
        remote.people.searchDirectory({
          ...query,
          filters: query.filters ? translate(query.filters) : undefined,
          page,
        }),
      ]);
      expect(r.items.map(view)).toEqual(m.items.map(view));
      expect(r.total).toBe(m.total);
      expect(r.nextOffset).toBe(m.nextOffset);
      return m;
    };

    it('lists reference data for the filter UI identically', async () => {
      const names = (o: DirectoryFilterOptions) => ({
        elections: o.elections.map((e) => [e.name, e.electionDate]),
        offices: o.offices.map((x) => [x.name, x.level, x.jurisdictionId]),
        organizations: o.organizations.map((x) => [x.name, x.abbreviation]),
      });
      expect(names(remoteOptions)).toEqual(names(mockOptions));
    });

    it.each(['gawa', 'dela cruz juan', '  MAKAB ', 'jr', 'ejemplo', 'g', 'zzzzzz'])(
      'search %j',
      async (query) => {
        await compare({ query });
      },
    );

    it.each(['NATIONAL', 'PROVINCIAL', 'CITY', 'MUNICIPAL', 'DISTRICT', 'BARANGAY'] as const)(
      'office level %s',
      async (officeLevel) => {
        await compare({ filters: { officeLevel } });
      },
    );

    it.each([
      'POTENTIAL_ASPIRANT',
      'PUBLICLY_DECLARED_ASPIRANT',
      'FILED_COC',
      'OFFICIAL_CANDIDATE',
      'WITHDRAWN',
      'DISQUALIFIED',
      'ELECTED',
      'NOT_ELECTED',
    ] as const)('participation status %s', async (participationStatus) => {
      const m = await compare({ filters: { participationStatus } });
      expect(m.total).toBeGreaterThan(0);
    });

    it('every election, office and organization filter', async () => {
      for (const election of mockOptions.elections) {
        await compare({ filters: { electionId: election.id } });
      }
      for (const office of mockOptions.offices) {
        await compare({ filters: { officeId: office.id } });
      }
      for (const organization of mockOptions.organizations) {
        await compare({ filters: { organizationId: organization.id } });
      }
    });

    it('jurisdiction filter (opaque id)', async () => {
      await compare({ filters: { jurisdictionId: 'jurisdiction-halimbawa-district-1' } });
    });

    it('combined filters and search', async () => {
      const pambansa = mockOptions.elections.find((e) => e.id === 'election-pambansa-2028')!.id;
      const pagasa = mockOptions.organizations.find((o) => o.id === 'org-partido-pag-asa')!.id;
      await compare({
        filters: { electionId: pambansa, participationStatus: 'POTENTIAL_ASPIRANT' },
      });
      await compare({ filters: { officeLevel: 'NATIONAL', organizationId: pagasa } });
      await compare({ query: 'gawa', filters: { participationStatus: 'DISQUALIFIED' } });
      await compare({
        filters: { officeLevel: 'PROVINCIAL', participationStatus: 'POTENTIAL_ASPIRANT' },
      });
    });

    it('pagination returns the same pages and totals', async () => {
      for (const offset of [0, 3, 6, 9, 12]) {
        await compare({}, 3, offset);
      }
    });

    it('current affiliation shown on cards follows the same date and evidence rules', async () => {
      const entries = await listAll(remote);
      const byName = Object.fromEntries(
        entries.map((e) => [e.displayName, e.affiliation?.organizationName]),
      );
      expect(byName['Elena Bukid Kathang-Isip']).toBeUndefined(); // ended
      expect(byName['Tomas Ilog Ejemplo']).toBeUndefined(); // OUTDATED claim
      expect(byName['Ramon Bayani Gawa-Gawa']).toBe('Alyansang Bagong-Umaga (fictional)');
    });
  });

  describe('anonymous access is read-only and limited', () => {
    it.each(['people', 'claims', 'sources', 'claim_evidence'] as const)(
      'cannot insert into %s',
      async (table) => {
        const { error } = await client.from(table).insert({});
        expect(error?.code).toBe('42501');
      },
    );

    it('cannot update or delete published rows', async () => {
      const update = await client
        .from('people')
        .update({ first_name: 'Hacked' })
        .neq('id', NIL_UUID);
      const del = await client.from('people').delete().neq('id', NIL_UUID);
      expect(update.error?.code).toBe('42501');
      expect(del.error?.code).toBe('42501');
    });

    it('cannot read editorial identity columns or use select *', async () => {
      expect((await client.from('people').select('created_by')).error?.code).toBe('42501');
      expect((await client.from('claims').select('published_by')).error?.code).toBe('42501');
      expect((await client.from('people').select('*')).error?.code).toBe('42501');
    });

    it('cannot read the audit log or editorial roles', async () => {
      expect((await client.from('revisions').select('id')).error?.code).toBe('42501');
      expect((await client.from('editorial_roles').select('user_id')).error?.code).toBe('42501');
    });

    it('only ever sees PUBLISHED records', async () => {
      const { data, error } = await client.from('people').select('id,publication_status');
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThan(0);
      for (const row of data ?? []) {
        expect(row.publication_status).toBe('PUBLISHED');
      }
    });
  });
});
