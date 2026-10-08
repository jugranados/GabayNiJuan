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

import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createInMemoryRowSource } from '@/data/repositories/inMemoryRowSource';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { createPublicSupabaseClient } from '@/data/supabase/client';
import { createSupabaseRowSource } from '@/data/supabase/supabaseRowSource';
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

describe('Supabase (anon key) against the fictional seed', () => {
  const mock = createRepositories(createInMemoryRowSource(devFixtureTables));
  let client: SupabaseClient;
  let remote: Repositories;

  beforeAll(() => {
    if (!url || !anonKey) {
      throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    }
    client = createPublicSupabaseClient(url, anonKey);
    remote = createRepositories(createSupabaseRowSource(client));
  });

  it('lists the same people as the fixtures', async () => {
    const [remotePeople, mockPeople] = await Promise.all([
      remote.people.getPeople(),
      mock.people.getPeople(),
    ]);
    expect(remotePeople.map((p) => p.displayName)).toEqual(mockPeople.map((p) => p.displayName));
  });

  it('returns profiles identical in content to the fixtures (claims, evidence, sources)', async () => {
    const mockPeople = await mock.people.getPeople();
    const remotePeople = await remote.people.getPeople();
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
    const remotePeople = await remote.people.getPeople();
    const maria = remotePeople.find((p) => p.displayName.includes('Makabayan'))!;
    const profile = await remote.people.getPersonProfile(maria.id);
    const disputed = profile!.officeTerms[0]!.claims[0]!;
    const detail = await remote.claims.getClaimDetail(disputed.claim.id);
    expect(detail?.claim.verificationStatus).toBe('DISPUTED');
    expect(detail?.evidence.map((e) => e.link.supports).sort()).toEqual([false, true]);
    expect(detail?.subject?.displayName).toContain('Makabayan');
  });

  it('searches by name', async () => {
    expect((await remote.people.searchPeople('makab')).map((p) => p.displayName)).toEqual([
      'Maria Luntian Makabayan',
    ]);
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
