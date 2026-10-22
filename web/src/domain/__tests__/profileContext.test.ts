import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { isCurrentOn } from '@/domain/currentRecords';
import type { PersonProfile } from '@/domain/models/personProfile';
import { deriveProfileContext } from '@/domain/profileContext';

const repos = createMockRepositories();
const TODAY = '2026-10-08';

async function profile(id: string): Promise<PersonProfile> {
  const result = await repos.people.getPersonProfile(id);
  if (!result) throw new Error(`missing ${id}`);
  return result;
}

describe('isCurrentOn', () => {
  it('requires a known start that has begun, and an end that has not passed', () => {
    expect(isCurrentOn(TODAY, '2020-01-01', undefined)).toBe(true);
    expect(isCurrentOn(TODAY, '2020-01-01', '2026-10-08')).toBe(true);
    expect(isCurrentOn(TODAY, '2020-01-01', '2026-10-07')).toBe(false);
    expect(isCurrentOn(TODAY, '2026-10-09', undefined)).toBe(false);
  });

  it('never treats a missing start date as current', () => {
    expect(isCurrentOn(TODAY, undefined, undefined)).toBe(false);
  });
});

describe('deriveProfileContext', () => {
  it('headlines a current, evidenced office and affiliation, and the upcoming election context', async () => {
    const ramon = deriveProfileContext(await profile('person-ramon-gawa-gawa'), TODAY);
    expect(ramon.currentOffices.map((o) => o.record.office.name)).toEqual([
      'Governor, Province of Kathang-Isip (fictional)',
    ]);
    expect(ramon.currentAffiliations.map((a) => a.record.organization.name)).toEqual([
      'Alyansang Bagong-Umaga (fictional)',
    ]);
    expect(ramon.electionContext).toEqual([]); // 2022 election is completed

    const luz = deriveProfileContext(await profile('person-luz-ejemplo'), TODAY);
    expect(luz.electionContext.map((p) => p.record.participation.status)).toEqual(['FILED_COC']);
  });

  it('omits a term with an end date in the past and an affiliation that ended', async () => {
    const elena = deriveProfileContext(await profile('person-elena-kathang-isip'), TODAY);
    expect(elena.currentOffices).toEqual([]);
    expect(elena.currentAffiliations).toEqual([]);
  });

  it('does not headline records whose only evidence is OUTDATED or absent', async () => {
    const juan = deriveProfileContext(await profile('person-juan-dela-cruz'), TODAY);
    expect(juan.currentAffiliations).toEqual([]); // dated as ongoing, but the claim is OUTDATED
    const pedro = deriveProfileContext(await profile('person-pedro-santos'), TODAY);
    expect(pedro.currentOffices).toEqual([]); // dated as ongoing, but UNVERIFIED with no source
    const tomas = deriveProfileContext(await profile('person-tomas-ejemplo'), TODAY);
    expect(tomas.currentAffiliations).toEqual([]);
  });

  it('keeps aspirant and withdrawn states in the election context without calling them candidates', async () => {
    const carlo = deriveProfileContext(await profile('person-carlo-haka-haka'), TODAY);
    expect(carlo.electionContext.map((p) => p.record.participation.status)).toEqual(['WITHDRAWN']);
    const pedro = deriveProfileContext(await profile('person-pedro-santos'), TODAY);
    expect(pedro.electionContext.map((p) => p.record.participation.status)).toEqual([
      'POTENTIAL_ASPIRANT',
    ]);
  });
});
