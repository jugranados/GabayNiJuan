import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, DirectoryLoading, EmptyState, ErrorState } from '@/components/states';
import { Body, FixtureBanner } from '@/components/ui';
import { colors, spacing } from '@/components/theme';
import {
  cleanSearchText,
  countActiveFilters,
  isSearchTooShort,
  MIN_SEARCH_LENGTH,
} from '@/domain/directory';
import { ActiveFilterChips } from '@/features/politicians/components/ActiveFilterChips';
import { DirectoryFilterSheet } from '@/features/politicians/components/DirectoryFilterSheet';
import { PoliticianCard } from '@/features/politicians/components/PoliticianCard';
import { useDirectoryUiStore } from '@/features/politicians/directoryStore';
import { useDirectory, useDirectoryFilterOptions } from '@/features/politicians/hooks/queries';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

type Props = {
  onOpenPerson: (personId: string) => void;
  /** Milliseconds to wait after typing stops before searching. */
  debounceMs?: number;
};

/**
 * The voter directory: name search, filters, active-filter chips and a
 * paginated, alphabetical list of cards. Router-free so it can be tested;
 * navigation is injected. Search text and filters live in a store, so they are
 * still there when the voter comes back from a profile.
 */
export function DirectoryView({ onOpenPerson, debounceMs = 300 }: Props) {
  const searchText = useDirectoryUiStore((state) => state.searchText);
  const filters = useDirectoryUiStore((state) => state.filters);
  const setSearchText = useDirectoryUiStore((state) => state.setSearchText);
  const setFilters = useDirectoryUiStore((state) => state.setFilters);
  const clearFilters = useDirectoryUiStore((state) => state.clearFilters);
  const reset = useDirectoryUiStore((state) => state.reset);

  const [sheetOpen, setSheetOpen] = useState(false);
  const debouncedText = useDebouncedValue(searchText, debounceMs);

  const directory = useDirectory({ query: debouncedText, filters });
  const filterOptions = useDirectoryFilterOptions();

  const entries = useMemo(
    () => directory.data?.pages.flatMap((page) => page.items) ?? [],
    [directory.data],
  );
  const total = directory.data?.pages[directory.data.pages.length - 1]?.total;

  const activeCount = countActiveFilters(filters);
  const hasSearch = cleanSearchText(searchText).length > 0;
  const narrowed = hasSearch || activeCount > 0;

  const resultSummary =
    total === undefined
      ? undefined
      : `${total} ${total === 1 ? 'result' : 'results'} · alphabetical by name`;

  return (
    <View style={styles.screen}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <PoliticianCard entry={item} onPress={onOpenPerson} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (directory.hasNextPage && !directory.isFetchingNextPage)
            void directory.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <FixtureBanner />

            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="Search politicians by name"
                placeholder="Search by name"
                value={searchText}
                onChangeText={setSearchText}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="never"
                style={styles.search}
              />
              {hasSearch ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearchText('')}
                  style={styles.clearSearch}
                >
                  <Text style={styles.clearSearchText}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            {isSearchTooShort(searchText) ? (
              <Body muted>Type at least {MIN_SEARCH_LENGTH} characters to search by name.</Body>
            ) : null}

            <ActionButton
              label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
              onPress={() => setSheetOpen(true)}
              accessibilityHint="Opens filters for election, office, status and organization"
            />
            <ActiveFilterChips
              filters={filters}
              options={filterOptions.data}
              onRemove={(key) => setFilters({ ...filters, [key]: undefined })}
              onClearAll={clearFilters}
            />

            <View accessibilityLiveRegion="polite">
              {resultSummary ? <Body muted>{resultSummary}</Body> : null}
            </View>
            <Body muted>Order does not imply ranking.</Body>
          </View>
        }
        ListEmptyComponent={
          directory.isPending ? (
            <DirectoryLoading />
          ) : directory.error ? (
            <ErrorState error={directory.error} onRetry={() => void directory.refetch()} />
          ) : narrowed ? (
            <EmptyState
              title="No politicians match this search"
              body="Try a different name or fewer filters. Gabay ni Juan only covers the figures that have been added so far, so a missing name does not mean a person has no public record."
              actionLabel="Clear search and filters"
              onAction={reset}
            />
          ) : (
            <EmptyState
              title="No records have been added yet"
              body="Politicians will appear here once their records have been added and reviewed."
            />
          )
        }
        ListFooterComponent={
          directory.isFetchingNextPage ? (
            <Body muted>Loading more…</Body>
          ) : directory.hasNextPage ? (
            <ActionButton label="Show more" onPress={() => void directory.fetchNextPage()} />
          ) : null
        }
      />

      <DirectoryFilterSheet
        visible={sheetOpen}
        filters={filters}
        options={filterOptions.data}
        optionsError={filterOptions.error}
        onRetryOptions={() => void filterOptions.refetch()}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { gap: spacing.md, marginBottom: spacing.md, alignItems: 'stretch' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  clearSearch: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  clearSearchText: { fontSize: 15, color: colors.accent, fontWeight: '600' },
});
