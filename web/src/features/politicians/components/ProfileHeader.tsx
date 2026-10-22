import Link from 'next/link';

import { DateText } from '@/components/ui';
import { HEADLINE_ELIGIBLE_STATUSES } from '@/domain/currentRecords';
import type { IsoDate } from '@/domain/models';
import { formatPersonName } from '@/domain/models/person';
import type { ClaimWithEvidence, PersonProfile } from '@/domain/models/personProfile';
import { deriveProfileContext } from '@/domain/profileContext';
import { AFFILIATION_TYPE_LABELS } from '@/features/affiliations/affiliationLabels';
import { PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';
import { claimPath } from '@/features/politicians/paths';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';
import { formatIsoDate, formatYearRange } from '@/lib/dates';

/** The first claim that gives a record standing evidence; its badge accompanies the headline fact. */
function leadClaim(claims: ClaimWithEvidence[]): ClaimWithEvidence | undefined {
  return claims.find(({ claim }) => HEADLINE_ELIGIBLE_STATUSES.includes(claim.verificationStatus));
}

function Fact({ label, text, claims }: { label: string; text: string; claims: ClaimWithEvidence[] }) {
  const lead = leadClaim(claims);
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd>
        {text}
        {lead ? (
          <span className="flex flex-wrap items-center gap-x-3">
            <VerificationBadge status={lead.claim.verificationStatus} />
            <Link href={claimPath(lead.claim.id)} className="link inline-flex min-h-11 items-center text-sm">
              View evidence<span className="sr-only"> for: {text}</span>
            </Link>
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * Profile header: name, the election participation and office or affiliation
 * that are CURRENT by their dates and have standing evidence, and an
 * informational evidence count. It never says a person is "verified":
 * verification belongs to individual claims.
 */
export function ProfileHeader({ profile, today }: { profile: PersonProfile; today: IsoDate }) {
  const context = deriveProfileContext(profile, today);
  const { evidenceSummary } = profile;
  const hasContext =
    context.electionContext.length + context.currentOffices.length + context.currentAffiliations.length > 0;
  return (
    <header>
      <h1 className="text-3xl font-bold sm:text-4xl">{formatPersonName(profile.person)}</h1>
      {hasContext ? (
        <dl className="mt-4 space-y-3">
          {context.electionContext.map((item) => (
            <Fact
              key={item.record.participation.id}
              label="Election"
              text={`${item.record.office.name}: ${PARTICIPATION_STATUS_INFO[item.record.participation.status].label} (${item.record.election.name})`}
              claims={item.claims}
            />
          ))}
          {context.currentOffices.map((item) => (
            <Fact
              key={item.record.term.id}
              label="Current documented office"
              text={`${item.record.office.name}${
                item.record.term.startDate ? ` · ${formatYearRange(item.record.term.startDate)}` : ''
              }`}
              claims={item.claims}
            />
          ))}
          {context.currentAffiliations.map((item) => (
            <Fact
              key={item.record.affiliation.id}
              label="Current documented affiliation"
              text={`${item.record.organization.name} (${AFFILIATION_TYPE_LABELS[
                item.record.affiliation.affiliationType
              ].toLowerCase()})${
                item.record.affiliation.startDate
                  ? ` · ${formatYearRange(item.record.affiliation.startDate)}`
                  : ''
              }`}
              claims={item.claims}
            />
          ))}
        </dl>
      ) : null}
      <div className="mt-4 text-sm text-muted">
        <p>
          {evidenceSummary.claimCount} {evidenceSummary.claimCount === 1 ? 'claim' : 'claims'} from{' '}
          {evidenceSummary.sourceCount} {evidenceSummary.sourceCount === 1 ? 'source' : 'sources'}
          {evidenceSummary.lastReviewedAt ? (
            <>
              {' '}
              · Last reviewed{' '}
              <DateText date={evidenceSummary.lastReviewedAt}>
                {formatIsoDate(evidenceSummary.lastReviewedAt)}
              </DateText>
            </>
          ) : null}
        </p>
        <p>These counts show how much evidence is on file. They are not a rating of this person.</p>
      </div>
    </header>
  );
}
