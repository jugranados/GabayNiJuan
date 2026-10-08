import { StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui';
import { colors } from '@/components/theme';
import type { ClaimWithEvidence } from '@/domain/models/personProfile';
import { EvidenceBlock } from '@/features/sources/components/EvidenceBlock';

type Props = {
  title: string;
  details: (string | undefined)[];
  claims: ClaimWithEvidence[];
  onOpenClaim?: (claimId: string) => void;
};

/**
 * A profile record with the claims that attest to it. A record with no claim
 * is shown as unverified with no source, never as established fact.
 */
export function AttestedRecordCard({ title, details, claims, onOpenClaim }: Props) {
  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      {details
        .filter((line): line is string => Boolean(line))
        .map((line) => (
          <Text key={line} style={styles.detail}>
            {line}
          </Text>
        ))}
      <EvidenceBlock claims={claims} onOpenClaim={onOpenClaim} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted },
});
