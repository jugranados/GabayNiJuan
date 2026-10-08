import type { ReactNode } from 'react';

import { ActionButton, MissingRecords } from '@/components/states';
import { Timeline, type TimelineEntry } from '@/components/Timeline';
import { Card, FixtureBanner, Screen, Section } from '@/components/ui';
import { toIsoDate } from '@/domain/currentRecords';
import type { IsoDate } from '@/domain/models';
import type { PersonProfile } from '@/domain/models/personProfile';
import { compareMostRecentFirst } from '@/domain/timeline';
import { AFFILIATION_TYPE_LABELS } from '@/features/affiliations/affiliationLabels';
import { ElectionParticipationCard } from '@/features/elections/components/ElectionParticipationCard';
import { OFFICE_TERM_STATUS_LABELS } from '@/features/offices/officeTermLabels';
import { AttestedRecordCard } from '@/features/politicians/components/AttestedRecordCard';
import { PersonProfileHeader } from '@/features/politicians/components/PersonProfileHeader';
import { EvidenceBlock } from '@/features/sources/components/EvidenceBlock';
import { SourceItem } from '@/features/sources/components/SourceItem';
import { formatIsoDate, formatYearRange } from '@/shared/utils/dates';

type Props = {
  profile: PersonProfile;
  /** Opens the source viewer for a claim. */
  onOpenClaim?: (claimId: string) => void;
  /** Opens the "Report an error" form for this profile. */
  onReportError?: () => void;
  /** Injectable for tests; defaults to today (UTC). */
  today?: IsoDate;
};

function ProfileSection({
  title,
  isEmpty,
  children,
}: {
  title: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return <Section title={title}>{isEmpty ? <MissingRecords /> : children}</Section>;
}

/**
 * Profile information hierarchy: header, election participation, public office
 * history, political affiliations, education, policy positions, sources. Legal
 * cases and asset disclosures are deliberately not shown (Milestone 4).
 */
export function PersonProfileView({
  profile,
  onOpenClaim,
  onReportError,
  today = toIsoDate(new Date()),
}: Props) {
  const participations = [...profile.electionParticipations].sort(
    (a, b) =>
      (a.record.election.electionDate < b.record.election.electionDate ? 1 : -1) ||
      a.record.office.name.localeCompare(b.record.office.name),
  );

  const officeEntries: TimelineEntry[] = profile.officeTerms
    .map((item) => ({
      sort: {
        key: item.record.term.id,
        startDate: item.record.term.startDate,
        endDate: item.record.term.endDate,
      },
      entry: {
        key: item.record.term.id,
        period: formatYearRange(item.record.term.startDate, item.record.term.endDate),
        title: item.record.office.name,
        detail: OFFICE_TERM_STATUS_LABELS[item.record.term.status],
        note:
          item.record.term.startDate && !item.record.term.endDate
            ? 'No end date recorded'
            : undefined,
        children: <EvidenceBlock claims={item.claims} onOpenClaim={onOpenClaim} />,
      } satisfies TimelineEntry,
    }))
    .sort((a, b) => compareMostRecentFirst(a.sort, b.sort))
    .map(({ entry }) => entry);

  const affiliationEntries: TimelineEntry[] = profile.affiliations
    .map((item) => ({
      sort: {
        key: item.record.affiliation.id,
        startDate: item.record.affiliation.startDate,
        endDate: item.record.affiliation.endDate,
      },
      entry: {
        key: item.record.affiliation.id,
        period: formatYearRange(item.record.affiliation.startDate, item.record.affiliation.endDate),
        title: item.record.organization.name,
        detail: `Relationship: ${AFFILIATION_TYPE_LABELS[item.record.affiliation.affiliationType]}`,
        note:
          item.record.affiliation.startDate && !item.record.affiliation.endDate
            ? 'No end date recorded'
            : undefined,
        children: <EvidenceBlock claims={item.claims} onOpenClaim={onOpenClaim} />,
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
  const sources = [...profile.sources].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <Screen>
      <FixtureBanner />
      <PersonProfileHeader profile={profile} today={today} onOpenClaim={onOpenClaim} />

      {profile.identityClaims.length > 0 ? (
        <Section title="Personal Details">
          <Card>
            <EvidenceBlock claims={profile.identityClaims} onOpenClaim={onOpenClaim} />
          </Card>
        </Section>
      ) : null}

      <ProfileSection title="Election Participation" isEmpty={participations.length === 0}>
        {participations.map((item) => (
          <ElectionParticipationCard
            key={item.record.participation.id}
            item={item}
            onOpenClaim={onOpenClaim}
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Public Office History" isEmpty={officeEntries.length === 0}>
        <Timeline entries={officeEntries} />
      </ProfileSection>

      <ProfileSection title="Political Affiliations" isEmpty={affiliationEntries.length === 0}>
        <Timeline entries={affiliationEntries} />
      </ProfileSection>

      <ProfileSection title="Education" isEmpty={education.length === 0}>
        {education.map(({ record, claims }) => (
          <AttestedRecordCard
            key={record.id}
            title={record.institution}
            details={[
              [record.credential, record.program].filter(Boolean).join(', ') || undefined,
              formatYearRange(record.startDate, record.endDate),
            ]}
            claims={claims}
            onOpenClaim={onOpenClaim}
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Policy Positions" isEmpty={positions.length === 0}>
        {positions.map(({ record, claims }) => (
          <AttestedRecordCard
            key={record.id}
            title={record.topic}
            details={[
              `“${record.positionText}”`,
              record.statedAt ? `Stated ${formatIsoDate(record.statedAt)}` : undefined,
            ]}
            claims={claims}
            onOpenClaim={onOpenClaim}
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Sources" isEmpty={sources.length === 0}>
        {sources.map((source) => (
          <Card key={source.id}>
            <SourceItem source={source} />
          </Card>
        ))}
      </ProfileSection>

      {onReportError ? (
        <ActionButton
          label="Report an error"
          accessibilityHint="Tell reviewers about information on this profile that looks incorrect"
          onPress={onReportError}
        />
      ) : null}
    </Screen>
  );
}
