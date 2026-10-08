import type { SourceType, VerificationStatus } from '@/domain/enums';
import type { EvidenceItem } from '@/domain/models/personProfile';
import { checkVerificationConsistency } from '@/domain/validation/verification';

function evidence(sourceType: SourceType, publisher: string, supports = true): EvidenceItem {
  return {
    link: { claimId: 'c-1', sourceId: `${publisher}-${sourceType}`, supports },
    source: {
      id: `${publisher}-${sourceType}`,
      title: 'Fictional',
      publisher,
      sourceType,
      retrievedAt: '2026-09-30',
      url: 'https://example.org',
    },
  };
}

const codes = (status: VerificationStatus, items: EvidenceItem[]) =>
  checkVerificationConsistency({ verificationStatus: status }, items).map((issue) => issue.code);

describe('checkVerificationConsistency', () => {
  it('allows UNVERIFIED without evidence but requires evidence for every other state', () => {
    expect(codes('UNVERIFIED', [])).toEqual([]);
    expect(codes('SELF_DECLARED', [])).toEqual(['NO_EVIDENCE']);
    expect(codes('OUTDATED', [])).toEqual(['NO_EVIDENCE']);
  });

  it('requires at least one supporting source for every state except UNVERIFIED and DISPUTED', () => {
    const onlyContradicting = [evidence('NEWS', 'Paper', false)];
    expect(codes('SELF_DECLARED', onlyContradicting)).toContain('NO_SUPPORTING_SOURCE');
    expect(codes('REPORTED', onlyContradicting)).toContain('NO_SUPPORTING_SOURCE');
    expect(codes('OUTDATED', onlyContradicting)).toContain('NO_SUPPORTING_SOURCE');
    expect(codes('DISPUTED', onlyContradicting)).toEqual(['DISPUTE_WITHOUT_CONFLICT']);
    expect(codes('UNVERIFIED', onlyContradicting)).toEqual([]);
  });

  it('applies no extra source-type rule to SELF_DECLARED and REPORTED', () => {
    expect(codes('SELF_DECLARED', [evidence('OFFICIAL_CANDIDATE', 'Campaign')])).toEqual([]);
    expect(codes('SELF_DECLARED', [evidence('NEWS', 'Paper')])).toEqual([]);
    expect(codes('REPORTED', [evidence('NEWS', 'Paper')])).toEqual([]);
  });

  it('allows OUTDATED claims to keep contradicting evidence', () => {
    expect(
      codes('OUTDATED', [evidence('OTHER', 'Roster'), evidence('NEWS', 'Paper', false)]),
    ).toEqual([]);
  });

  it('requires a tier-1 source for PRIMARY_SOURCE', () => {
    expect(codes('PRIMARY_SOURCE', [evidence('NEWS', 'Paper')])).toEqual(['NO_PRIMARY_SOURCE']);
    expect(codes('PRIMARY_SOURCE', [evidence('COURT_OR_TRIBUNAL', 'Court')])).toEqual([]);
  });

  it('requires two distinct publishers for CORROBORATED', () => {
    expect(codes('CORROBORATED', [evidence('NEWS', 'Paper'), evidence('OTHER', 'paper ')])).toEqual(
      ['NOT_INDEPENDENTLY_CORROBORATED'],
    );
    expect(codes('CORROBORATED', [evidence('NEWS', 'Paper'), evidence('NEWS', 'Wire')])).toEqual(
      [],
    );
  });

  it('requires real conflict for DISPUTED, and flags conflicts not marked as disputed', () => {
    expect(codes('DISPUTED', [evidence('NEWS', 'Paper')])).toEqual(['DISPUTE_WITHOUT_CONFLICT']);
    expect(codes('DISPUTED', [evidence('NEWS', 'Paper'), evidence('NEWS', 'Wire', false)])).toEqual(
      [],
    );
    expect(codes('REPORTED', [evidence('NEWS', 'Paper'), evidence('NEWS', 'Wire', false)])).toEqual(
      ['UNMARKED_CONFLICT'],
    );
  });
});
