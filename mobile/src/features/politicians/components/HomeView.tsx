import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, ErrorState, MissingRecords } from '@/components/states';
import { colors, spacing } from '@/components/theme';
import { Body, Card, FixtureBanner, Heading, Screen, Section } from '@/components/ui';
import type { OfficeLevel } from '@/domain/enums';
import type { DirectoryFilters } from '@/domain/models/directory';
import { OFFICE_LEVEL_LABELS } from '@/features/offices/officeLevelLabels';
import { useDirectoryFilterOptions } from '@/features/politicians/hooks/queries';
import { formatIsoDate } from '@/shared/utils/dates';

type Props = {
  /** Opens the directory with a search and/or filters pre-applied. */
  onBrowse: (preset: { searchText?: string; filters?: DirectoryFilters }) => void;
  onOpenAbout: () => void;
};

const LOCAL_LEVELS: readonly OfficeLevel[] = [
  'PROVINCIAL',
  'CITY',
  'MUNICIPAL',
  'DISTRICT',
  'BARANGAY',
];

function LinkRow({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={styles.linkRow}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Home: search, browse entry points and a plain statement of how the app works.
 * Router-free (navigation is injected). No feeds, rankings, trending lists or
 * popularity metrics.
 */
export function HomeView({ onBrowse, onOpenAbout }: Props) {
  const [text, setText] = useState('');
  const options = useDirectoryFilterOptions();

  const submit = () => onBrowse({ searchText: text });

  return (
    <Screen>
      <FixtureBanner />
      <Heading>Gabay ni Juan</Heading>
      <Text style={styles.tagline}>
        Know the record.{'\n'}Check the sources.{'\n'}Decide for yourself.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Search politicians by name"
          placeholder="Search politicians"
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.search}
        />
        <ActionButton label="Search" variant="primary" onPress={submit} />
      </View>

      <ActionButton
        label="Browse all politicians"
        onPress={() => onBrowse({})}
        accessibilityHint="Opens the full directory in alphabetical order"
      />

      <Section title="Browse by election">
        {options.isPending ? (
          <Body muted>Loading elections…</Body>
        ) : options.error ? (
          <ErrorState error={options.error} onRetry={() => void options.refetch()} />
        ) : options.data.elections.length === 0 ? (
          <MissingRecords message="No elections have been added yet." />
        ) : (
          options.data.elections.map((election) => (
            <LinkRow
              key={election.id}
              label={`${election.name} · ${formatIsoDate(election.electionDate)}`}
              onPress={() => onBrowse({ filters: { electionId: election.id } })}
            />
          ))
        )}
      </Section>

      <Section title="Browse by office level">
        <LinkRow
          label="National offices"
          onPress={() => onBrowse({ filters: { officeLevel: 'NATIONAL' } })}
        />
        <Body muted>Local offices</Body>
        {LOCAL_LEVELS.map((level) => (
          <LinkRow
            key={level}
            label={`${OFFICE_LEVEL_LABELS[level]} offices`}
            onPress={() => onBrowse({ filters: { officeLevel: level } })}
          />
        ))}
      </Section>

      <Section title="How verification works">
        <Card>
          <Body>
            Every statement carries its own verification state, and every state links to the sources
            behind it. Verification describes the evidence for one statement. It is never a
            judgement of a person.
          </Body>
          <ActionButton label="How verification works" onPress={onOpenAbout} />
        </Card>
      </Section>

      <Body muted>Gabay ni Juan does not endorse, rank, score, or recommend any candidate.</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: { fontSize: 18, lineHeight: 26, color: colors.text, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  search: {
    flex: 1,
    minHeight: 44,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  linkRow: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  linkText: { fontSize: 16, color: colors.accent, fontWeight: '600' },
});
