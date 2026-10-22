import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import type { DirectoryFilterOptions, DirectoryFilters } from '@/domain/models/directory';
import {
  activeUiFilters,
  describeFilterValue,
  type UiFilterKey,
} from '@/features/politicians/filterConfig';

type Props = {
  filters: DirectoryFilters;
  options: DirectoryFilterOptions | undefined;
  onRemove: (key: UiFilterKey) => void;
  onClearAll: () => void;
};

/** One removable chip per active filter, plus "Clear all filters". */
export function ActiveFilterChips({ filters, options, onRemove, onClearAll }: Props) {
  const active = activeUiFilters(filters);
  if (active.length === 0) return null;

  return (
    <View style={styles.row}>
      {active.map(({ definition, value }) => {
        const text = `${definition.label}: ${describeFilterValue(definition.key, value, options)}`;
        return (
          <Pressable
            key={definition.key}
            accessibilityRole="button"
            accessibilityLabel={`Remove filter ${text}`}
            onPress={() => onRemove(definition.key)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{text} ×</Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear all filters"
        onPress={onClearAll}
        style={styles.clear}
      >
        <Text style={styles.clearText}>Clear all filters</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.background,
    maxWidth: '100%',
  },
  chipText: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  clear: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  clearText: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'underline' },
});
