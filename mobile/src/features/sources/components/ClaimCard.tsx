import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import type { ClaimWithEvidence } from '@/domain/models/personProfile';
import { SourceItem } from '@/features/sources/components/SourceItem';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';
import { formatDateRange, formatIsoDate } from '@/shared/utils/dates';

type Props = ClaimWithEvidence & {
  /** When provided, shows a link that opens the claim's source viewer. */
  onOpenDetails?: (claimId: string) => void;
};

/** A single claim with its verification state and every attached source, supporting or not. */
export function ClaimCard({ claim, evidence, onOpenDetails }: Props) {
  const period = formatDateRange(claim.effectiveFrom, claim.effectiveTo);

  return (
    <View style={styles.container} testID={`claim-${claim.id}`}>
      <VerificationBadge status={claim.verificationStatus} />
      <Text style={styles.statement}>{claim.statement}</Text>
      {period ? <Text style={styles.meta}>Applies: {period}</Text> : null}
      {claim.lastReviewedAt ? (
        <Text style={styles.meta}>Last reviewed {formatIsoDate(claim.lastReviewedAt)}</Text>
      ) : null}

      {onOpenDetails ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="View evidence and sources"
          onPress={() => onOpenDetails(claim.id)}
        >
          <Text style={styles.link}>View evidence and sources</Text>
        </Pressable>
      ) : null}

      {evidence.length === 0 ? (
        <Text style={styles.meta}>No source attached.</Text>
      ) : (
        evidence.map(({ link, source }) => (
          <View key={`${link.claimId}:${link.sourceId}`} style={styles.evidence}>
            <Text style={styles.relation}>
              {link.supports ? 'Supporting source' : 'Conflicting source'}
            </Text>
            {link.note ? <Text style={styles.meta}>{link.note}</Text> : null}
            <SourceItem source={source} />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  statement: { fontSize: 15, lineHeight: 21, color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  evidence: {
    borderLeftColor: colors.border,
    borderLeftWidth: 2,
    paddingLeft: spacing.sm,
    marginTop: spacing.xs,
    gap: 2,
  },
  relation: { fontSize: 12, fontWeight: '600', color: colors.text },
  link: { fontSize: 13, color: colors.accent, textDecorationLine: 'underline' },
});
