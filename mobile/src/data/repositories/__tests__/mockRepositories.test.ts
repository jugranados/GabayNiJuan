import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createInMemoryRowSource } from '@/data/repositories/inMemoryRowSource';
import { createRepositories } from '@/data/repositories/tableRepositories';
import type { PersonProfile } from '@/domain/models/personProfile';
import { DataValidationError } from '@/domain/validation/errors';
import { checkVerificationConsistency } from '@/domain/validation/verification';

const repos = createRepositories(createInMemoryRowSource(devFixtureTables));

async function profileOf(id: string): Promise<PersonProfile> {
  const profile = await repos.people.getPersonProfile(id);
  if (!profile) throw new Error(`missing fixture profile ${id}`);
  return profile;
}

describe('mock repositories over fictional fixtures', () => {
  it('lists people alphabetically by last name (no ranking)', async () => {
    const people = await repos.people.getPeople();
    expect(people.map((p) => p.displayName)).toEqual([
      'Juan Dela Cruz',
      'Maria Luntian Makabayan',
      'Pedro Santos Jr.',
    ]);
  });

  it('searches names case-insensitively and ignores single-character queries', async () => {
    expect((await repos.people.searchPeople('makab')).map((p) => p.id)).toEqual([
      'person-maria-makabayan',
    ]);
    expect(await repos.people.searchPeople('m')).toEqual([]);
  });

  it('returns null for an unknown person', async () => {
    expect(await repos.people.getPersonProfile('person-does-not-exist')).toBeNull();
  });

  it('does not present a reported potential aspirant as a candidate', async () => {
    const profile = await profileOf('person-pedro-santos');
    const [participation] = profile.electionParticipations;
    expect(participation?.record.participation.status).toBe('POTENTIAL_ASPIRANT');
    expect(participation?.claims[0]?.claim.verificationStatus).toBe('REPORTED');
  });

  it('preserves conflicting sources on a disputed claim', async () => {
    const profile = await profileOf('person-maria-makabayan');
    const termClaim = profile.officeTerms[0]?.claims[0];
    expect(termClaim?.claim.verificationStatus).toBe('DISPUTED');
    expect(termClaim?.evidence.map((e) => e.link.supports).sort()).toEqual([false, true]);
  });

  it('returns evidence with full source metadata for a claim', async () => {
    const evidence = await repos.sources.getSourcesForClaim('claim-juan-barangay-term');
    expect(evidence).toHaveLength(2);
    for (const { source } of evidence) {
      expect(source.retrievedAt).toBeTruthy();
      expect(source.url ?? source.documentIdentifier).toBeTruthy();
    }
  });

  it('serves election participation and elections through their repository', async () => {
    const [participation] = await repos.elections.getElectionParticipation('person-juan-dela-cruz');
    expect(participation?.status).toBe('OFFICIAL_CANDIDATE');
    const election = await repos.elections.getElectionById(participation?.electionId ?? '');
    expect(election?.name).toMatch(/fictional/);
  });

  it('rejects invalid fixture data instead of displaying it', async () => {
    const broken = createRepositories(
      createInMemoryRowSource({
        people: [{ id: 'p-x', first_name: 'Juan', last_name: '' }],
      }),
    );
    await expect(broken.people.getPeople()).rejects.toBeInstanceOf(DataValidationError);
  });
});

describe('fixture integrity', () => {
  const personIds = (devFixtureTables.people ?? []).map((row) => (row as { id: string }).id);

  it.each(personIds)(
    'every displayed record for %s is attested by a consistent claim',
    async (id) => {
      const profile = await profileOf(id);
      const attested = [
        ...profile.electionParticipations,
        ...profile.officeTerms,
        ...profile.affiliations,
        ...profile.education,
        ...profile.policyPositions,
      ];
      for (const { claims } of attested) {
        expect(claims.length).toBeGreaterThan(0);
      }
      for (const { claim, evidence } of [
        ...attested.flatMap((a) => a.claims),
        ...profile.identityClaims,
      ]) {
        expect({ id: claim.id, issues: checkVerificationConsistency(claim, evidence) }).toEqual({
          id: claim.id,
          issues: [],
        });
      }
    },
  );

  it('only links to the reserved example.org domain', () => {
    for (const row of devFixtureTables.sources ?? []) {
      const { url, archived_url } = row as { url: string | null; archived_url: string | null };
      for (const link of [url, archived_url].filter(Boolean)) {
        expect(new URL(link as string).hostname).toBe('example.org');
      }
    }
  });
});
