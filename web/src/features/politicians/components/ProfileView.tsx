import Link from 'next/link';
import type { ReactNode } from 'react';

import { MissingRecords, Section } from '@/components/ui';
import type { IsoDate } from '@/domain/models';
import type { ClaimWithEvidence, PersonProfile } from '@/domain/models/personProfile';
import { compareMostRecentFirst } from '@/domain/timeline';
import { AFFILIATION_TYPE_LABELS } from '@/features/affiliations/affiliationLabels';
import { ElectionParticipationCard } from '@/features/elections/components/ElectionParticipationCard';
import { OFFICE_TERM_STATUS_LABELS } from '@/features/offices/officeTermLabels';
import { ProfileHeader } from '@/features/politicians/components/ProfileHeader';
import { Timeline, type TimelineEntry } from '@/features/politicians/components/Timeline';
import { reportErrorPath } from '@/features/politicians/paths';
import { EvidenceBlock } from '@/features/sources/components/EvidenceBlock';
import { SourceCitation } from '@/features/sources/components/SourceCitation';
import { formatIsoDate, formatYearRange } from '@/lib/dates';

const SECTIONS = [
  ['election-participation', 'Election Participation'],
  ['office-history', 'Public Office History'],
  ['affiliations', 'Political Affiliations'],
  ['education', 'Education'],
  ['policy-positions', 'Policy Positions'],
  ['sources', 'Sources'],
] as const;

function ProfileSection({
  id,
  isEmpty,
  children,
}: {
  id: (typeof SECTIONS)[number][0];
  isEmpty: boolean;
  children: ReactNode;
}) {
  const title = SECTIONS.find(([key]) => key === id)?.[1] ?? id;
  return (
    <Section id={id} title={title}>
      {isEmpty ? <MissingRecords /> : children}
    </Section>
  );
}

function RecordCard({
  title,
  details,
  claims,
}: {
  title: string;
  details: (string | undefined)[];
  claims: ClaimWithEvidence[];
}) {
  return (
    <li className="card">
      <h3 className="text-lg font-semibold">{title}</h3>
      {details
        .filter((line): line is string => Boolean(line))
        .map((line) => (
          <p key={line} className="text-sm text-muted">
            {line}
          </p>
        ))}
      <EvidenceBlock claims={claims} />
    </li>
  );
}

const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Profile information hierarchy: header, election participation, public office
 * history, political affiliations, education, policy positions, sources. Legal
 * cases and asset disclosures are deliberately not shown (Milestone 4), and
 * their absence is never worded as a finding.
 */
export function ProfileView({ profile, today }: { profile: PersonProfile; today: IsoDate }) {
  const participations = [...profile.electionParticipations].sort(
    (a, b) =>
      byCodePoint(b.record.election.electionDate, a.record.election.electionDate) ||
      byCodePoint(a.record.office.name, b.record.office.name),
  );

  const officeEntries: TimelineEntry[] = profile.officeTerms
    .map(({ record, claims }) => ({
      sort: { key: record.term.id, startDate: record.term.startDate, endDate: record.term.endDate },
      entry: {
        key: record.term.id,
        period: formatYearRange(record.term.startDate, record.term.endDate),
        title: record.office.name,
        detail: OFFICE_TERM_STATUS_LABELS[record.term.status],
        note: record.term.startDate && !record.term.endDate ? 'No end date recorded' : undefined,
        children: <EvidenceBlock claims={claims} />,
      } satisfies TimelineEntry,
    }))
    .sort((a, b) => compareMostRecentFirst(a.sort, b.sort))
    .map(({ entry }) => entry);

  const affiliationEntries: TimelineEntry[] = profile.affiliations
    .map(({ record, claims }) => ({
      sort: {
        key: record.affiliation.id,
        startDate: record.affiliation.startDate,
        endDate: record.affiliation.endDate,
      },
      entry: {
        key: record.affiliation.id,
        period: formatYearRange(record.affiliation.startDate, record.affiliation.endDate),
        title: record.organization.name,
        detail: `Relationship: ${AFFILIATION_TYPE_LABELS[record.affiliation.affiliationType]}`,
        note:
          record.affiliation.startDate && !record.affiliation.endDate
            ? 'No end date recorded'
            : undefined,
        children: <EvidenceBlock claims={claims} />,
      } satisfies TimelineEntry,
    }))
    .sort((a, b) => compareMostRecentFirst(a.sort, b.sort))
    .map(({ entry }) => entry);

  const education = [...profile.education].sort((a, b) =>
    compareMostRecentFirst(
      { key: a.record.id, startDate: a.record.endDate },
      { key: b.record.id, startDate: b.record.endDate },
    ),
  );
  const positions = [...profile.policyPositions].sort((a, b) =>
    compareMostRecentFirst(
      { key: a.record.id, startDate: a.record.statedAt },
      { key: b.record.id, startDate: b.record.statedAt },
    ),
  );
  const sources = [...profile.sources].sort(
    (a, b) => byCodePoint(a.title, b.title) || byCodePoint(a.id, b.id),
  );

  return (
    <article>
      <ProfileHeader profile={profile} today={today} />

      <nav aria-label="Sections of this profile" className="mt-6 border-y border-line py-2">
        <ul className="flex flex-wrap gap-x-5">
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}-heading`} className="link inline-flex min-h-11 items-center text-sm">
                {title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {profile.identityClaims.length > 0 ? (
        <Section id="personal-details" title="Personal Details">
          <div className="card">
            <EvidenceBlock claims={profile.identityClaims} />
          </div>
        </Section>
      ) : null}

      <ProfileSection id="election-participation" isEmpty={participations.length === 0}>
        <ul className="space-y-3">
          {participations.map((item) => (
            <ElectionParticipationCard key={item.record.participation.id} item={item} />
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection id="office-history" isEmpty={officeEntries.length === 0}>
        <Timeline entries={officeEntries} />
      </ProfileSection>

      <ProfileSection id="affiliations" isEmpty={affiliationEntries.length === 0}>
        <Timeline entries={affiliationEntries} />
      </ProfileSection>

      <ProfileSection id="education" isEmpty={education.length === 0}>
        <ul className="space-y-3">
          {education.map(({ record, claims }) => (
            <RecordCard
              key={record.id}
              title={record.institution}
              details={[
                [record.credential, record.program].filter(Boolean).join(', ') || undefined,
                formatYearRange(record.startDate, record.endDate),
              ]}
              claims={claims}
            />
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection id="policy-positions" isEmpty={positions.length === 0}>
        <ul className="space-y-3">
          {positions.map(({ record, claims }) => (
            <RecordCard
              key={record.id}
              title={record.topic}
              details={[
                `“${record.positionText}”`,
                record.statedAt ? `Stated ${formatIsoDate(record.statedAt)}` : undefined,
              ]}
              claims={claims}
            />
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection id="sources" isEmpty={sources.length === 0}>
        <ul className="space-y-3">
          {sources.map((source) => (
            <li key={source.id} className="card">
              <SourceCitation source={source} />
            </li>
          ))}
        </ul>
      </ProfileSection>

      <p className="mt-10">
        <Link href={reportErrorPath({ type: 'PERSON', id: profile.person.id })} className="btn">
          Report an error
        </Link>
      </p>
    </article>
  );
}
