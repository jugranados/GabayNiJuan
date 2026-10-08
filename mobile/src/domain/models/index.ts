/**
 * Domain models. These are independent of Supabase/Postgres row shapes;
 * see src/data/schemas for the backend row contracts and src/data/mappers
 * for the conversion.
 *
 * Conventions:
 * - Identifiers are opaque strings; relationships use ids, never names.
 * - Dates are ISO-8601 strings: `IsoDate` (YYYY-MM-DD) for events and
 *   `IsoDateTime` for audit timestamps.
 * - Optional fields are `undefined` when unknown. Unknown is never filled in.
 *
 * Deliberately absent: any boolean "criminal record" flag, any score,
 * rating, ranking, endorsement, or prediction field.
 */
import type {
  AffiliationType,
  ClaimSubjectRecordType,
  Currency,
  ElectionParticipationStatus,
  ElectionStatus,
  LegalCaseStatus,
  OfficeLevel,
  OfficeTermStatus,
  PolicyAttributionType,
  PoliticalOrganizationType,
  PublicationStatus,
  RevisionEntityType,
  SourceType,
  VerificationStatus,
} from '@/domain/enums';

/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** Timestamp with offset, e.g. `2026-10-07T10:00:00Z`. */
export type IsoDateTime = string;

/** Any JSON value, as stored in audit snapshots. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Stable identity of a public/political figure. Age is derived, never stored. */
export type Person = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  preferredName?: string;
  birthDate?: IsoDate;
  photoAssetId?: string;
};

export type Election = {
  id: string;
  name: string;
  electionDate: IsoDate;
  countryCode: 'PH';
  status: ElectionStatus;
};

export type Office = {
  id: string;
  name: string;
  level: OfficeLevel;
  jurisdictionId?: string;
};

export type ElectionParticipation = {
  id: string;
  personId: string;
  electionId: string;
  officeId: string;
  ballotNumber?: string;
  status: ElectionParticipationStatus;
  effectiveFrom: IsoDate;
  effectiveTo?: IsoDate;
};

export type OfficeTerm = {
  id: string;
  personId: string;
  officeId: string;
  startDate?: IsoDate;
  endDate?: IsoDate;
  status: OfficeTermStatus;
};

export type PoliticalOrganization = {
  id: string;
  name: string;
  abbreviation?: string;
  organizationType: PoliticalOrganizationType;
};

export type AffiliationRecord = {
  id: string;
  personId: string;
  organizationId: string;
  affiliationType: AffiliationType;
  startDate?: IsoDate;
  endDate?: IsoDate;
};

export type EducationRecord = {
  id: string;
  personId: string;
  institution: string;
  program?: string;
  credential?: string;
  startDate?: IsoDate;
  endDate?: IsoDate;
};

export type AwardRecord = {
  id: string;
  personId: string;
  title: string;
  /** Who conferred the award. Required: an award without an issuer is not publishable. */
  issuer: string;
  awardedAt?: IsoDate;
};

export type PolicyPositionRecord = {
  id: string;
  personId: string;
  topic: string;
  /** The attributed position, as stated. Never strengthened or summarized beyond the evidence. */
  positionText: string;
  attributionType: PolicyAttributionType;
  statedAt?: IsoDate;
};

export type LegalCaseRecord = {
  id: string;
  personId: string;
  authority: string;
  caseNumber?: string;
  title?: string;
  proceedingType?: string;
  status: LegalCaseStatus;
  filingDate?: IsoDate;
  statusDate?: IsoDate;
  neutralSummary?: string;
};

export type AssetDisclosureRecord = {
  id: string;
  personId: string;
  disclosureType: string;
  reportingDate?: IsoDate;
  netWorthAmount?: number;
  currency?: Currency;
};

// ---------------------------------------------------------------------------
// Evidence system
// ---------------------------------------------------------------------------

export type Source = {
  id: string;
  title: string;
  publisher: string;
  url?: string;
  /** Non-URL document identifier (e.g. resolution or docket number). */
  documentIdentifier?: string;
  sourceType: SourceType;
  publishedAt?: IsoDate;
  retrievedAt: IsoDate;
  archivedUrl?: string;
};

/** The domain record a claim attests to, so the UI can show evidence beside it. */
export type ClaimSubjectRecord = {
  type: ClaimSubjectRecordType;
  id: string;
};

/** A precise proposition displayed or used by the application. */
export type Claim = {
  id: string;
  subjectPersonId?: string;
  subjectRecord?: ClaimSubjectRecord;
  claimType: string;
  statement: string;
  effectiveFrom?: IsoDate;
  effectiveTo?: IsoDate;
  verificationStatus: VerificationStatus;
  lastReviewedAt?: IsoDate;
};

/** Many-to-many link between a claim and a source. */
export type ClaimEvidence = {
  claimId: string;
  sourceId: string;
  /** `false` means the source contradicts the claim. Contradictions are preserved, not dropped. */
  supports: boolean;
  note?: string;
};

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export type Revision = {
  id: string;
  entityType: RevisionEntityType;
  /** Record id; `claimId:sourceId` for claim evidence. */
  entityId: string;
  /** Row snapshot before the change; undefined for creations. */
  oldValue?: JsonValue;
  /** Row snapshot after the change; undefined for removals. */
  newValue?: JsonValue;
  /** Editor's user id, or `system:<db role>` for maintenance changes. */
  editorId: string;
  approverId?: string;
  reason: string;
  createdAt: IsoDateTime;
  /** Publication status of the record after this change. */
  approvalState: PublicationStatus;
};
