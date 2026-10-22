import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PersonPhoto } from '@/components/PersonPhoto';
import { colors, spacing } from '@/components/theme';
import { Body, Heading } from '@/components/ui';
import { HEADLINE_ELIGIBLE_STATUSES } from '@/domain/currentRecords';
import type { IsoDate } from '@/domain/models';
import { formatPersonName } from '@/domain/models/person';
import type { ClaimWithEvidence, PersonProfile } from '@/domain/models/personProfile';
import { deriveProfileContext } from '@/domain/profileContext';
import { AFFILIATION_TYPE_LABELS } from '@/features/affiliations/affiliationLabels';
import { PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';
import { formatIsoDate, formatYearRange } from '@/shared/utils/dates';
import { photoUrlFor } from '@/shared/utils/photo';

type Props = {
  profile: PersonProfile;
  today: IsoDate;
  onOpenClaim?: (claimId: string) => void;
};

/** The first claim that gives a record standing evidence; its badge accompanies the headline fact. */
function leadClaim(claims: ClaimWithEvidence[]): ClaimWithEvidence | undefined {
  return claims.find(({ claim }) => HEADLINE_ELIGIBLE_STATUSES.includes(claim.verificationStatus));
}

function Fact({
  label,
  text,
  claims,
  onOpenClaim,
}: {
  label: string;
  text: string;
  claims: ClaimWithEvidence[];
  onOpenClaim?: (claimId: string) => void;
}) {
  const lead = leadClaim(claims);
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factText}>{text}</Text>
      {lead ? (
        <View style={styles.factEvidence}>
          <VerificationBadge status={lead.claim.verificationStatus} />
          {onOpenClaim ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`View evidence for ${label.toLowerCase()}`}
              onPress={() => onOpenClaim(lead.claim.id)}
              style={styles.evidenceLink}
            >
              <Text style={styles.link}>View evidence</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Profile header: photo, name, the election participation and office or
 * affiliation that are CURRENT by their dates and have standing evidence, and an
 * informational evidence count. It never says a person is "verified": verification
 * belongs to individual claims.
 */
export function PersonProfileHeader({ profile, today, onOpenClaim }: Props) {
  const name = formatPersonName(profile.person);
  const context = deriveProfileContext(profile, today);
  const { evidenceSummary } = profile;
  const hasContext =
    context.electionContext.length +
      context.currentOffices.length +
      context.currentAffiliations.length >
    0;

  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <PersonPhoto name={name} uri={photoUrlFor(profile.person.photoAssetId)} size={72} />
        <View style={styles.identityText}>
          <Heading>{name}</Heading>
        </View>
      </View>

      {hasContext ? (
        <View style={styles.facts}>
          {context.electionContext.map((item) => (
            <Fact
              key={item.record.participation.id}
              label="Election"
              text={`${item.record.office.name}: ${PARTICIPATION_STATUS_INFO[item.record.participation.status].label} (${item.record.election.name})`}
              claims={item.claims}
              onOpenClaim={onOpenClaim}
            />
          ))}
          {context.currentOffices.map((item) => (
            <Fact
              key={item.record.term.id}
              label="Current documented office"
              text={`${item.record.office.name}${
                item.record.term.startDate
                  ? ` · ${formatYearRange(item.record.term.startDate)}`
                  : ''
              }`}
              claims={item.claims}
              onOpenClaim={onOpenClaim}
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
              onOpenClaim={onOpenClaim}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.summary} accessibilityLabel="Evidence summary">
        <Body muted>
          {evidenceSummary.claimCount} {evidenceSummary.claimCount === 1 ? 'claim' : 'claims'} from{' '}
          {evidenceSummary.sourceCount} {evidenceSummary.sourceCount === 1 ? 'source' : 'sources'}
          {evidenceSummary.lastReviewedAt
            ? ` · Last reviewed ${formatIsoDate(evidenceSummary.lastReviewedAt)}`
            : ''}
        </Body>
        <Body muted>
          These counts show how much evidence is on file. They are not a rating of this person.
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, flexShrink: 1 },
  facts: { gap: spacing.md },
  fact: { gap: 2 },
  factLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  factText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  factEvidence: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  evidenceLink: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 13, color: colors.accent, textDecorationLine: 'underline' },
  summary: { gap: 2 },
});
