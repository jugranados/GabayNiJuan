import { z } from 'zod';

import {
  AFFILIATION_TYPES,
  CLAIM_SUBJECT_RECORD_TYPES,
  CLAIM_TYPES,
  ELECTION_PARTICIPATION_STATUSES,
  ELECTION_STATUSES,
  OFFICE_LEVELS,
  OFFICE_TERM_STATUSES,
  POLICY_ATTRIBUTION_TYPES,
  POLITICAL_ORGANIZATION_TYPES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
} from './enums';
import { findJudgmentWording } from './wording';

export type FieldKind = 'text' | 'textarea' | 'date' | 'url' | 'select' | 'ref';

export type FieldDef = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: readonly string[];
  /** For kind 'ref': which record type supplies the choices ('@subject' = the chosen subject record type). */
  refType?: string;
  help?: string;
};

export type RecordTypeDef = {
  /** Matches revision_entity_type and editorial_queue.record_type in the database. */
  recordType: string;
  table: string;
  slug: string;
  title: string;
  singular: string;
  fields: readonly FieldDef[];
};

const person = (): FieldDef => ({ name: 'person_id', label: 'Person', kind: 'ref', refType: 'PERSON', required: true });

export const RECORD_TYPES: readonly RecordTypeDef[] = [
  {
    recordType: 'PERSON', table: 'people', slug: 'people', title: 'People', singular: 'person',
    fields: [
      { name: 'first_name', label: 'First name', kind: 'text', required: true },
      { name: 'middle_name', label: 'Middle name', kind: 'text' },
      { name: 'last_name', label: 'Last name', kind: 'text', required: true },
      { name: 'suffix', label: 'Suffix', kind: 'text' },
      { name: 'preferred_name', label: 'Preferred name', kind: 'text' },
      { name: 'birth_date', label: 'Birth date', kind: 'date', help: 'Age is derived from this date and is never stored.' },
      { name: 'photo_asset_id', label: 'Photo asset reference', kind: 'text', help: 'A reference only. Photo storage is not part of this milestone.' },
    ],
  },
  {
    recordType: 'ELECTION_PARTICIPATION', table: 'election_participations', slug: 'participations', title: 'Election participation', singular: 'election participation',
    fields: [
      person(),
      { name: 'election_id', label: 'Election', kind: 'ref', refType: 'ELECTION', required: true },
      { name: 'office_id', label: 'Office', kind: 'ref', refType: 'OFFICE', required: true },
      { name: 'status', label: 'Participation status', kind: 'select', options: ELECTION_PARTICIPATION_STATUSES, required: true, help: 'Aspirant states are not candidacies. Choose the exact state the evidence supports.' },
      { name: 'ballot_number', label: 'Ballot number', kind: 'text' },
      { name: 'effective_from', label: 'Effective from', kind: 'date', required: true },
      { name: 'effective_to', label: 'Effective to', kind: 'date' },
    ],
  },
  {
    recordType: 'OFFICE_TERM', table: 'office_terms', slug: 'office-terms', title: 'Office terms', singular: 'office term',
    fields: [
      person(),
      { name: 'office_id', label: 'Office', kind: 'ref', refType: 'OFFICE', required: true },
      { name: 'status', label: 'Term status', kind: 'select', options: OFFICE_TERM_STATUSES, required: true },
      { name: 'start_date', label: 'Start date', kind: 'date' },
      { name: 'end_date', label: 'End date', kind: 'date', help: 'Leave empty when no end date is documented. Empty never means "present".' },
    ],
  },
  {
    recordType: 'AFFILIATION', table: 'affiliation_records', slug: 'affiliations', title: 'Affiliations', singular: 'affiliation',
    fields: [
      person(),
      { name: 'organization_id', label: 'Organization', kind: 'ref', refType: 'POLITICAL_ORGANIZATION', required: true },
      { name: 'affiliation_type', label: 'Affiliation type', kind: 'select', options: AFFILIATION_TYPES, required: true },
      { name: 'start_date', label: 'Start date', kind: 'date' },
      { name: 'end_date', label: 'End date', kind: 'date' },
    ],
  },
  {
    recordType: 'EDUCATION', table: 'education_records', slug: 'education', title: 'Education', singular: 'education record',
    fields: [
      person(),
      { name: 'institution', label: 'Institution', kind: 'text', required: true },
      { name: 'program', label: 'Program', kind: 'text' },
      { name: 'credential', label: 'Credential', kind: 'text' },
      { name: 'start_date', label: 'Start date', kind: 'date' },
      { name: 'end_date', label: 'End date', kind: 'date' },
    ],
  },
  {
    recordType: 'POLICY_POSITION', table: 'policy_position_records', slug: 'policy-positions', title: 'Policy positions', singular: 'policy position',
    fields: [
      person(),
      { name: 'topic', label: 'Topic', kind: 'text', required: true },
      { name: 'position_text', label: 'Position as stated', kind: 'textarea', required: true, help: 'The attributed position as stated. Never strengthen or summarize beyond the evidence.' },
      { name: 'attribution_type', label: 'Attribution', kind: 'select', options: POLICY_ATTRIBUTION_TYPES, required: true },
      { name: 'stated_at', label: 'Stated on', kind: 'date' },
    ],
  },
  {
    recordType: 'SOURCE', table: 'sources', slug: 'sources', title: 'Sources', singular: 'source',
    fields: [
      { name: 'title', label: 'Title', kind: 'text', required: true },
      { name: 'publisher', label: 'Publisher', kind: 'text', required: true },
      { name: 'source_type', label: 'Source type', kind: 'select', options: SOURCE_TYPES, required: true, help: 'Chosen by the editor. It is not classified automatically.' },
      { name: 'url', label: 'URL', kind: 'url', help: 'A URL or a document identifier is required.' },
      { name: 'document_identifier', label: 'Document identifier', kind: 'text' },
      { name: 'published_at', label: 'Source published on', kind: 'date' },
      { name: 'retrieved_at', label: 'Retrieved on', kind: 'date', required: true },
      { name: 'archived_url', label: 'Archived URL', kind: 'url' },
    ],
  },
  {
    recordType: 'CLAIM', table: 'claims', slug: 'claims', title: 'Claims', singular: 'claim',
    fields: [
      { name: 'subject_person_id', label: 'Subject person', kind: 'ref', refType: 'PERSON' },
      { name: 'subject_record_type', label: 'Subject record type', kind: 'select', options: CLAIM_SUBJECT_RECORD_TYPES },
      { name: 'subject_record_id', label: 'Subject record', kind: 'ref', refType: '@subject' },
      { name: 'claim_type', label: 'Claim type', kind: 'select', options: CLAIM_TYPES, required: true },
      { name: 'statement', label: 'Statement', kind: 'textarea', required: true },
      { name: 'effective_from', label: 'Effective from', kind: 'date' },
      { name: 'effective_to', label: 'Effective to', kind: 'date' },
      { name: 'verification_status', label: 'Verification status', kind: 'select', options: VERIFICATION_STATUSES, required: true, help: 'Describes the evidence for this claim, never the person.' },
      { name: 'last_reviewed_at', label: 'Last reviewed', kind: 'date' },
    ],
  },
  {
    recordType: 'ELECTION', table: 'elections', slug: 'elections', title: 'Elections', singular: 'election',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'election_date', label: 'Election date', kind: 'date', required: true },
      { name: 'status', label: 'Status', kind: 'select', options: ELECTION_STATUSES, required: true },
    ],
  },
  {
    recordType: 'OFFICE', table: 'offices', slug: 'offices', title: 'Offices', singular: 'office',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'level', label: 'Level', kind: 'select', options: OFFICE_LEVELS, required: true },
      { name: 'jurisdiction_id', label: 'Jurisdiction identifier', kind: 'text' },
    ],
  },
  {
    recordType: 'POLITICAL_ORGANIZATION', table: 'political_organizations', slug: 'organizations', title: 'Organizations', singular: 'organization',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'abbreviation', label: 'Abbreviation', kind: 'text' },
      { name: 'organization_type', label: 'Type', kind: 'select', options: POLITICAL_ORGANIZATION_TYPES, required: true },
    ],
  },
];

export function recordTypeBySlug(slug: string | undefined): RecordTypeDef | undefined {
  return RECORD_TYPES.find((t) => t.slug === slug);
}
export function recordTypeByType(recordType: string): RecordTypeDef | undefined {
  return RECORD_TYPES.find((t) => t.recordType === recordType);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Form schema derived from the field list: empty optional fields become null. */
export function buildFormSchema(def: RecordTypeDef) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of def.fields) {
    let base: z.ZodType<string> = z.string().trim();
    if (f.kind === 'date') base = base.refine((v) => v === '' || ISO_DATE.test(v), 'Use YYYY-MM-DD');
    if (f.kind === 'url') base = base.refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Must start with http:// or https://');
    if (f.kind === 'select' && f.options) {
      const options = f.options;
      base = base.refine((v) => v === '' || options.includes(v), 'Choose a listed value');
    }
    shape[f.name] = f.required
      ? base.refine((v) => v !== '', `${f.label} is required`)
      : base.transform((v) => (v === '' ? null : v));
  }
  return z.object(shape).superRefine((v, ctx) => {
    const value = v as Record<string, string | null>;
    const range = (from: string, to: string) => {
      const a = value[from];
      const b = value[to];
      if (a && b && b < a) ctx.addIssue({ code: 'custom', path: [to], message: 'Must not be before the start date' });
    };
    range('effective_from', 'effective_to');
    range('start_date', 'end_date');
    if (def.recordType === 'SOURCE' && !value.url && !value.document_identifier) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'Provide a URL or a document identifier' });
    }
    if (def.recordType === 'CLAIM') {
      const hit = findJudgmentWording(String(value.statement ?? ''));
      if (hit) {
        ctx.addIssue({ code: 'custom', path: ['statement'], message: `"${hit}" is a judgment. Claims must be neutral, precise factual statements.` });
      }
      if (Boolean(value.subject_record_type) !== Boolean(value.subject_record_id)) {
        ctx.addIssue({ code: 'custom', path: ['subject_record_id'], message: 'Choose both a subject record type and a subject record, or neither' });
      }
    }
  });
}
