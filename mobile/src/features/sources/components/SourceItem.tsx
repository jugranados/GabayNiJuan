import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import type { Source } from '@/domain/models';
import { describeSourceType } from '@/features/sources/sourceTypeLabels';
import { formatIsoDate } from '@/shared/utils/dates';

function OpenLink({ url, label }: { url: string; label: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

/** Full citation for a source, with links the voter can open. */
export function SourceItem({ source }: { source: Source }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{source.title}</Text>
      <Text style={styles.meta}>{source.publisher}</Text>
      <Text style={styles.meta}>{describeSourceType(source.sourceType)}</Text>
      {source.documentIdentifier ? (
        <Text style={styles.meta}>Document: {source.documentIdentifier}</Text>
      ) : null}
      <Text style={styles.meta}>
        {source.publishedAt ? `Published ${formatIsoDate(source.publishedAt)} · ` : ''}
        Retrieved {formatIsoDate(source.retrievedAt)}
      </Text>
      <View style={styles.links}>
        {source.url ? <OpenLink url={source.url} label="Open source" /> : null}
        {source.archivedUrl ? (
          <OpenLink url={source.archivedUrl} label="Open archived copy" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  links: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  link: { fontSize: 13, color: colors.accent, textDecorationLine: 'underline' },
});
