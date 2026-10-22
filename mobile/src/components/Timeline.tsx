import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';

export type TimelineEntry = {
  key: string;
  /** Years the record covers, e.g. "2019 – 2022". Omitted when no date is known. */
  period?: string;
  title: string;
  /** Neutral descriptor, e.g. "Elected". */
  detail?: string;
  /** Clarification such as "No end date recorded". */
  note?: string;
  children?: ReactNode;
};

/**
 * Vertical history, most recent first. Presentation only: it implies nothing
 * about whether moving between offices or organizations is good or bad.
 */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <View accessibilityRole="list">
      {entries.map((entry, index) => (
        <View key={entry.key} style={styles.row}>
          <View style={styles.rail}>
            <View style={styles.dot} />
            {index < entries.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.content}>
            <Text style={styles.period}>{entry.period ?? 'Dates not recorded'}</Text>
            <Text style={styles.title}>{entry.title}</Text>
            {entry.detail ? <Text style={styles.detail}>{entry.detail}</Text> : null}
            {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
            {entry.children ? <View style={styles.children}>{entry.children}</View> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 5 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 },
  content: { flex: 1, paddingBottom: spacing.lg, gap: 2 },
  period: { fontSize: 13, fontWeight: '700', color: colors.accent },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted },
  note: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  children: { marginTop: spacing.sm, gap: spacing.sm },
});
