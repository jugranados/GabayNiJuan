import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/components/theme';
import { Body, Card, Heading, Screen, Section } from '@/components/ui';
import type { ClaimDetail, EvidenceItem } from '@/domain/models/personProfile';
import { checkVerificationConsistency } from '@/domain/validation/verification';
import { SourceItem } from '@/features/sources/components/SourceItem';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';
import { VERIFICATION_STATE_INFO } from '@/features/sources/verificationStates';
import { formatDateRange, formatIsoDate } from '@/shared/utils/dates';

type Props = {
  detail: ClaimDetail;
  /** Opens the profile of the person the claim is about. */
  onOpenSubject?: (personId: string) => void;
};

function EvidenceCard({ item, relation }: { item: EvidenceItem; relation: string }) {
  return (
    <Card>
      <Text style={styles.relation}>{relation}</Text>
      <SourceItem source={item.source} />
      {item.link.note ? <Text style={styles.note}>Note: {item.link.note}</Text> : null}
    </Card>
  );
}

/**
 * Source viewer for a single claim. Shows the claim, what its verification
 * state means, when it applies and was reviewed, and every attached source,
 * with supporting and conflicting sources kept apart. No score or aggregate
 * rating is shown.
 */
export function ClaimDetailView({ detail, onOpenSubject }: Props) {
  const { claim, evidence, subject } = detail;
  const period = formatDateRange(claim.effectiveFrom, claim.effectiveTo);
  const supporting = evidence.filter((item) => item.link.supports);
  const conflicting = evidence.filter((item) => !item.link.supports);
  const issues = checkVerificationConsistency(claim, evidence);

  return (
    <Screen>
      <Heading>Claim</Heading>
      {subject ? (
        <Pressable
          accessibilityRole="link"
          onPress={onOpenSubject ? () => onOpenSubject(subject.id) : undefined}
        >
          <Text style={styles.subject}>About {subject.displayName}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.statement}>{claim.statement}</Text>

      <Section title="Verification">
        <VerificationBadge status={claim.verificationStatus} />
        <Body>{VERIFICATION_STATE_INFO[claim.verificationStatus].description}</Body>
        {issues.length > 0 ? (
          <Card>
            <Text accessibilityRole="alert" style={styles.relation}>
              This record is under review
            </Text>
            {issues.map((issue) => (
              <Body key={issue.code} muted>
                {issue.message}
              </Body>
            ))}
          </Card>
        ) : null}
      </Section>

      <Section title="Dates">
        <Body>{period ? `Applies: ${period}` : 'No effective dates recorded.'}</Body>
        <Body>
          {claim.lastReviewedAt
            ? `Last reviewed ${formatIsoDate(claim.lastReviewedAt)}`
            : 'Review date not recorded.'}
        </Body>
      </Section>

      <Section title={`Evidence (${evidence.length})`}>
        {evidence.length === 0 ? <Body muted>No source is attached to this claim.</Body> : null}
        {supporting.length > 0 ? (
          <>
            <Text style={styles.group}>Supporting sources ({supporting.length})</Text>
            {supporting.map((item) => (
              <EvidenceCard key={item.source.id} item={item} relation="Supports this claim" />
            ))}
          </>
        ) : null}
        {conflicting.length > 0 ? (
          <>
            <Text style={styles.group}>Conflicting sources ({conflicting.length})</Text>
            {conflicting.map((item) => (
              <EvidenceCard key={item.source.id} item={item} relation="Conflicts with this claim" />
            ))}
          </>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subject: { fontSize: 14, color: colors.accent, textDecorationLine: 'underline' },
  statement: { fontSize: 18, lineHeight: 26, color: colors.text },
  group: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  relation: { fontSize: 12, fontWeight: '700', color: colors.text },
  note: { fontSize: 12, color: colors.textMuted },
});
