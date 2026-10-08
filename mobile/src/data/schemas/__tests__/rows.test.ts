import { parseRow, parseRows } from '@/data/schemas/parse';
import {
  assetDisclosureRecordRowSchema,
  claimEvidenceRowSchema,
  claimRowSchema,
  electionParticipationRowSchema,
  legalCaseRecordRowSchema,
  personRowSchema,
  revisionRowSchema,
  sourceRowSchema,
} from '@/data/schemas/rows';
import { DataValidationError } from '@/domain/validation/errors';

const validSource = {
  id: 'src-1',
  title: 'Fictional record',
  publisher: 'Fictional Office',
  url: 'https://example.org/record',
  source_type: 'OFFICIAL_GOVERNMENT',
  retrieved_at: '2026-09-30',
};

const validParticipation = {
  id: 'ep-1',
  person_id: 'p-1',
  election_id: 'e-1',
  office_id: 'o-1',
  status: 'POTENTIAL_ASPIRANT',
  effective_from: '2026-09-20',
};

describe('row schemas', () => {
  it('accepts a valid row and treats missing nullable columns as absent', () => {
    const row = parseRow(personRowSchema, 'person', {
      id: 'p-1',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      middle_name: null,
    });
    expect(row).toMatchObject({ id: 'p-1', first_name: 'Juan', middle_name: null });
  });

  it('strips unknown columns such as a criminal-record flag instead of passing them through', () => {
    const row = parseRow(personRowSchema, 'person', {
      id: 'p-1',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      has_criminal_record: true,
    });
    expect(row).not.toHaveProperty('has_criminal_record');
  });

  it('rejects an unknown candidacy status rather than guessing one', () => {
    expect(() =>
      parseRow(electionParticipationRowSchema, 'election participation', {
        ...validParticipation,
        status: 'FRONTRUNNER',
      }),
    ).toThrow(DataValidationError);
  });

  it('does not coerce wrong types', () => {
    expect(() =>
      parseRow(claimEvidenceRowSchema, 'claim evidence', {
        claim_id: 'c-1',
        source_id: 's-1',
        supports: 'true',
      }),
    ).toThrow(DataValidationError);
  });

  it('rejects impossible calendar dates and reversed date ranges', () => {
    expect(() =>
      parseRow(electionParticipationRowSchema, 'election participation', {
        ...validParticipation,
        effective_from: '2026-02-30',
      }),
    ).toThrow(DataValidationError);

    expect(() =>
      parseRow(electionParticipationRowSchema, 'election participation', {
        ...validParticipation,
        effective_to: '2026-01-01',
      }),
    ).toThrow(/effective_to must not be earlier than effective_from/);
  });

  it('requires sources to be openable: an http(s) URL or a document identifier', () => {
    expect(() =>
      parseRow(sourceRowSchema, 'source', { ...validSource, url: 'javascript:alert(1)' }),
    ).toThrow(DataValidationError);
    expect(() => parseRow(sourceRowSchema, 'source', { ...validSource, url: null })).toThrow(
      /URL or a document identifier/,
    );
    expect(
      parseRow(sourceRowSchema, 'source', {
        ...validSource,
        url: null,
        document_identifier: 'DOC-1',
      }).document_identifier,
    ).toBe('DOC-1');
  });

  it('requires claim subject type and id together', () => {
    expect(() =>
      parseRow(claimRowSchema, 'claim', {
        id: 'c-1',
        claim_type: 'OFFICE_TERM',
        statement: 'A statement.',
        verification_status: 'UNVERIFIED',
        subject_record_type: 'OFFICE_TERM',
      }),
    ).toThrow(DataValidationError);
  });

  it('keeps legal proceedings procedural: only defined statuses are accepted', () => {
    const base = { id: 'lc-1', person_id: 'p-1', authority: 'Fictional Court' };
    expect(
      parseRow(legalCaseRecordRowSchema, 'legal case', { ...base, status: 'DISMISSED' }).status,
    ).toBe('DISMISSED');
    expect(() =>
      parseRow(legalCaseRecordRowSchema, 'legal case', { ...base, status: 'GUILTY' }),
    ).toThrow(DataValidationError);
  });

  it('requires a currency whenever a disclosed amount is present', () => {
    expect(() =>
      parseRow(assetDisclosureRecordRowSchema, 'asset disclosure', {
        id: 'ad-1',
        person_id: 'p-1',
        disclosure_type: 'SALN',
        net_worth_amount: 1000,
      }),
    ).toThrow(/currency is required/);
  });

  it('fails the whole list when any row is invalid and reports which record', () => {
    expect.assertions(3);
    try {
      parseRows(sourceRowSchema, 'source', [
        validSource,
        { ...validSource, id: 'src-bad', source_type: 'BLOG' },
      ]);
    } catch (error) {
      expect(error).toBeInstanceOf(DataValidationError);
      expect((error as DataValidationError).recordId).toBe('src-bad');
      expect((error as DataValidationError).issues[0]?.path).toBe('source_type');
    }
  });

  it('accepts revision rows exactly as Postgres/PostgREST returns them', () => {
    const row = parseRow(revisionRowSchema, 'revision', {
      id: '5d211989-5ede-43e4-88a1-cdde14e1486b',
      entity_type: 'PERSON',
      entity_id: '87d8b11e-b790-4f91-8ac2-413bdc500ac0',
      old_value: { first_name: 'Test', middle_name: null },
      new_value: { first_name: 'Test', middle_name: 'Corrected' },
      editor_id: 'system:postgres',
      approver_id: null,
      reason: 'Corrected middle name per fictional registry',
      created_at: '2026-10-08T08:39:49.612366+00:00',
      approval_state: 'PUBLISHED',
    });
    expect(row.approval_state).toBe('PUBLISHED');
    expect(() =>
      parseRow(revisionRowSchema, 'revision', { ...row, approval_state: 'APPROVED_BY_AI' }),
    ).toThrow(DataValidationError);
  });
});
