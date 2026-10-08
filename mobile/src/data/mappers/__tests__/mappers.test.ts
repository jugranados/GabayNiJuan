import { assemblePersonProfile, type ProfileParts } from '@/data/mappers/profileAssembler';
import { toClaim, toPerson, toSource } from '@/data/mappers/rowMappers';
import { parseRow } from '@/data/schemas/parse';
import { claimRowSchema, personRowSchema, sourceRowSchema } from '@/data/schemas/rows';
import { DataIntegrityError } from '@/domain/validation/errors';

describe('row mappers', () => {
  it('maps snake_case rows to domain models and nulls to undefined', () => {
    const person = toPerson(
      parseRow(personRowSchema, 'person', {
        id: 'p-1',
        first_name: 'Maria',
        middle_name: null,
        last_name: 'Makabayan',
        birth_date: null,
      }),
    );
    expect(person).toEqual({
      id: 'p-1',
      firstName: 'Maria',
      middleName: undefined,
      lastName: 'Makabayan',
      suffix: undefined,
      preferredName: undefined,
      birthDate: undefined,
      photoAssetId: undefined,
    });
  });

  it('maps a claim subject into a typed record reference', () => {
    const claim = toClaim(
      parseRow(claimRowSchema, 'claim', {
        id: 'c-1',
        subject_person_id: 'p-1',
        subject_record_type: 'OFFICE_TERM',
        subject_record_id: 'ot-1',
        claim_type: 'OFFICE_TERM',
        statement: 'Served as councilor.',
        verification_status: 'PRIMARY_SOURCE',
      }),
    );
    expect(claim.subjectRecord).toEqual({ type: 'OFFICE_TERM', id: 'ot-1' });
    expect(claim.verificationStatus).toBe('PRIMARY_SOURCE');
  });
});

describe('assemblePersonProfile', () => {
  const person = { id: 'p-1', firstName: 'Juan', lastName: 'Dela Cruz' };
  const source = toSource(
    parseRow(sourceRowSchema, 'source', {
      id: 's-1',
      title: 'Fictional roster',
      publisher: 'Fictional Office',
      url: 'https://example.org/roster',
      source_type: 'OFFICIAL_GOVERNMENT',
      retrieved_at: '2026-09-30',
    }),
  );

  const baseParts: ProfileParts = {
    person,
    electionParticipations: [],
    officeTerms: [{ id: 'ot-1', personId: 'p-1', officeId: 'o-1', status: 'ELECTED' }],
    affiliations: [],
    education: [],
    policyPositions: [],
    elections: [],
    offices: [{ id: 'o-1', name: 'Fictional Councilor', level: 'CITY' }],
    organizations: [],
    claims: [
      {
        id: 'c-1',
        subjectPersonId: 'p-1',
        subjectRecord: { type: 'OFFICE_TERM', id: 'ot-1' },
        claimType: 'OFFICE_TERM',
        statement: 'Served as councilor.',
        verificationStatus: 'PRIMARY_SOURCE',
        lastReviewedAt: '2026-10-01',
      },
    ],
    evidence: [{ claimId: 'c-1', sourceId: 's-1', supports: true }],
    sources: [source],
  };

  it('attaches claims and their sources to the record they attest to', () => {
    const profile = assemblePersonProfile(baseParts);
    const [term] = profile.officeTerms;
    expect(term?.record.office.name).toBe('Fictional Councilor');
    expect(term?.claims[0]?.evidence[0]?.source.id).toBe('s-1');
    expect(profile.evidenceSummary).toEqual({
      claimCount: 1,
      sourceCount: 1,
      lastReviewedAt: '2026-10-01',
    });
  });

  it('keeps a record with no claim visible as unattested rather than dropping it', () => {
    const profile = assemblePersonProfile({ ...baseParts, claims: [], evidence: [] });
    expect(profile.officeTerms).toHaveLength(1);
    expect(profile.officeTerms[0]?.claims).toEqual([]);
  });

  it('fails explicitly when a record references a missing office or source', () => {
    expect(() => assemblePersonProfile({ ...baseParts, offices: [] })).toThrow(DataIntegrityError);
    expect(() => assemblePersonProfile({ ...baseParts, sources: [] })).toThrow(DataIntegrityError);
  });
});
