/**
 * Verification consistency over the fictional fixtures (and therefore over
 * supabase/seed.sql, which is generated from them). CI runs this suite on its
 * own via `npm run test:consistency`. Inconsistent data fails; nothing is
 * corrected silently.
 */
import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { VERIFICATION_STATUSES } from '@/domain/enums';
import type { PersonProfile } from '@/domain/models/personProfile';
import { checkVerificationConsistency } from '@/domain/validation/verification';

const repos = createMockRepositories();
const personIds = (devFixtureTables.people ?? []).map((row) => (row as { id: string }).id);
const claimIds = (devFixtureTables.claims ?? []).map((row) => (row as { id: string }).id);

async function profileOf(id: string): Promise<PersonProfile> {
  const profile = await repos.people.getPersonProfile(id);
  if (!profile) throw new Error(`missing fixture profile ${id}`);
  return profile;
}

describe('fixture verification consistency', () => {
  it.each(claimIds)('claim %s matches its verification status', async (claimId) => {
    const detail = await repos.claims.getClaimDetail(claimId);
    if (!detail) throw new Error(`missing claim ${claimId}`);
    expect({
      id: claimId,
      issues: checkVerificationConsistency(detail.claim, detail.evidence),
    }).toEqual({ id: claimId, issues: [] });
  });

  it('demonstrates every verification status at least once', () => {
    const used = new Set(
      (devFixtureTables.claims ?? []).map(
        (row) => (row as { verification_status: string }).verification_status,
      ),
    );
    expect([...used].sort()).toEqual([...VERIFICATION_STATUSES].sort());
  });

  it('keeps a DISPUTED example with supporting and contradicting evidence', async () => {
    const disputed = (devFixtureTables.claims ?? []).filter(
      (row) => (row as { verification_status: string }).verification_status === 'DISPUTED',
    ) as { id: string }[];
    expect(disputed.length).toBeGreaterThan(0);
    for (const { id } of disputed) {
      const detail = await repos.claims.getClaimDetail(id);
      expect(detail?.evidence.some((e) => e.link.supports)).toBe(true);
      expect(detail?.evidence.some((e) => !e.link.supports)).toBe(true);
    }
  });

  it.each(personIds)('every displayed record for %s is attested by a claim', async (id) => {
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
  });

  it('only links to the reserved example.org domain', () => {
    for (const row of devFixtureTables.sources ?? []) {
      const { url, archived_url } = row as { url: string | null; archived_url: string | null };
      for (const link of [url, archived_url].filter(Boolean)) {
        expect(new URL(link as string).hostname).toBe('example.org');
      }
    }
  });
});

describe('consistency checks reject inconsistent data', () => {
  it('flags a claim whose status is stronger than its evidence', async () => {
    const detail = await repos.claims.getClaimDetail('claim-pedro-potential-aspirant');
    if (!detail) throw new Error('missing claim');
    const issues = checkVerificationConsistency(
      { verificationStatus: 'PRIMARY_SOURCE' },
      detail.evidence,
    );
    expect(issues.map((i) => i.code)).toEqual(['NO_PRIMARY_SOURCE']);
  });
});
