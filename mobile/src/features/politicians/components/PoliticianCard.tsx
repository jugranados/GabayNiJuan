import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PersonPhoto } from '@/components/PersonPhoto';
import { colors, spacing } from '@/components/theme';
import type { DirectoryEntry } from '@/domain/models/directory';
import { AFFILIATION_TYPE_LABELS } from '@/features/affiliations/affiliationLabels';
import { PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';
import { formatYearRange } from '@/shared/utils/dates';
import { photoUrlFor } from '@/shared/utils/photo';

const MAX_PARTICIPATIONS_SHOWN = 2;

/** Describes an affiliation record by its dates only; never implies it is still true beyond them. */
export function describeAffiliation(entry: DirectoryEntry): string | undefined {
  const a = entry.affiliation;
  if (!a) return undefined;
  const since = formatYearRange(a.startDate);
  return `${a.organizationName} (${AFFILIATION_TYPE_LABELS[a.affiliationType].toLowerCase()})${since ? ` · ${since}` : ''}`;
}

type Props = {
  entry: DirectoryEntry;
  onPress: (personId: string) => void;
};

/**
 * Directory card. Shows only neutral documented fields: name, election and
 * office context with participation status, and one dated affiliation record
 * when one is current. No counts, scores or other statistics.
 */
export function PoliticianCard({ entry, onPress }: Props) {
  const shown = entry.participations.slice(0, MAX_PARTICIPATIONS_SHOWN);
  const hidden = entry.participations.length - shown.length;
  const affiliation = describeAffiliation(entry);

  const spoken = [
    entry.displayName,
    ...shown.map(
      (p) => `${PARTICIPATION_STATUS_INFO[p.status].label}, ${p.officeName}, ${p.electionName}`,
    ),
    affiliation ? `Affiliation: ${affiliation}` : undefined,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens the profile"
      onPress={() => onPress(entry.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`politician-card-${entry.id}`}
    >
      <PersonPhoto name={entry.displayName} uri={photoUrlFor(entry.photoAssetId)} />
      <View style={styles.body}>
        <Text style={styles.name}>{entry.displayName}</Text>

        {shown.map((p) => (
          <View key={`${p.electionName}|${p.officeName}`} style={styles.context}>
            <Text style={styles.office}>{p.officeName}</Text>
            <Text style={styles.meta}>
              {p.electionName} · {PARTICIPATION_STATUS_INFO[p.status].label}
            </Text>
          </View>
        ))}
        {hidden > 0 ? (
          <Text style={styles.meta}>
            +{hidden} more election {hidden === 1 ? 'participation' : 'participations'}
          </Text>
        ) : null}

        {affiliation ? <Text style={styles.meta}>Affiliation: {affiliation}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  body: { flex: 1, flexShrink: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  context: { marginTop: 2 },
  office: { fontSize: 14, color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
});
