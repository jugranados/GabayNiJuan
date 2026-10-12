import Link from 'next/link';

import { DateText } from '@/components/ui';
import type { ClaimWithEvidence } from '@/domain/models/personProfile';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';
import { claimPath } from '@/features/politicians/paths';
import { formatDateRange, formatIsoDate } from '@/lib/dates';

/** One claim as it appears beside a record: status, statement, dates, and the way to its evidence. */
function ClaimSummary({ claim, evidence }: ClaimWithEvidence) {
  const period = formatDateRange(claim.effectiveFrom, claim.effectiveTo);
  const supporting = evidence.filter((item) => item.link.supports).length;
  const conflicting = evidence.length - supporting;
  return (
    <li className="border-l-2 border-line pl-3">
      <VerificationBadge status={claim.verificationStatus} />
      <p className="mt-1">{claim.statement}</p>
      <p className="text-sm text-muted">
        {period ? `Applies: ${period} · ` : ''}
        {claim.lastReviewedAt ? (
          <>
            Last reviewed{' '}
            <DateText date={claim.lastReviewedAt}>{formatIsoDate(claim.lastReviewedAt)}</DateText>
          </>
        ) : (
          'Review date not recorded'
        )}
      </p>
      <p className="text-sm text-muted">
        {evidence.length === 0
          ? 'No source attached.'
          : `${supporting} supporting ${supporting === 1 ? 'source' : 'sources'}${
              conflicting > 0
                ? ` · ${conflicting} conflicting ${conflicting === 1 ? 'source' : 'sources'}`
                : ''
            }`}
      </p>
      <Link href={claimPath(claim.id)} className="link inline-flex min-h-11 items-center text-sm">
        View evidence and sources
        <span className="sr-only"> for: {claim.statement}</span>
      </Link>
    </li>
  );
}

/**
 * The evidence attached to a profile record. A record with no claim is shown
 * as unverified with no source, never as established fact. Each claim keeps
 * its own status and its own link: nothing is merged into a person-level badge.
 */
export function EvidenceBlock({ claims }: { claims: ClaimWithEvidence[] }) {
  if (claims.length === 0) {
    return (
      <div className="mt-3 border-l-2 border-line pl-3">
        <VerificationBadge status="UNVERIFIED" />
        <p className="text-sm text-muted">No source attached.</p>
      </div>
    );
  }
  return (
    <ul className="mt-3 space-y-3">
      {claims.map((item) => (
        <ClaimSummary key={item.claim.id} {...item} />
      ))}
    </ul>
  );
}
