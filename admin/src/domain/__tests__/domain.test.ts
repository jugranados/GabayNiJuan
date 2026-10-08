import { describe, expect, it } from 'vitest';

import { diffValues } from '../diff';
import { buildChecklist, isReadyForReview, type Readiness } from '../readiness';
import { RECORD_TYPES, buildFormSchema, recordTypeBySlug } from '../records';
import { can, highestRole, hasRole } from '../roles';
import { findJudgmentWording } from '../wording';
import { PUBLICATION_STATUSES } from '../enums';
import { TRANSITIONS, availableTransitions, isAllowedTransition, isContentEditable, reasonRequired } from '../workflow';

describe('roles', () => {
  it('ranks REVIEWER < APPROVER < ADMIN', () => {
    expect(highestRole(['REVIEWER', 'ADMIN', 'APPROVER'])).toBe('ADMIN');
    expect(hasRole('APPROVER', 'REVIEWER')).toBe(true);
    expect(hasRole('REVIEWER', 'APPROVER')).toBe(false);
    expect(hasRole(undefined, 'REVIEWER')).toBe(false);
  });
  it('maps capabilities to the minimum role', () => {
    expect(can('REVIEWER', 'edit-drafts')).toBe(true);
    expect(can('REVIEWER', 'publish')).toBe(false);
    expect(can('REVIEWER', 'edit-published')).toBe(false);
    expect(can('APPROVER', 'publish')).toBe(true);
    expect(can('APPROVER', 'manage-roles')).toBe(false);
    expect(can('ADMIN', 'manage-roles')).toBe(true);
    expect(can(undefined, 'edit-drafts')).toBe(false);
  });
});

describe('workflow', () => {
  it('has the documented transitions only', () => {
    expect(isAllowedTransition('DRAFT', 'SOURCE_ATTACHED')).toBe(true);
    expect(isAllowedTransition('APPROVED', 'PUBLISHED')).toBe(true);
    expect(isAllowedTransition('PUBLISHED', 'RETRACTED')).toBe(true);
    expect(isAllowedTransition('DRAFT', 'PUBLISHED')).toBe(false);
    expect(isAllowedTransition('DRAFT', 'APPROVED')).toBe(false);
    expect(isAllowedTransition('RETRACTED', 'DRAFT')).toBe(false);
    expect(isAllowedTransition('PUBLISHED', 'DRAFT')).toBe(false);
    expect(TRANSITIONS.RETRACTED).toEqual([]);
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...PUBLICATION_STATUSES].sort());
  });
  it('a reviewer cannot approve, publish or retract; an approver can', () => {
    expect(availableTransitions('REVIEWED', 'REVIEWER')).toEqual(['REJECTED', 'DRAFT']);
    expect(availableTransitions('APPROVED', 'REVIEWER')).not.toContain('PUBLISHED');
    expect(availableTransitions('PUBLISHED', 'REVIEWER')).toEqual([]);
    expect(availableTransitions('REVIEWED', 'APPROVER')).toContain('APPROVED');
    expect(availableTransitions('APPROVED', 'APPROVER')).toContain('PUBLISHED');
    expect(availableTransitions('PUBLISHED', 'APPROVER')).toEqual(['RETRACTED']);
  });
  it('requires a reason to change or retract published records', () => {
    expect(reasonRequired('PUBLISHED')).toBe(true);
    expect(reasonRequired('RETRACTED')).toBe(true);
    expect(reasonRequired('APPROVED', 'RETRACTED')).toBe(true);
    expect(reasonRequired('DRAFT', 'SOURCE_ATTACHED')).toBe(false);
  });
  it('freezes content under review and after retraction; published edits are approver-only', () => {
    expect(isContentEditable('DRAFT', 'REVIEWER')).toBe(true);
    expect(isContentEditable('REVIEWED', 'APPROVER')).toBe(false);
    expect(isContentEditable('APPROVED', 'ADMIN')).toBe(false);
    expect(isContentEditable('RETRACTED', 'ADMIN')).toBe(false);
    expect(isContentEditable('PUBLISHED', 'REVIEWER')).toBe(false);
    expect(isContentEditable('PUBLISHED', 'APPROVER')).toBe(true);
  });
});

const base: Readiness = {
  verification_status: 'CORROBORATED',
  total: 2,
  supporting: 2,
  contradicting: 0,
  tier1_supporting: 0,
  distinct_publishers: 2,
  unpublished_sources: 0,
  error: null,
};

describe('readiness checklist', () => {
  it('shows a met CORROBORATED checklist', () => {
    const items = buildChecklist(base);
    expect(items.every((i) => i.met)).toBe(true);
    expect(isReadyForReview(base)).toBe(true);
  });
  it('flags a single publisher for CORROBORATED', () => {
    const items = buildChecklist({ ...base, distinct_publishers: 1, error: 'CORROBORATED requires supporting sources from at least two distinct publishers' });
    expect(items.find((i) => i.label.includes('2 distinct publishers'))?.met).toBe(false);
    expect(isReadyForReview({ ...base, error: 'x' })).toBe(false);
  });
  it('DISPUTED needs a contradicting source', () => {
    const items = buildChecklist({ ...base, verification_status: 'DISPUTED', contradicting: 0 });
    expect(items.find((i) => i.label.includes('contradicting'))?.met).toBe(false);
  });
  it('PRIMARY_SOURCE needs a tier-1 supporting source', () => {
    const items = buildChecklist({ ...base, verification_status: 'PRIMARY_SOURCE', tier1_supporting: 0 });
    expect(items.some((i) => !i.met)).toBe(true);
  });
  it('UNVERIFIED needs nothing', () => {
    expect(buildChecklist({ ...base, verification_status: 'UNVERIFIED', total: 0, supporting: 0 }).every((i) => i.met)).toBe(true);
  });
});

describe('diff', () => {
  it('lists only meaningful changed fields', () => {
    const changes = diffValues(
      { id: '1', end_date: '2025-01-01', updated_at: 'a', version: 1 },
      { id: '1', end_date: '2025-06-30', updated_at: 'b', version: 2 },
    );
    expect(changes).toEqual([{ field: 'end_date', before: '2025-01-01', after: '2025-06-30' }]);
  });
  it('treats null and missing as equal', () => {
    expect(diffValues({ a: null }, {})).toEqual([]);
  });
});

describe('claim wording guard', () => {
  it.each(['Juan Halimbawa is trustworthy.', 'Juan Halimbawa is corrupt.', 'Juan Halimbawa is a good leader.'])('rejects %s', (s) => {
    expect(findJudgmentWording(s)).toBeDefined();
  });
  it('accepts the neutral fictional example', () => {
    expect(findJudgmentWording('Juan Halimbawa served as Mayor of Sample City from 2022 to 2025.')).toBeUndefined();
  });
});

describe('form schemas', () => {
  const claims = buildFormSchema(recordTypeBySlug('claims')!);
  const valid = {
    subject_person_id: '', subject_record_type: '', subject_record_id: '', claim_type: 'OFFICE_TERM',
    statement: 'Juan Halimbawa served as Mayor of Sample City from 2022 to 2025.', effective_from: '2022-06-30',
    effective_to: '2025-06-30', verification_status: 'PRIMARY_SOURCE', last_reviewed_at: '',
  };
  it('turns empty optional fields into null', () => {
    const parsed = claims.parse(valid) as Record<string, unknown>;
    expect(parsed.subject_person_id).toBeNull();
    expect(parsed.claim_type).toBe('OFFICE_TERM');
  });
  it('rejects judgment statements, unknown claim types and bad ranges', () => {
    expect(claims.safeParse({ ...valid, statement: 'Juan Halimbawa is a good leader.' }).success).toBe(false);
    expect(claims.safeParse({ ...valid, claim_type: 'TRUSTWORTHINESS' }).success).toBe(false);
    expect(claims.safeParse({ ...valid, effective_from: '2025-01-01', effective_to: '2024-01-01' }).success).toBe(false);
    expect(claims.safeParse({ ...valid, subject_record_type: 'OFFICE_TERM' }).success).toBe(false);
  });
  it('sources need a URL or document identifier and http(s) URLs', () => {
    const sources = buildFormSchema(recordTypeBySlug('sources')!);
    const src = { title: 'Gazette', publisher: 'Sample Office', source_type: 'OFFICIAL_GOVERNMENT', url: '', document_identifier: '', published_at: '', retrieved_at: '2026-01-01', archived_url: '' };
    expect(sources.safeParse(src).success).toBe(false);
    expect(sources.safeParse({ ...src, url: 'javascript:alert(1)' }).success).toBe(false);
    expect(sources.safeParse({ ...src, url: 'https://example.org/doc' }).success).toBe(true);
    expect(sources.safeParse({ ...src, document_identifier: 'GAZ-1' }).success).toBe(true);
  });
  it('covers exactly the supported record types (no legal-case or asset editors yet)', () => {
    const types = RECORD_TYPES.map((t) => t.table);
    expect(types).not.toContain('legal_case_records');
    expect(types).not.toContain('asset_disclosure_records');
    expect(types).toEqual(expect.arrayContaining(['people', 'claims', 'sources', 'election_participations', 'office_terms', 'affiliation_records', 'education_records', 'policy_position_records']));
  });
});
