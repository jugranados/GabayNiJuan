/**
 * Compile-time drift check between the database (generated types) and the
 * app's Zod row contracts. `npm run typecheck` fails when:
 *   - a DB row would be rejected by its Zod schema at the type level,
 *   - the Zod schema expects a column the DB does not have, or
 *   - a DB enum and the matching domain enum differ in either direction.
 *
 * Nothing here runs at runtime.
 */
import type { z } from 'zod';

import type * as rows from '@/data/schemas/rows';
import type * as enums from '@/domain/enums';

import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type DbRow<T extends keyof Tables> = Tables[T]['Row'];
type DbEnum<K extends keyof Database['public']['Enums']> = Database['public']['Enums'][K];

type Assert<T extends true> = T;

/**
 * Columns whose generated type is wider than what the database guarantees.
 * Each entry must name the constraint or fact that justifies it.
 */
type Narrowings = {
  // CHECK (country_code = 'PH') on public.elections.
  elections: { country_code: 'PH' };
  // Generated `Json` allows `undefined` object values, which JSON over the wire never contains.
  revisions: {
    old_value: z.input<typeof rows.revisionRowSchema>['old_value'];
    new_value: z.input<typeof rows.revisionRowSchema>['new_value'];
  };
};

type EffectiveRow<T extends keyof Tables> = T extends keyof Narrowings
  ? Omit<DbRow<T>, keyof Narrowings[T]> & Narrowings[T]
  : DbRow<T>;

type MatchesTable<T extends keyof Tables, S extends z.ZodType> =
  EffectiveRow<T> extends z.input<S>
    ? [Exclude<keyof z.input<S>, keyof DbRow<T>>] extends [never]
      ? true
      : { table: T; columnsMissingInDatabase: Exclude<keyof z.input<S>, keyof DbRow<T>> }
    : { table: T; databaseRowRejectedBySchema: true };

type SameUnion<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : { onlyInApp: Exclude<B, A> }
  : { onlyInDatabase: Exclude<A, B> };

export type TableContracts = [
  Assert<MatchesTable<'people', typeof rows.personRowSchema>>,
  Assert<MatchesTable<'elections', typeof rows.electionRowSchema>>,
  Assert<MatchesTable<'offices', typeof rows.officeRowSchema>>,
  Assert<MatchesTable<'election_participations', typeof rows.electionParticipationRowSchema>>,
  Assert<MatchesTable<'office_terms', typeof rows.officeTermRowSchema>>,
  Assert<MatchesTable<'political_organizations', typeof rows.politicalOrganizationRowSchema>>,
  Assert<MatchesTable<'affiliation_records', typeof rows.affiliationRecordRowSchema>>,
  Assert<MatchesTable<'education_records', typeof rows.educationRecordRowSchema>>,
  Assert<MatchesTable<'award_records', typeof rows.awardRecordRowSchema>>,
  Assert<MatchesTable<'policy_position_records', typeof rows.policyPositionRecordRowSchema>>,
  Assert<MatchesTable<'legal_case_records', typeof rows.legalCaseRecordRowSchema>>,
  Assert<MatchesTable<'asset_disclosure_records', typeof rows.assetDisclosureRecordRowSchema>>,
  Assert<MatchesTable<'sources', typeof rows.sourceRowSchema>>,
  Assert<MatchesTable<'claims', typeof rows.claimRowSchema>>,
  Assert<MatchesTable<'claim_evidence', typeof rows.claimEvidenceRowSchema>>,
  Assert<MatchesTable<'revisions', typeof rows.revisionRowSchema>>,
];

export type EnumContracts = [
  Assert<SameUnion<DbEnum<'election_status'>, enums.ElectionStatus>>,
  Assert<SameUnion<DbEnum<'office_level'>, enums.OfficeLevel>>,
  Assert<SameUnion<DbEnum<'election_participation_status'>, enums.ElectionParticipationStatus>>,
  Assert<SameUnion<DbEnum<'office_term_status'>, enums.OfficeTermStatus>>,
  Assert<SameUnion<DbEnum<'political_organization_type'>, enums.PoliticalOrganizationType>>,
  Assert<SameUnion<DbEnum<'affiliation_type'>, enums.AffiliationType>>,
  Assert<SameUnion<DbEnum<'policy_attribution_type'>, enums.PolicyAttributionType>>,
  Assert<SameUnion<DbEnum<'legal_case_status'>, enums.LegalCaseStatus>>,
  Assert<SameUnion<DbEnum<'currency_code'>, enums.Currency>>,
  Assert<SameUnion<DbEnum<'source_type'>, enums.SourceType>>,
  Assert<SameUnion<DbEnum<'verification_status'>, enums.VerificationStatus>>,
  Assert<SameUnion<DbEnum<'claim_subject_record_type'>, enums.ClaimSubjectRecordType>>,
  Assert<SameUnion<DbEnum<'publication_status'>, enums.PublicationStatus>>,
  Assert<SameUnion<DbEnum<'revision_entity_type'>, enums.RevisionEntityType>>,
];
