/**
 * Read models composed for the UI. These are views over domain records,
 * not database table designs.
 */
import type {
  AffiliationRecord,
  Claim,
  ClaimEvidence,
  EducationRecord,
  Election,
  ElectionParticipation,
  IsoDate,
  Office,
  OfficeTerm,
  Person,
  PolicyPositionRecord,
  PoliticalOrganization,
  Source,
} from '@/domain/models';

export type EvidenceItem = {
  link: ClaimEvidence;
  source: Source;
};

export type ClaimWithEvidence = {
  claim: Claim;
  evidence: EvidenceItem[];
};

/**
 * A record together with every claim that attests to it.
 * An empty `claims` array means no evidence is attached; the UI must show
 * that explicitly rather than presenting the record as established fact.
 */
export type Attested<T> = {
  record: T;
  claims: ClaimWithEvidence[];
};

export type ElectionParticipationDetail = {
  participation: ElectionParticipation;
  election: Election;
  office: Office;
};

export type OfficeTermDetail = {
  term: OfficeTerm;
  office: Office;
};

export type AffiliationDetail = {
  affiliation: AffiliationRecord;
  organization: PoliticalOrganization;
};

/** Counts only. Deliberately not a score or a rating of the person. */
export type EvidenceSummary = {
  claimCount: number;
  sourceCount: number;
  lastReviewedAt?: IsoDate;
};

/**
 * Legal cases and asset disclosures are intentionally not part of the
 * profile until Milestone 4. Their absence here must never be shown to a
 * voter as "none on record".
 */
export type PersonProfile = {
  person: Person;
  identityClaims: ClaimWithEvidence[];
  electionParticipations: Attested<ElectionParticipationDetail>[];
  officeTerms: Attested<OfficeTermDetail>[];
  affiliations: Attested<AffiliationDetail>[];
  education: Attested<EducationRecord>[];
  policyPositions: Attested<PolicyPositionRecord>[];
  sources: Source[];
  evidenceSummary: EvidenceSummary;
};

/**
 * Everything the source viewer shows for one claim. `subject` is present only
 * when the claim is about a person who is publicly readable.
 * Evidence keeps both supporting and contradicting sources.
 */
export type ClaimDetail = ClaimWithEvidence & {
  subject?: PersonSummary;
};

/** Lightweight list item for directory screens. */
export type PersonSummary = {
  id: string;
  displayName: string;
};
