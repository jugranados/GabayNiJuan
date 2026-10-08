import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import type { ClaimWithEvidence } from '@/domain/models/personProfile';
import { ClaimCard } from '@/features/sources/components/ClaimCard';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';

type Props = {
  claims: ClaimWithEvidence[];
  onOpenClaim?: (claimId: string) => void;
};

/**
 * The evidence attached to a profile record. A record with no claim is shown
 * as unverified with no source, never as established fact. Every claim keeps
 * its badge and a path to its source viewer.
 */
export function EvidenceBlock({ claims, onOpenClaim }: Props) {
  if (claims.length === 0) {
    return (
      <View style={styles.container}>
        <VerificationBadge status="UNVERIFIED" />
        <Text style={styles.detail}>No source attached.</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      {claims.map((item) => (
        <ClaimCard key={item.claim.id} {...item} onOpenDetails={onOpenClaim} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  detail: { fontSize: 13, color: colors.textMuted },
});
