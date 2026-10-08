/**
 * Composes validated domain records into the PersonProfile read model.
 * Pure function: no I/O, so it can be shared by every repository backend.
 */
import type { ClaimSubjectRecordType } from '@/domain/enums';
import type {
  AffiliationRecord,
  Claim,
  ClaimEvidence,
  EducationRecord,
  Election,
  ElectionParticipation,
  Office,
  OfficeTerm,
  Person,
  PolicyPositionRecord,
  PoliticalOrganization,
  Source,
} from '@/domain/models';
import type {
  Attested,
  ClaimWithEvidence,
  EvidenceItem,
  PersonProfile,
} from '@/domain/models/personProfile';
import { DataIntegrityError } from '@/domain/validation/errors';

export type ProfileParts = {
  person: Person;
  electionParticipations: ElectionParticipation[];
  officeTerms: OfficeTerm[];
  affiliations: AffiliationRecord[];
  education: EducationRecord[];
  policyPositions: PolicyPositionRecord[];
  elections: Election[];
  offices: Office[];
  organizations: PoliticalOrganization[];
  claims: Claim[];
  evidence: ClaimEvidence[];
  sources: Source[];
};

function indexById<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function requireRef<T>(map: Map<string, T>, id: string, what: string, from: string): T {
  const found = map.get(id);
  if (!found) {
    throw new DataIntegrityError(`${from} references missing ${what} "${id}"`);
  }
  return found;
}

export function buildEvidenceItems(
  claimId: string,
  evidence: readonly ClaimEvidence[],
  sourcesById: Map<string, Source>,
): EvidenceItem[] {
  return evidence
    .filter((link) => link.claimId === claimId)
    .map((link) => ({
      link,
      source: requireRef(sourcesById, link.sourceId, 'source', `evidence for claim ${claimId}`),
    }));
}

export function assemblePersonProfile(parts: ProfileParts): PersonProfile {
  const sourcesById = indexById(parts.sources);
  const electionsById = indexById(parts.elections);
  const officesById = indexById(parts.offices);
  const organizationsById = indexById(parts.organizations);

  const personClaims = parts.claims.filter((claim) => claim.subjectPersonId === parts.person.id);
  const claimsWithEvidence: ClaimWithEvidence[] = personClaims.map((claim) => ({
    claim,
    evidence: buildEvidenceItems(claim.id, parts.evidence, sourcesById),
  }));

  const claimsFor = (type: ClaimSubjectRecordType, id: string): ClaimWithEvidence[] =>
    claimsWithEvidence.filter(
      ({ claim }) => claim.subjectRecord?.type === type && claim.subjectRecord.id === id,
    );

  const attest = <T>(type: ClaimSubjectRecordType, id: string, record: T): Attested<T> => ({
    record,
    claims: claimsFor(type, id),
  });

  const usedSources = new Map<string, Source>();
  for (const { evidence } of claimsWithEvidence) {
    for (const { source } of evidence) {
      usedSources.set(source.id, source);
    }
  }

  const reviewDates = personClaims
    .map((claim) => claim.lastReviewedAt)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    person: parts.person,
    identityClaims: claimsFor('PERSON', parts.person.id),
    electionParticipations: parts.electionParticipations.map((participation) =>
      attest('ELECTION_PARTICIPATION', participation.id, {
        participation,
        election: requireRef(
          electionsById,
          participation.electionId,
          'election',
          `participation ${participation.id}`,
        ),
        office: requireRef(
          officesById,
          participation.officeId,
          'office',
          `participation ${participation.id}`,
        ),
      }),
    ),
    officeTerms: parts.officeTerms.map((term) =>
      attest('OFFICE_TERM', term.id, {
        term,
        office: requireRef(officesById, term.officeId, 'office', `office term ${term.id}`),
      }),
    ),
    affiliations: parts.affiliations.map((affiliation) =>
      attest('AFFILIATION', affiliation.id, {
        affiliation,
        organization: requireRef(
          organizationsById,
          affiliation.organizationId,
          'organization',
          `affiliation ${affiliation.id}`,
        ),
      }),
    ),
    education: parts.education.map((record) => attest('EDUCATION', record.id, record)),
    policyPositions: parts.policyPositions.map((record) =>
      attest('POLICY_POSITION', record.id, record),
    ),
    sources: [...usedSources.values()],
    evidenceSummary: {
      claimCount: personClaims.length,
      sourceCount: usedSources.size,
      lastReviewedAt: reviewDates.at(-1),
    },
  };
}
