/**
 * Enumerations shared with the database. Kept in step with mobile/src/domain/enums
 * and the Postgres enums by scripts/check-enum-drift.mjs (run in CI), so a change on
 * one side cannot silently diverge from the other.
 */
export const PUBLICATION_STATUSES = [
  'DRAFT',
  'SOURCE_ATTACHED',
  'REVIEWED',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'RETRACTED',
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

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

export const TIER_ONE_SOURCE_TYPES: readonly SourceType[] = [
  'OFFICIAL_GOVERNMENT',
  'COURT_OR_TRIBUNAL',
  'LEGISLATIVE_RECORD',
];

export const ELECTION_STATUSES = ['UPCOMING', 'ONGOING', 'COMPLETED'] as const;
export const OFFICE_LEVELS = ['NATIONAL', 'PROVINCIAL', 'CITY', 'MUNICIPAL', 'DISTRICT', 'BARANGAY'] as const;
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
export const OFFICE_TERM_STATUSES = ['HELD', 'ACTING', 'APPOINTED', 'ELECTED'] as const;
export const POLITICAL_ORGANIZATION_TYPES = ['POLITICAL_PARTY', 'PARTY_LIST', 'COALITION', 'OTHER'] as const;
export const AFFILIATION_TYPES = ['MEMBER', 'CANDIDATE', 'LEADER', 'ENDORSED_BY', 'COALITION'] as const;
export const POLICY_ATTRIBUTION_TYPES = [
  'SELF_DECLARED',
  'OFFICIAL_PLATFORM',
  'LEGISLATIVE_ACTION',
  'INTERVIEW',
  'SPEECH',
] as const;
export const CLAIM_SUBJECT_RECORD_TYPES = [
  'PERSON',
  'ELECTION_PARTICIPATION',
  'OFFICE_TERM',
  'AFFILIATION',
  'EDUCATION',
  'POLICY_POSITION',
] as const;

/** Claim types an editor may create. Trust or character judgments are not claim types. */
export const CLAIM_TYPES = [
  'BIRTH_DATE',
  'CANDIDACY_STATUS',
  'OFFICE_TERM',
  'AFFILIATION',
  'EDUCATION',
  'POLICY_POSITION',
] as const;

export const CORRECTION_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'RESOLVED'] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export const EDITORIAL_ROLES = ['REVIEWER', 'APPROVER', 'ADMIN'] as const;
export type EditorialRole = (typeof EDITORIAL_ROLES)[number];

export function label(value: string): string {
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
