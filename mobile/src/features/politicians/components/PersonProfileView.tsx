import type { ReactNode } from 'react';

import { Body, Card, FixtureBanner, Heading, Screen, Section } from '@/components/ui';
import { formatPersonName } from '@/domain/models/person';
import type { PersonProfile } from '@/domain/models/personProfile';
import { AFFILIATION_TYPE_LABELS } from '@/features/affiliations/affiliationLabels';
import { PARTICIPATION_STATUS_LABELS } from '@/features/elections/participationLabels';
import { OFFICE_TERM_STATUS_LABELS } from '@/features/offices/officeTermLabels';
import { AttestedRecordCard } from '@/features/politicians/components/AttestedRecordCard';
import { ClaimCard } from '@/features/sources/components/ClaimCard';
import { SourceItem } from '@/features/sources/components/SourceItem';
import { formatDateRange, formatIsoDate } from '@/shared/utils/dates';

/** Neutral wording for an empty section: absence of a record is not a fact about the person. */
function NotDocumented() {
  return <Body muted>No records have been added for this section yet.</Body>;
}

function ProfileSection({
  title,
  isEmpty,
  children,
}: {
  title: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return <Section title={title}>{isEmpty ? <NotDocumented /> : children}</Section>;
}

export function PersonProfileView({ profile }: { profile: PersonProfile }) {
  const { person, evidenceSummary } = profile;

  return (
    <Screen>
      <FixtureBanner />
      <Heading>{formatPersonName(person)}</Heading>
      <Body muted>
        {evidenceSummary.claimCount} claims from {evidenceSummary.sourceCount} sources
        {evidenceSummary.lastReviewedAt
          ? ` · Last reviewed ${formatIsoDate(evidenceSummary.lastReviewedAt)}`
          : ''}
      </Body>

      <ProfileSection title="Profile" isEmpty={profile.identityClaims.length === 0}>
        {profile.identityClaims.map((item) => (
          <Card key={item.claim.id}>
            <ClaimCard {...item} />
          </Card>
        ))}
      </ProfileSection>

      <ProfileSection title="Election Status" isEmpty={profile.electionParticipations.length === 0}>
        {profile.electionParticipations.map(({ record, claims }) => (
          <AttestedRecordCard
            key={record.participation.id}
            title={record.office.name}
            details={[
              record.election.name,
              PARTICIPATION_STATUS_LABELS[record.participation.status],
              record.participation.ballotNumber
                ? `Ballot number ${record.participation.ballotNumber}`
                : undefined,
            ]}
            claims={claims}
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Political Experience" isEmpty={profile.officeTerms.length === 0}>
        {profile.officeTerms.map(({ record, claims }) => (
          <AttestedRecordCard
            key={record.term.id}
            title={record.office.name}
            details={[
              OFFICE_TERM_STATUS_LABELS[record.term.status],
              formatDateRange(record.term.startDate, record.term.endDate),
            ]}
            claims={claims}
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Affiliations" isEmpty={profile.affiliations.length === 0}>
        {profile.affiliations.map(({ record, claims }) => (
          <AttestedRecordCard
            key={record.affiliation.id}
            title={record.organization.name}
            details={[
              AFFILIATION_TYPE_LABELS[record.affiliation.affiliationType],
              formatDateRange(record.affiliation.startDate, record.affiliation.endDate),
            ]}
            claims={claims}
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Education" isEmpty={profile.education.length === 0}>
        {profile.education.map(({ record, claims }) => (
          <AttestedRecordCard
            key={record.id}
            title={record.institution}
            details={[
              [record.credential, record.program].filter(Boolean).join(', ') || undefined,
              formatDateRange(record.startDate, record.endDate),
            ]}
            claims={claims}
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Policy Positions" isEmpty={profile.policyPositions.length === 0}>
        {profile.policyPositions.map(({ record, claims }) => (
          <AttestedRecordCard
            key={record.id}
            title={record.topic}
            details={[
              `“${record.positionText}”`,
              record.statedAt ? `Stated ${formatIsoDate(record.statedAt)}` : undefined,
            ]}
            claims={claims}
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Sources" isEmpty={profile.sources.length === 0}>
        {profile.sources.map((source) => (
          <Card key={source.id}>
            <SourceItem source={source} />
          </Card>
        ))}
      </ProfileSection>
    </Screen>
  );
}
