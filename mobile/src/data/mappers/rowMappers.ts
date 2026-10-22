/**
 * Validated row -> domain model. Mappers only rename and convert `null` to
 * `undefined`; they never fill in, derive, or reinterpret political data.
 */
import type { DirectoryItemRow } from '@/data/schemas/directory';
import { formatPersonName } from '@/domain/models/person';
import type { DirectoryEntry } from '@/domain/models/directory';
import type {
  AffiliationRecord,
  AssetDisclosureRecord,
  AwardRecord,
  Claim,
  ClaimEvidence,
  EducationRecord,
  Election,
  ElectionParticipation,
  LegalCaseRecord,
  Office,
  OfficeTerm,
  Person,
  PolicyPositionRecord,
  PoliticalOrganization,
  Revision,
  Source,
} from '@/domain/models';
import type {
  AffiliationRecordRow,
  AssetDisclosureRecordRow,
  AwardRecordRow,
  ClaimEvidenceRow,
  ClaimRow,
  EducationRecordRow,
  ElectionParticipationRow,
  ElectionRow,
  LegalCaseRecordRow,
  OfficeRow,
  OfficeTermRow,
  PersonRow,
  PolicyPositionRecordRow,
  PoliticalOrganizationRow,
  RevisionRow,
  SourceRow,
} from '@/data/schemas/rows';

const opt = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

export function toPerson(row: PersonRow): Person {
  return {
    id: row.id,
    firstName: row.first_name,
    middleName: opt(row.middle_name),
    lastName: row.last_name,
    suffix: opt(row.suffix),
    preferredName: opt(row.preferred_name),
    birthDate: opt(row.birth_date),
    photoAssetId: opt(row.photo_asset_id),
  };
}

export function toElection(row: ElectionRow): Election {
  return {
    id: row.id,
    name: row.name,
    electionDate: row.election_date,
    countryCode: row.country_code,
    status: row.status,
  };
}

export function toOffice(row: OfficeRow): Office {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    jurisdictionId: opt(row.jurisdiction_id),
  };
}

export function toElectionParticipation(row: ElectionParticipationRow): ElectionParticipation {
  return {
    id: row.id,
    personId: row.person_id,
    electionId: row.election_id,
    officeId: row.office_id,
    ballotNumber: opt(row.ballot_number),
    status: row.status,
    effectiveFrom: row.effective_from,
    effectiveTo: opt(row.effective_to),
  };
}

export function toOfficeTerm(row: OfficeTermRow): OfficeTerm {
  return {
    id: row.id,
    personId: row.person_id,
    officeId: row.office_id,
    startDate: opt(row.start_date),
    endDate: opt(row.end_date),
    status: row.status,
  };
}

export function toPoliticalOrganization(row: PoliticalOrganizationRow): PoliticalOrganization {
  return {
    id: row.id,
    name: row.name,
    abbreviation: opt(row.abbreviation),
    organizationType: row.organization_type,
  };
}

export function toAffiliationRecord(row: AffiliationRecordRow): AffiliationRecord {
  return {
    id: row.id,
    personId: row.person_id,
    organizationId: row.organization_id,
    affiliationType: row.affiliation_type,
    startDate: opt(row.start_date),
    endDate: opt(row.end_date),
  };
}

export function toEducationRecord(row: EducationRecordRow): EducationRecord {
  return {
    id: row.id,
    personId: row.person_id,
    institution: row.institution,
    program: opt(row.program),
    credential: opt(row.credential),
    startDate: opt(row.start_date),
    endDate: opt(row.end_date),
  };
}

export function toAwardRecord(row: AwardRecordRow): AwardRecord {
  return {
    id: row.id,
    personId: row.person_id,
    title: row.title,
    issuer: row.issuer,
    awardedAt: opt(row.awarded_at),
  };
}

export function toPolicyPositionRecord(row: PolicyPositionRecordRow): PolicyPositionRecord {
  return {
    id: row.id,
    personId: row.person_id,
    topic: row.topic,
    positionText: row.position_text,
    attributionType: row.attribution_type,
    statedAt: opt(row.stated_at),
  };
}

export function toLegalCaseRecord(row: LegalCaseRecordRow): LegalCaseRecord {
  return {
    id: row.id,
    personId: row.person_id,
    authority: row.authority,
    caseNumber: opt(row.case_number),
    title: opt(row.title),
    proceedingType: opt(row.proceeding_type),
    status: row.status,
    filingDate: opt(row.filing_date),
    statusDate: opt(row.status_date),
    neutralSummary: opt(row.neutral_summary),
  };
}

export function toAssetDisclosureRecord(row: AssetDisclosureRecordRow): AssetDisclosureRecord {
  return {
    id: row.id,
    personId: row.person_id,
    disclosureType: row.disclosure_type,
    reportingDate: opt(row.reporting_date),
    netWorthAmount: opt(row.net_worth_amount),
    currency: opt(row.currency),
  };
}

export function toSource(row: SourceRow): Source {
  return {
    id: row.id,
    title: row.title,
    publisher: row.publisher,
    url: opt(row.url),
    documentIdentifier: opt(row.document_identifier),
    sourceType: row.source_type,
    publishedAt: opt(row.published_at),
    retrievedAt: row.retrieved_at,
    archivedUrl: opt(row.archived_url),
  };
}

export function toClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    subjectPersonId: opt(row.subject_person_id),
    subjectRecord:
      row.subject_record_type && row.subject_record_id
        ? { type: row.subject_record_type, id: row.subject_record_id }
        : undefined,
    claimType: row.claim_type,
    statement: row.statement,
    effectiveFrom: opt(row.effective_from),
    effectiveTo: opt(row.effective_to),
    verificationStatus: row.verification_status,
    lastReviewedAt: opt(row.last_reviewed_at),
  };
}

export function toClaimEvidence(row: ClaimEvidenceRow): ClaimEvidence {
  return {
    claimId: row.claim_id,
    sourceId: row.source_id,
    supports: row.supports,
    note: opt(row.note),
  };
}

export function toRevision(row: RevisionRow): Revision {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldValue: opt(row.old_value),
    newValue: opt(row.new_value),
    editorId: row.editor_id,
    approverId: opt(row.approver_id),
    reason: row.reason,
    createdAt: row.created_at,
    approvalState: row.approval_state,
  };
}

export function toDirectoryEntry(row: DirectoryItemRow): DirectoryEntry {
  const person = toPerson({
    id: row.id,
    first_name: row.first_name,
    middle_name: row.middle_name,
    last_name: row.last_name,
    suffix: row.suffix,
    preferred_name: row.preferred_name,
    birth_date: undefined,
    photo_asset_id: row.photo_asset_id,
  });
  return {
    id: row.id,
    displayName: formatPersonName(person),
    photoAssetId: person.photoAssetId,
    participations: row.participations.map((p) => ({
      officeName: p.office_name,
      electionName: p.election_name,
      electionDate: p.election_date,
      status: p.status,
      effectiveFrom: p.effective_from,
    })),
    affiliation: row.affiliation
      ? {
          organizationName: row.affiliation.organization_name,
          affiliationType: row.affiliation.affiliation_type,
          startDate: row.affiliation.start_date,
        }
      : undefined,
  };
}
