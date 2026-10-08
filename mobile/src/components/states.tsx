import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import { Body } from '@/components/ui';
import { ERROR_COPY, classifyError } from '@/shared/utils/errors';

/** The one message for a section that has no records. Absence is not a finding. */
export const MISSING_RECORDS_MESSAGE = 'No records have been added for this section yet.';

export function MissingRecords({ message = MISSING_RECORDS_MESSAGE }: { message?: string }) {
  return <Body muted>{message}</Body>;
}

export function ActionButton({
  label,
  onPress,
  variant = 'secondary',
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={[styles.button, variant === 'primary' && styles.buttonPrimary]}
    >
      <Text style={[styles.buttonText, variant === 'primary' && styles.buttonTextPrimary]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Neutral message block: no results, no records, or a hint. */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.state}>
      <Text accessibilityRole="header" style={styles.stateTitle}>
        {title}
      </Text>
      {body ? <Body muted>{body}</Body> : null}
      {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

/**
 * Voter-facing failure message: offline, validation or backend. Technical
 * detail is shown only in development builds.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const copy = ERROR_COPY[classifyError(error)];
  return (
    <View style={styles.state} accessibilityRole="alert">
      <Text style={styles.stateTitle}>{copy.title}</Text>
      <Body muted>{copy.body}</Body>
      {__DEV__ && error instanceof Error ? <Body muted>{error.message}</Body> : null}
      {onRetry ? <ActionButton label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

/** Full-screen failure message with an optional retry. */
export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.fullScreen}>
      <ErrorState error={error} onRetry={onRetry} />
    </View>
  );
}

function SkeletonBar({ width }: { width: `${number}%` }) {
  return <View style={[styles.bar, { width }]} />;
}

/** Placeholder shaped like a directory card while the first page loads. */
export function DirectoryCardSkeleton() {
  return (
    <View style={styles.skeletonCard} accessibilityElementsHidden importantForAccessibility="no">
      <View style={styles.skeletonPhoto} />
      <View style={styles.skeletonLines}>
        <SkeletonBar width="60%" />
        <SkeletonBar width="85%" />
        <SkeletonBar width="40%" />
      </View>
    </View>
  );
}

export function DirectoryLoading() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading politicians">
      <DirectoryCardSkeleton />
      <DirectoryCardSkeleton />
      <DirectoryCardSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, justifyContent: 'center' },
  state: { padding: spacing.lg, gap: spacing.sm, alignItems: 'flex-start' },
  stateTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.background,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  buttonTextPrimary: { color: '#ffffff' },
  skeletonCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  skeletonPhoto: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.border },
  skeletonLines: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  bar: { height: 12, borderRadius: 6, backgroundColor: colors.border },
});
