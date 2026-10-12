import 'server-only';

import { formatPersonName } from '@/domain/models/person';
import type { CorrectionTargetType } from '@/domain/models/correction';
import { claimPath, politicianPath } from '@/features/politicians/paths';
import { getRepositories } from '@/server/repositories';

export type CorrectionTarget = {
  recordType: Extract<CorrectionTargetType, 'PERSON' | 'CLAIM'>;
  recordId: string;
  claimId?: string;
  /** What the report is about, read from the published record (never from the URL). */
  label: string;
  backHref: string;
};

/**
 * Resolves what a report is about from the public record. Only published
 * people and claims can be reported, and the label shown to the visitor always
 * comes from the database, so a link cannot make this page display arbitrary text.
 */
export async function resolveCorrectionTarget(
  type: string | undefined,
  id: string | undefined,
): Promise<CorrectionTarget | null> {
  if (!id || id.length > 64) return null;
  const repositories = getRepositories();
  if (type === 'person') {
    const person = await repositories.people.getPersonById(id);
    return person
      ? {
          recordType: 'PERSON',
          recordId: person.id,
          label: formatPersonName(person),
          backHref: politicianPath(person.slug),
        }
      : null;
  }
  if (type === 'claim') {
    const detail = await repositories.claims.getClaimDetail(id);
    return detail
      ? {
          recordType: 'CLAIM',
          recordId: detail.claim.id,
          claimId: detail.claim.id,
          label: detail.claim.statement,
          backHref: claimPath(detail.claim.id),
        }
      : null;
  }
  return null;
}
