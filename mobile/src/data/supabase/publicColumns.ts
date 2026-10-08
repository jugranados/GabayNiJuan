/**
 * Columns the public (anon) role may read, per table.
 *
 * Postgres grants anon column-level SELECT only: editorial identity columns
 * (created_by, approved_by, reviewed_by, published_by) are not readable, so a
 * bare `select *` fails. The app therefore asks for exactly the columns its
 * Zod row contracts validate. See supabase/migrations/*_restrict_public_access.sql.
 *
 * schemaDrift.ts guarantees at compile time that every column listed here
 * exists in the database.
 */
import type { z } from 'zod';

import {
  affiliationRecordRowSchema,
  assetDisclosureRecordRowSchema,
  awardRecordRowSchema,
  claimEvidenceRowSchema,
  claimRowSchema,
  educationRecordRowSchema,
  electionParticipationRowSchema,
  electionRowSchema,
  legalCaseRecordRowSchema,
  officeRowSchema,
  officeTermRowSchema,
  personRowSchema,
  policyPositionRecordRowSchema,
  politicalOrganizationRowSchema,
  sourceRowSchema,
} from '@/data/schemas/rows';
import type { TableName } from '@/data/repositories/rowSource';

const ROW_SCHEMAS = {
  people: personRowSchema,
  elections: electionRowSchema,
  offices: officeRowSchema,
  election_participations: electionParticipationRowSchema,
  office_terms: officeTermRowSchema,
  political_organizations: politicalOrganizationRowSchema,
  affiliation_records: affiliationRecordRowSchema,
  education_records: educationRecordRowSchema,
  award_records: awardRecordRowSchema,
  policy_position_records: policyPositionRecordRowSchema,
  legal_case_records: legalCaseRecordRowSchema,
  asset_disclosure_records: assetDisclosureRecordRowSchema,
  sources: sourceRowSchema,
  claims: claimRowSchema,
  claim_evidence: claimEvidenceRowSchema,
} as const satisfies Record<TableName, z.ZodObject>;

/** Editorial identity columns that must never be requested by the voter app. */
export const EDITORIAL_IDENTITY_COLUMNS = [
  'created_by',
  'approved_by',
  'reviewed_by',
  'published_by',
] as const;

export function publicColumnsFor(table: TableName): string[] {
  return Object.keys(ROW_SCHEMAS[table].shape);
}

export type PublicRowSchemas = typeof ROW_SCHEMAS;
