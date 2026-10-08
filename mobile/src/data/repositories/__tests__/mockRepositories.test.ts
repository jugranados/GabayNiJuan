import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createInMemoryRowSource } from '@/data/repositories/inMemoryRowSource';
import { createRepositories } from '@/data/repositories/tableRepositories';
import type { PersonProfile } from '@/domain/models/personProfile';
import { DataIntegrityError, DataValidationError } from '@/domain/validation/errors';

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

describe('claim repository over fictional fixtures', () => {
  it('returns a disputed claim with supporting and contradicting evidence preserved', async () => {
    const detail = await repos.claims.getClaimDetail('claim-maria-councilor-term');
    expect(detail?.claim.verificationStatus).toBe('DISPUTED');
    expect(detail?.subject?.displayName).toBe('Maria Luntian Makabayan');
    expect(detail?.evidence.map((e) => [e.source.id, e.link.supports])).toEqual([
      ['src-city-roster-2022', true],
      ['src-news-balita-maria-term', false],
    ]);
  });

  it('returns a claim with no evidence as an empty list, not as verified', async () => {
    const detail = await repos.claims.getClaimDetail('claim-pedro-councilor-term');
    expect(detail?.claim.verificationStatus).toBe('UNVERIFIED');
    expect(detail?.evidence).toEqual([]);
  });

  it('returns null for an unknown claim', async () => {
    expect(await repos.claims.getClaimDetail('claim-does-not-exist')).toBeNull();
  });

  it('fails explicitly when evidence points to a missing source', async () => {
    const broken = createRepositories(
      createInMemoryRowSource({
        ...devFixtureTables,
        claim_evidence: [
          { claim_id: 'claim-maria-filed-coc', source_id: 'src-missing', supports: true },
        ],
      }),
    );
    await expect(broken.claims.getClaimDetail('claim-maria-filed-coc')).rejects.toBeInstanceOf(
      DataIntegrityError,
    );
  });
});
