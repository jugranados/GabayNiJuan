import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      {children}
    </ScrollView>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function LoadingView() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator accessibilityLabel="Loading" />
    </View>
  );
}

/** Shown while the app runs on fictional development fixtures. */
export function FixtureBanner() {
  if (process.env.EXPO_PUBLIC_DATA_SOURCE === 'supabase') {
    return null;
  }
  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.bannerText}>
        Development build: every person, office, and source shown is fictional.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.lg, gap: spacing.lg },
  heading: { fontSize: 24, fontWeight: '700', color: colors.text },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
  },
  body: { fontSize: 15, lineHeight: 21, color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  banner: {
    backgroundColor: colors.notice,
    borderColor: colors.noticeBorder,
    borderWidth: 1,
    borderRadius: 6,
    padding: spacing.sm,
  },
  bannerText: { fontSize: 13, color: colors.text },
});
