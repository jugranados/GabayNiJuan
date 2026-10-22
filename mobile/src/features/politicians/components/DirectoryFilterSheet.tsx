import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import { ActionButton, ErrorState } from '@/components/states';
import { Body } from '@/components/ui';
import { compactFilters, countActiveFilters } from '@/domain/directory';
import type { DirectoryFilterOptions, DirectoryFilters } from '@/domain/models/directory';
import {
  FILTER_DEFINITIONS,
  choicesFor,
  type UiFilterKey,
} from '@/features/politicians/filterConfig';

type Props = {
  visible: boolean;
  filters: DirectoryFilters;
  options: DirectoryFilterOptions | undefined;
  optionsError: unknown;
  onRetryOptions: () => void;
  onApply: (filters: DirectoryFilters) => void;
  onClose: () => void;
};

/**
 * Filter sheet: one single-choice group per FILTER_DEFINITIONS entry. Choices
 * are staged locally and applied together, so the list does not reload on
 * every tap. Selection is conveyed by text ("Selected"), not by color alone.
 */
export function DirectoryFilterSheet(props: Props) {
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      {/* Mounted only while open, so the staged choices always start from the applied filters. */}
      {props.visible ? <SheetBody {...props} /> : null}
    </Modal>
  );
}

function SheetBody({ filters, options, optionsError, onRetryOptions, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<DirectoryFilters>(filters);

  const choose = (key: UiFilterKey, value: string | undefined) =>
    setDraft((current) => compactFilters({ ...current, [key]: value }));

  return (
    <View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Filter politicians
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filters"
          onPress={onClose}
          style={styles.close}
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Body muted>
          Filters narrow the list using documented records only. Results stay in alphabetical order.
        </Body>

        {optionsError ? (
          <ErrorState error={optionsError} onRetry={onRetryOptions} />
        ) : !options ? (
          <Body muted>Loading filter options…</Body>
        ) : (
          FILTER_DEFINITIONS.map((definition) => {
            const choices = choicesFor(definition.key, options);
            const selected = draft[definition.key];
            return (
              <View key={definition.key} style={styles.group} accessibilityRole="radiogroup">
                <Text accessibilityRole="header" style={styles.groupTitle}>
                  {definition.label}
                </Text>
                {choices.length === 0 ? (
                  <Body muted>No options available yet.</Body>
                ) : (
                  <>
                    <Option
                      label="Any"
                      selected={selected === undefined}
                      onPress={() => choose(definition.key, undefined)}
                    />
                    {choices.map((choice) => (
                      <Option
                        key={choice.value}
                        label={choice.label}
                        selected={selected === choice.value}
                        onPress={() => choose(definition.key, choice.value)}
                      />
                    ))}
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <ActionButton
          label="Clear all"
          onPress={() => setDraft({})}
          accessibilityHint="Removes every selected filter in this sheet"
        />
        <ActionButton
          label={`Show results${
            countActiveFilters(draft) > 0 ? ` (${countActiveFilters(draft)} filters)` : ''
          }`}
          variant="primary"
          onPress={() => onApply(compactFilters(draft))}
        />
      </View>
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
      {selected ? <Text style={styles.optionMark}>Selected</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, flexShrink: 1 },
  close: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 16, color: colors.accent, fontWeight: '600' },
  content: { padding: spacing.lg, gap: spacing.lg },
  group: { gap: spacing.xs },
  groupTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.accent, borderWidth: 2 },
  optionText: { flex: 1, fontSize: 15, color: colors.text },
  optionTextSelected: { fontWeight: '700' },
  optionMark: { fontSize: 12, fontWeight: '700', color: colors.accent },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
