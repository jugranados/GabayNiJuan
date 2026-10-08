import { Link } from 'expo-router';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import { Body, ErrorView, FixtureBanner, LoadingView } from '@/components/ui';
import { useDirectoryUiStore } from '@/features/politicians/directoryStore';
import { usePeopleDirectory } from '@/features/politicians/hooks/queries';

export default function PoliticiansScreen() {
  const searchText = useDirectoryUiStore((state) => state.searchText);
  const setSearchText = useDirectoryUiStore((state) => state.setSearchText);
  const { data, error, isPending } = usePeopleDirectory(searchText);

  return (
    <View style={styles.screen}>
      <FixtureBanner />
      <TextInput
        accessibilityLabel="Search by name"
        placeholder="Search by name"
        value={searchText}
        onChangeText={setSearchText}
        autoCorrect={false}
        style={styles.search}
      />
      <Body muted>Listed alphabetically by last name. Order does not imply ranking.</Body>
      {isPending ? (
        <LoadingView />
      ) : error ? (
        <ErrorView error={error} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Body muted>No matching names.</Body>}
          renderItem={({ item }) => (
            <Link href={{ pathname: '/politicians/[id]', params: { id: item.id } }} asChild>
              <Text accessibilityRole="link" style={styles.row}>
                {item.displayName}
              </Text>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  search: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  row: {
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
