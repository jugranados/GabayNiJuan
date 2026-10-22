import Link from 'next/link';

import { DateText, Section } from '@/components/ui';
import type { ClaimDetail as ClaimDetailModel, EvidenceItem } from '@/domain/models/personProfile';
import { checkVerificationConsistency } from '@/domain/validation/verification';
import { politicianPath, reportErrorPath } from '@/features/politicians/paths';
import { SourceCitation } from '@/features/sources/components/SourceCitation';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';
import { VERIFICATION_STATE_INFO } from '@/features/sources/verificationStates';
import { formatDateRange, formatIsoDate } from '@/lib/dates';

function EvidenceList({ items, heading, id }: { items: EvidenceItem[]; heading: string; id: string }) {
  return (
    <div>
      <h3 id={id} className="font-bold">
        {heading} ({items.length})
      </h3>
      <ul aria-labelledby={id} className="mt-2 space-y-3">
        {items.map((item) => (
          <li key={item.source.id} className="card">
            <SourceCitation source={item.source} />
            {item.link.note ? (
              <p className="mt-2 border-t border-line pt-2 text-sm">
                <span className="font-semibold">Reviewer note:</span> {item.link.note}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One claim with everything behind it: what its verification state means, when
 * it applies and was reviewed, and every attached source, with supporting and
 * conflicting sources kept apart. No score or aggregate rating is shown.
 */
export function ClaimDetail({ detail }: { detail: ClaimDetailModel }) {
  const { claim, evidence, subject } = detail;
  const period = formatDateRange(claim.effectiveFrom, claim.effectiveTo);
  const supporting = evidence.filter((item) => item.link.supports);
  const conflicting = evidence.filter((item) => !item.link.supports);
  const issues = checkVerificationConsistency(claim, evidence);

  return (
    <article>
      <p className="text-sm font-bold uppercase tracking-wide text-muted">Claim</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{claim.statement}</h1>
      {subject ? (
        <p className="mt-2">
          About{' '}
          <Link href={politicianPath(subject.slug)} className="link">
            {subject.displayName}
          </Link>
        </p>
      ) : null}

      <Section id="verification" title="Verification status">
        <VerificationBadge status={claim.verificationStatus} />
        <p>{VERIFICATION_STATE_INFO[claim.verificationStatus].description}</p>
        <p className="text-sm text-muted">
          This status describes the evidence for this one statement. It is not a judgement of any
          person.{' '}
          <Link href="/verification" className="link">
            How verification works
          </Link>
        </p>
        {issues.length > 0 ? (
          <div role="alert" className="card bg-surface">
            <p className="font-semibold">This record is under review</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted">
              {issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section id="dates" title="Dates">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="font-semibold">Applies</dt>
          <dd>{period ?? 'No effective dates recorded.'}</dd>
          <dt className="font-semibold">Last reviewed</dt>
          <dd>
            {claim.lastReviewedAt ? (
              <DateText date={claim.lastReviewedAt}>{formatIsoDate(claim.lastReviewedAt)}</DateText>
            ) : (
              'Review date not recorded.'
            )}
          </dd>
        </dl>
      </Section>

      <Section id="evidence" title={`Evidence (${evidence.length})`}>
        {evidence.length === 0 ? (
          <p className="text-muted">No source is attached to this claim.</p>
        ) : null}
        {supporting.length > 0 ? (
          <EvidenceList id="supporting" heading="Sources that support this claim" items={supporting} />
        ) : null}
        {conflicting.length > 0 ? (
          <EvidenceList
            id="conflicting"
            heading="Sources that conflict with this claim"
            items={conflicting}
          />
        ) : null}
      </Section>

      <p className="mt-10">
        <Link href={reportErrorPath({ type: 'CLAIM', id: claim.id })} className="btn">
          Report an error
        </Link>
      </p>
    </article>
  );
}
