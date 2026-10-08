import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { DEFAULT_PAGE_SIZE, directoryQueryKey } from '@/domain/directory';
import type { DirectoryFilters } from '@/domain/models/directory';
import { useRepositories } from '@/shared/hooks/useRepositories';

export const politicianKeys = {
  all: ['people'] as const,
  directory: (key: string) => [...politicianKeys.all, 'directory', key] as const,
  filterOptions: () => [...politicianKeys.all, 'filter-options'] as const,
  profile: (id: string) => [...politicianKeys.all, 'profile', id] as const,
};

/**
 * Paginated directory. Pages are fetched by offset; the database (or the mock)
 * does the filtering, ordering and counting. Always alphabetical.
 */
export function useDirectory(search: { query?: string; filters?: DirectoryFilters }) {
  const { people } = useRepositories();
  const key = directoryQueryKey(search);
  return useInfiniteQuery({
    queryKey: politicianKeys.directory(key),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      people.searchDirectory({ ...search, page: { limit: DEFAULT_PAGE_SIZE, offset: pageParam } }),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    // Keep showing the previous results while a new search loads (no flicker).
    placeholderData: keepPreviousData,
  });
}

export function useDirectoryFilterOptions() {
  const { people } = useRepositories();
  return useQuery({
    queryKey: politicianKeys.filterOptions(),
    queryFn: () => people.getDirectoryFilterOptions(),
    staleTime: 30 * 60 * 1000,
  });
}

export function usePersonProfile(id: string) {
  const { people } = useRepositories();
  return useQuery({
    queryKey: politicianKeys.profile(id),
    queryFn: () => people.getPersonProfile(id),
  });
}
