/**
 * Integration test against a REAL Supabase database, using only the public anon key,
 * exactly like the public site.
 *
 *   npm run test:integration
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from the environment or
 * from web/.env.local. The database needs every migration and the fictional seed
 * (supabase/seed.sql). CI runs it against the local stack in the `database` job.
 *
 * Not part of `npm test`. Every write attempted here is expected to FAIL; the test never
 * modifies data.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { createPublicSupabaseClient } from '@/data/supabase/client';
import { createSupabaseCorrectionRepository } from '@/data/supabase/supabaseCorrectionRepository';
import { createSupabaseDirectorySource } from '@/data/supabase/supabaseDirectorySource';
import { createSupabaseRowSource } from '@/data/supabase/supabaseRowSource';
import type {
  DirectoryEntry,
  DirectoryFilterOptions,
  DirectoryFilters,
} from '@/domain/models/directory';
import { formatPersonName } from '@/domain/models/person';
import type { ElectionDetail, ElectionOfficeDetail, ElectionSummary } from '@/domain/models/election';
import type { ClaimWithEvidence, PersonProfile } from '@/domain/models/personProfile';
import type { Repositories } from '@/domain/repositories';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Ids differ (fixtures use readable ids, the database uses UUIDs), so compare content only. */
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
    slug: profile.person.slug,
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

describe('Supabase (anon key) against the fictional seed', () => {
  const mock = createMockRepositories();
  let client: SupabaseClient;
  let remote: Repositories;

  beforeAll(() => {
    if (!url || !anonKey) {
      throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see web/.env.example).');
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
    // Ids differ between backends (readable ids vs UUIDs), so filters are translated by NAME.
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
      slug: entry.slug,
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
        elections: o.elections.map((e) => [e.slug, e.name, e.electionDate]),
        offices: o.offices.map((x) => [x.slug, x.name, x.level, x.jurisdictionId]),
        organizations: o.organizations.map((x) => [x.slug, x.name, x.abbreviation]),
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

    it('cannot read correction requests, the work queue or the role change log', async () => {
      for (const relation of ['correction_requests', 'editorial_queue', 'editorial_role_events']) {
        const { data, error } = await client.from(relation).select('*').limit(1);
        // Either refused outright or filtered to nothing; never a row.
        expect(error !== null || (data ?? []).length === 0).toBe(true);
      }
    });

    it('cannot call the editorial functions', async () => {
      const calls = [
        client.rpc('editorial_transition', { p_table: 'people', p_id: NIL_UUID, p_to: 'PUBLISHED', p_expected_version: 1, p_reason: null }),
        client.rpc('editorial_update', { p_table: 'people', p_id: NIL_UUID, p_expected_version: 1, p_changes: { first_name: 'Hacked' }, p_reason: 'x' }),
        client.rpc('editorial_set_evidence', { p_claim_id: NIL_UUID, p_source_id: NIL_UUID, p_supports: true, p_note: null, p_reason: null }),
        client.rpc('review_correction', { p_id: NIL_UUID, p_status: 'ACCEPTED', p_expected_version: 1, p_note: 'x' }),
        client.rpc('set_staff_role', { p_email: 'anyone@example.org', p_role: 'ADMIN' }),
        client.rpc('staff_directory'),
      ];
      for (const { error } of await Promise.all(calls)) expect(error).not.toBeNull();
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

describe('elections: mock and Supabase behave identically', () => {
    const electionOfficeView = (detail: ElectionOfficeDetail | null) =>
      detail && {
        election: detail.election.slug,
        office: detail.office.slug,
        sortOrder: detail.electionOffice.sortOrder,
        count: detail.participantCount,
        groups: detail.groups.map((group) => ({
          status: group.status,
          people: group.participants.map((p) => ({
            slug: p.person.slug,
            records: p.records.map((r) => ({
              status: r.record.status,
              from: r.record.effectiveFrom,
              ballot: r.record.ballotNumber,
              claims: claimView(r.claims),
            })),
          })),
        })),
      };

    it('lists the same elections, in the same order, with the same office counts', async () => {
      const view = (list: ElectionSummary[]) =>
        list.map(({ election, officeCount }) => [election.slug, election.name, election.electionDate, election.status, officeCount]);
      expect(view(await remote.elections.listElections())).toEqual(view(await mock.elections.listElections()));
    });

    it('shows the same offices and per-status counts on every election page', async () => {
      for (const { election } of await mock.elections.listElections()) {
        const view = (detail: ElectionDetail | null) =>
          detail?.offices.map((o) => [o.office.slug, o.electionOffice.sortOrder, o.participantCount, o.statusCounts]);
        expect(view(await remote.elections.getElectionDetail(election.slug))).toEqual(
          view(await mock.elections.getElectionDetail(election.slug)),
        );
      }
    });

    it('shows the same participants, exact statuses and evidence on every office page', async () => {
      const paths = await mock.elections.listElectionOfficePaths();
      expect(await remote.elections.listElectionOfficePaths()).toEqual(paths);
      for (const { electionSlug, officeSlug } of paths) {
        expect(electionOfficeView(await remote.elections.getElectionOfficeDetail(electionSlug, officeSlug))).toEqual(
          electionOfficeView(await mock.elections.getElectionOfficeDetail(electionSlug, officeSlug)),
        );
      }
    });

    it('answers unknown and malformed election addresses with "not found"', async () => {
      expect(await remote.elections.getElectionDetail('no-such-election')).toBeNull();
      expect(await remote.elections.getElectionDetail('Not A Slug')).toBeNull();
      expect(await remote.elections.getElectionById('not-a-uuid')).toBeNull();
      expect(await remote.elections.getOfficeById(NIL_UUID)).toBeNull();
      const [first] = await mock.elections.listElectionOfficePaths();
      expect(await remote.elections.getElectionOfficeDetail(first!.electionSlug, 'no-such-office')).toBeNull();
    });

    it('cannot read editorial identity of election offices', async () => {
      const { error } = await client.from('election_offices').select('id,created_by').limit(1);
      expect(error).not.toBeNull();
    });
  });

describe('public URLs', () => {
    it('gives every person the same slug as the fixtures and finds profiles by it', async () => {
      const [remoteSlugs, mockSlugs] = await Promise.all([
        remote.people.listPersonSlugs(),
        mock.people.listPersonSlugs(),
      ]);
      expect(remoteSlugs).toEqual(mockSlugs);
      for (const slug of mockSlugs) {
        const [r, m] = await Promise.all([
          remote.people.getPersonProfileBySlug(slug),
          mock.people.getPersonProfileBySlug(slug),
        ]);
        expect(profileView(r!)).toEqual(profileView(m!));
      }
    });

    it('answers unknown, malformed and non-uuid lookups with "not found", not an error', async () => {
      expect(await remote.people.getPersonProfileBySlug('nobody-here')).toBeNull();
      expect(await remote.people.getPersonProfileBySlug('Not A Slug')).toBeNull();
      expect(await remote.people.getPersonById('not-a-uuid')).toBeNull();
      expect(await remote.claims.getClaimDetail('not-a-uuid')).toBeNull();
      expect(await remote.claims.getClaimDetail(NIL_UUID)).toBeNull();
    });

    it('lists the same number of indexable claims for the sitemap', async () => {
      const [r, m] = await Promise.all([
        remote.claims.listIndexableClaimIds(),
        mock.claims.listIndexableClaimIds(),
      ]);
      expect(r).toHaveLength(m.length);
      expect(r.length).toBeGreaterThan(0);
    });
  });

  describe('report an error (anonymous submit_correction)', () => {
    const report = createSupabaseCorrectionRepository;

    it('refuses invalid input without revealing why', async () => {
      const person = (await listAll(remote))[0]!;
      const base = { recordType: 'PERSON' as const, recordId: person.id };
      await expect(report(client).submit({ ...base, description: 'short' })).rejects.toThrow(/check the details/);
      await expect(
        report(client).submit({ ...base, description: 'A long enough description.', sourceUrl: 'javascript:alert(1)' }),
      ).rejects.toThrow(/check the details/);
      await expect(
        report(client).submit({ ...base, description: 'A long enough description.', contactEmail: 'not-an-email' }),
      ).rejects.toThrow(/check the details/);
    });

    it('refuses a target that is not a published record', async () => {
      await expect(
        report(client).submit({ recordType: 'PERSON', recordId: NIL_UUID, description: 'A long enough description.' }),
      ).rejects.toThrow(/check the details/);
    });
  });
});
