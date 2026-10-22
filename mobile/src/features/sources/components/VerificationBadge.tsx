import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import type { VerificationStatus } from '@/domain/enums';
import { VERIFICATION_STATE_INFO } from '@/features/sources/verificationStates';

type Props = {
  status: VerificationStatus;
};

/**
 * Shows the verification state of a single claim. Tapping it reveals what the
 * state means. All states share one neutral style so none reads as a verdict.
 */
export function VerificationBadge({ status }: Props) {
  const [expanded, setExpanded] = useState(false);
  const info = VERIFICATION_STATE_INFO[status];

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Verification: ${info.label}`}
        accessibilityHint="Shows what this verification state means"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.badge}
        testID={`verification-badge-${status}`}
      >
        <Text style={styles.label}>{info.label}</Text>
        <Text style={styles.toggle}>{expanded ? '−' : 'ⓘ'}</Text>
      </Pressable>
      {expanded ? <Text style={styles.description}>{info.description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', gap: spacing.xs },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  label: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  toggle: { color: colors.accent, fontSize: 12 },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
