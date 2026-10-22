/**
 * Zod schemas for raw backend rows (snake_case, as returned by Supabase /
 * PostgREST). These are the provisional table contracts; Milestone 1 will
 * align them with the real migrations.
 *
 * Rules:
 * - No `z.coerce`: wrong types are rejected, not converted.
 * - Unknown enum values are rejected.
 * - Nullable columns use `.nullish()`; mappers turn `null` into `undefined`.
 * - Unknown extra columns are stripped (not trusted, not displayed).
 */
import { z } from 'zod';

import {
  AFFILIATION_TYPES,
  CLAIM_SUBJECT_RECORD_TYPES,
  CURRENCIES,
  ELECTION_PARTICIPATION_STATUSES,
  ELECTION_STATUSES,
  LEGAL_CASE_STATUSES,
  OFFICE_LEVELS,
  OFFICE_TERM_STATUSES,
  POLICY_ATTRIBUTION_TYPES,
  POLITICAL_ORGANIZATION_TYPES,
  PUBLICATION_STATUSES,
  REVISION_ENTITY_TYPES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
} from '@/domain/enums';
import {
  httpUrlSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  isReversedRange,
  nonEmptyTextSchema,
} from '@/domain/validation/primitives';

const optionalText = nonEmptyTextSchema.nullish();
const optionalDate = isoDateSchema.nullish();
const optionalId = idSchema.nullish();

function dateRangeRefinement<T extends Record<string, unknown>>(
  startKey: keyof T & string,
  endKey: keyof T & string,
) {
  return (row: T, ctx: z.RefinementCtx) => {
    const start = row[startKey];
    const end = row[endKey];
    if (isReversedRange(start as string | null | undefined, end as string | null | undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [endKey],
        message: `${endKey} must not be earlier than ${startKey}`,
      });
    }
  };
}

export const personRowSchema = z.object({
  id: idSchema,
  first_name: nonEmptyTextSchema,
  middle_name: optionalText,
  last_name: nonEmptyTextSchema,
  suffix: optionalText,
  preferred_name: optionalText,
  birth_date: optionalDate,
  photo_asset_id: optionalId,
});

export const electionRowSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  election_date: isoDateSchema,
  country_code: z.literal('PH'),
  status: z.enum(ELECTION_STATUSES),
});

export const officeRowSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  level: z.enum(OFFICE_LEVELS),
  jurisdiction_id: optionalId,
});

export const electionParticipationRowSchema = z
  .object({
    id: idSchema,
    person_id: idSchema,
    election_id: idSchema,
    office_id: idSchema,
    ballot_number: optionalText,
    status: z.enum(ELECTION_PARTICIPATION_STATUSES),
    effective_from: isoDateSchema,
    effective_to: optionalDate,
  })
  .superRefine(dateRangeRefinement('effective_from', 'effective_to'));

export const officeTermRowSchema = z
  .object({
    id: idSchema,
    person_id: idSchema,
    office_id: idSchema,
    start_date: optionalDate,
    end_date: optionalDate,
    status: z.enum(OFFICE_TERM_STATUSES),
  })
  .superRefine(dateRangeRefinement('start_date', 'end_date'));

export const politicalOrganizationRowSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  abbreviation: optionalText,
  organization_type: z.enum(POLITICAL_ORGANIZATION_TYPES),
});

export const affiliationRecordRowSchema = z
  .object({
    id: idSchema,
    person_id: idSchema,
    organization_id: idSchema,
    affiliation_type: z.enum(AFFILIATION_TYPES),
    start_date: optionalDate,
    end_date: optionalDate,
  })
  .superRefine(dateRangeRefinement('start_date', 'end_date'));

export const educationRecordRowSchema = z
  .object({
    id: idSchema,
    person_id: idSchema,
    institution: nonEmptyTextSchema,
    program: optionalText,
    credential: optionalText,
    start_date: optionalDate,
    end_date: optionalDate,
  })
  .superRefine(dateRangeRefinement('start_date', 'end_date'));

export const awardRecordRowSchema = z.object({
  id: idSchema,
  person_id: idSchema,
  title: nonEmptyTextSchema,
  issuer: nonEmptyTextSchema,
  awarded_at: optionalDate,
});

export const policyPositionRecordRowSchema = z.object({
  id: idSchema,
  person_id: idSchema,
  topic: nonEmptyTextSchema,
  position_text: nonEmptyTextSchema,
  attribution_type: z.enum(POLICY_ATTRIBUTION_TYPES),
  stated_at: optionalDate,
});

export const legalCaseRecordRowSchema = z.object({
  id: idSchema,
  person_id: idSchema,
  authority: nonEmptyTextSchema,
  case_number: optionalText,
  title: optionalText,
  proceeding_type: optionalText,
  status: z.enum(LEGAL_CASE_STATUSES),
  filing_date: optionalDate,
  status_date: optionalDate,
  neutral_summary: optionalText,
});

export const assetDisclosureRecordRowSchema = z
  .object({
    id: idSchema,
    person_id: idSchema,
    disclosure_type: nonEmptyTextSchema,
    reporting_date: optionalDate,
    net_worth_amount: z.number().finite().nullish(),
    currency: z.enum(CURRENCIES).nullish(),
  })
  .superRefine((row, ctx) => {
    if (row.net_worth_amount != null && row.currency == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['currency'],
        message: 'currency is required when net_worth_amount is present',
      });
    }
  });

export const sourceRowSchema = z
  .object({
    id: idSchema,
    title: nonEmptyTextSchema,
    publisher: nonEmptyTextSchema,
    url: httpUrlSchema.nullish(),
    document_identifier: optionalText,
    source_type: z.enum(SOURCE_TYPES),
    published_at: optionalDate,
    retrieved_at: isoDateSchema,
    archived_url: httpUrlSchema.nullish(),
  })
  .superRefine((row, ctx) => {
    if (!row.url && !row.document_identifier) {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'a source needs a URL or a document identifier',
      });
    }
  });

export const claimRowSchema = z
  .object({
    id: idSchema,
    subject_person_id: optionalId,
    subject_record_type: z.enum(CLAIM_SUBJECT_RECORD_TYPES).nullish(),
    subject_record_id: optionalId,
    claim_type: nonEmptyTextSchema,
    statement: nonEmptyTextSchema,
    effective_from: optionalDate,
    effective_to: optionalDate,
    verification_status: z.enum(VERIFICATION_STATUSES),
    last_reviewed_at: optionalDate,
  })
  .superRefine(dateRangeRefinement('effective_from', 'effective_to'))
  .superRefine((row, ctx) => {
    if (Boolean(row.subject_record_type) !== Boolean(row.subject_record_id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['subject_record_id'],
        message: 'subject_record_type and subject_record_id must be set together',
      });
    }
  });

export const claimEvidenceRowSchema = z.object({
  claim_id: idSchema,
  source_id: idSchema,
  supports: z.boolean(),
  note: optionalText,
});

export const revisionRowSchema = z.object({
  id: idSchema,
  entity_type: z.enum(REVISION_ENTITY_TYPES),
  entity_id: idSchema,
  old_value: z.json().nullish(),
  new_value: z.json().nullish(),
  editor_id: idSchema,
  approver_id: optionalId,
  reason: nonEmptyTextSchema,
  created_at: isoDateTimeSchema,
  approval_state: z.enum(PUBLICATION_STATUSES),
});

export type PersonRow = z.infer<typeof personRowSchema>;
export type ElectionRow = z.infer<typeof electionRowSchema>;
export type OfficeRow = z.infer<typeof officeRowSchema>;
export type ElectionParticipationRow = z.infer<typeof electionParticipationRowSchema>;
export type OfficeTermRow = z.infer<typeof officeTermRowSchema>;
export type PoliticalOrganizationRow = z.infer<typeof politicalOrganizationRowSchema>;
export type AffiliationRecordRow = z.infer<typeof affiliationRecordRowSchema>;
export type EducationRecordRow = z.infer<typeof educationRecordRowSchema>;
export type AwardRecordRow = z.infer<typeof awardRecordRowSchema>;
export type PolicyPositionRecordRow = z.infer<typeof policyPositionRecordRowSchema>;
export type LegalCaseRecordRow = z.infer<typeof legalCaseRecordRowSchema>;
export type AssetDisclosureRecordRow = z.infer<typeof assetDisclosureRecordRowSchema>;
export type SourceRow = z.infer<typeof sourceRowSchema>;
export type ClaimRow = z.infer<typeof claimRowSchema>;
export type ClaimEvidenceRow = z.infer<typeof claimEvidenceRowSchema>;
export type RevisionRow = z.infer<typeof revisionRowSchema>;
