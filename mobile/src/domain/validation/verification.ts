/**
 * Consistency checks between a claim's verification status and its evidence.
 * These rules are documented in docs/DATA_TRUST_GOVERNANCE.md.
 *
 * They flag records for human review; they do not change a status
 * automatically. A reviewer decides the status.
 *
 * The same rules are enforced in the database before a claim can be
 * published: supabase/migrations/*_claim_consistency_checks.sql. Keep the two
 * in sync.
 */
import { SOURCE_TIER_BY_TYPE } from '@/domain/enums';
import type { Claim } from '@/domain/models';
import type { EvidenceItem } from '@/domain/models/personProfile';

export type VerificationIssueCode =
  | 'NO_EVIDENCE'
  | 'NO_SUPPORTING_SOURCE'
  | 'NO_PRIMARY_SOURCE'
  | 'NOT_INDEPENDENTLY_CORROBORATED'
  | 'DISPUTE_WITHOUT_CONFLICT'
  | 'UNMARKED_CONFLICT';

export type VerificationIssue = {
  code: VerificationIssueCode;
  message: string;
};

export function checkVerificationConsistency(
  claim: Pick<Claim, 'verificationStatus'>,
  evidence: readonly EvidenceItem[],
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const supporting = evidence.filter((item) => item.link.supports);
  const contradicting = evidence.filter((item) => !item.link.supports);
  const status = claim.verificationStatus;

  if (status === 'UNVERIFIED') {
    return issues;
  }

  if (evidence.length === 0) {
    issues.push({
      code: 'NO_EVIDENCE',
      message: `${status} requires at least one attached source.`,
    });
    return issues;
  }

  if (status !== 'DISPUTED' && supporting.length === 0) {
    issues.push({
      code: 'NO_SUPPORTING_SOURCE',
      message: `${status} requires at least one supporting source.`,
    });
  }

  if (
    status === 'PRIMARY_SOURCE' &&
    !supporting.some((item) => SOURCE_TIER_BY_TYPE[item.source.sourceType] === 1)
  ) {
    issues.push({
      code: 'NO_PRIMARY_SOURCE',
      message: 'PRIMARY_SOURCE requires a supporting tier-1 (primary authoritative) source.',
    });
  }

  if (status === 'CORROBORATED') {
    const publishers = new Set(
      supporting.map((item) => item.source.publisher.trim().toLowerCase()),
    );
    if (publishers.size < 2) {
      issues.push({
        code: 'NOT_INDEPENDENTLY_CORROBORATED',
        message: 'CORROBORATED requires supporting sources from at least two distinct publishers.',
      });
    }
  }

  if (status === 'DISPUTED' && (supporting.length === 0 || contradicting.length === 0)) {
    issues.push({
      code: 'DISPUTE_WITHOUT_CONFLICT',
      message: 'DISPUTED requires at least one supporting and one contradicting source.',
    });
  }

  if (status !== 'DISPUTED' && status !== 'OUTDATED' && contradicting.length > 0) {
    issues.push({
      code: 'UNMARKED_CONFLICT',
      message: 'A contradicting source is attached but the claim is not marked DISPUTED.',
    });
  }

  return issues;
}
