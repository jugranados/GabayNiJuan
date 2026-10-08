/**
 * Domain enumerations, defined as readonly tuples so the same list can drive
 * both TypeScript unions and runtime (Zod) validation.
 *
 * See docs/DATA_MODEL.md and docs/DATA_TRUST_GOVERNANCE.md.
 */

export const ELECTION_STATUSES = ['UPCOMING', 'ONGOING', 'COMPLETED'] as const;
export type ElectionStatus = (typeof ELECTION_STATUSES)[number];

export const OFFICE_LEVELS = [
  'NATIONAL',
  'PROVINCIAL',
  'CITY',
  'MUNICIPAL',
  'DISTRICT',
  'BARANGAY',
] as const;
export type OfficeLevel = (typeof OFFICE_LEVELS)[number];

/**
 * Lifecycle of a person's relationship to a specific election and office.
 * POTENTIAL_ASPIRANT and PUBLICLY_DECLARED_ASPIRANT are NOT candidacies.
 */
export const ELECTION_PARTICIPATION_STATUSES = [
  'POTENTIAL_ASPIRANT',
  'PUBLICLY_DECLARED_ASPIRANT',
  'FILED_COC',
  'OFFICIAL_CANDIDATE',
  'WITHDRAWN',
  'DISQUALIFIED',
  'ELECTED',
  'NOT_ELECTED',
] as const;
export type ElectionParticipationStatus = (typeof ELECTION_PARTICIPATION_STATUSES)[number];

export const OFFICE_TERM_STATUSES = ['HELD', 'ACTING', 'APPOINTED', 'ELECTED'] as const;
export type OfficeTermStatus = (typeof OFFICE_TERM_STATUSES)[number];

export const POLITICAL_ORGANIZATION_TYPES = [
  'POLITICAL_PARTY',
  'PARTY_LIST',
  'COALITION',
  'OTHER',
] as const;
export type PoliticalOrganizationType = (typeof POLITICAL_ORGANIZATION_TYPES)[number];

export const AFFILIATION_TYPES = [
  'MEMBER',
  'CANDIDATE',
  'LEADER',
  'ENDORSED_BY',
  'COALITION',
] as const;
export type AffiliationType = (typeof AFFILIATION_TYPES)[number];

export const POLICY_ATTRIBUTION_TYPES = [
  'SELF_DECLARED',
  'OFFICIAL_PLATFORM',
  'LEGISLATIVE_ACTION',
  'INTERVIEW',
  'SPEECH',
] as const;
export type PolicyAttributionType = (typeof POLICY_ATTRIBUTION_TYPES)[number];

/**
 * Procedural status of a legal proceeding. These must never be collapsed into
 * a single boolean such as "has criminal record".
 */
export const LEGAL_CASE_STATUSES = [
  'COMPLAINT',
  'UNDER_INVESTIGATION',
  'CASE_FILED',
  'CHARGED',
  'PENDING',
  'DISMISSED',
  'ACQUITTED',
  'CONVICTED',
  'ON_APPEAL',
  'FINAL_JUDGMENT',
  'OTHER',
] as const;
export type LegalCaseStatus = (typeof LEGAL_CASE_STATUSES)[number];

export const CURRENCIES = ['PHP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const SOURCE_TYPES = [
  'OFFICIAL_GOVERNMENT',
  'COURT_OR_TRIBUNAL',
  'OFFICIAL_CANDIDATE',
  'LEGISLATIVE_RECORD',
  'NEWS',
  'ACADEMIC',
  'OTHER',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Source hierarchy tiers from docs/SOURCE_POLICY.md (1 = strongest). */
export type SourceTier = 1 | 2 | 3 | 4;

export const SOURCE_TIER_BY_TYPE: Readonly<Record<SourceType, SourceTier>> = {
  OFFICIAL_GOVERNMENT: 1,
  COURT_OR_TRIBUNAL: 1,
  LEGISLATIVE_RECORD: 1,
  OFFICIAL_CANDIDATE: 2,
  NEWS: 3,
  ACADEMIC: 4,
  OTHER: 4,
};

/**
 * Verification applies to an individual claim, never to a whole person.
 * These states describe evidence, not merit.
 */
export const VERIFICATION_STATUSES = [
  'PRIMARY_SOURCE',
  'CORROBORATED',
  'SELF_DECLARED',
  'REPORTED',
  'DISPUTED',
  'UNVERIFIED',
  'OUTDATED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Kinds of domain record a claim can attest to. */
export const CLAIM_SUBJECT_RECORD_TYPES = [
  'PERSON',
  'ELECTION_PARTICIPATION',
  'OFFICE_TERM',
  'AFFILIATION',
  'EDUCATION',
  'AWARD',
  'POLICY_POSITION',
  'LEGAL_CASE',
  'ASSET_DISCLOSURE',
] as const;
export type ClaimSubjectRecordType = (typeof CLAIM_SUBJECT_RECORD_TYPES)[number];

/** Editorial workflow state of a record (docs/DATA_TRUST_GOVERNANCE.md). Only PUBLISHED is public. */
export const PUBLICATION_STATUSES = [
  'DRAFT',
  'SOURCE_ATTACHED',
  'REVIEWED',
  'APPROVED',
  'PUBLISHED',
  'RETRACTED',
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/** Kinds of entity recorded in the revision (audit) log. */
export const REVISION_ENTITY_TYPES = [
  'PERSON',
  'ELECTION',
  'OFFICE',
  'POLITICAL_ORGANIZATION',
  'ELECTION_PARTICIPATION',
  'OFFICE_TERM',
  'AFFILIATION',
  'EDUCATION',
  'AWARD',
  'POLICY_POSITION',
  'LEGAL_CASE',
  'ASSET_DISCLOSURE',
  'SOURCE',
  'CLAIM',
  'CLAIM_EVIDENCE',
] as const;
export type RevisionEntityType = (typeof REVISION_ENTITY_TYPES)[number];
