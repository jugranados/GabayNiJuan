import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/hooks/useRepositories';

export const politicianKeys = {
  all: ['people'] as const,
  list: () => [...politicianKeys.all, 'list'] as const,
  search: (query: string) => [...politicianKeys.all, 'search', query] as const,
  profile: (id: string) => [...politicianKeys.all, 'profile', id] as const,
};

export const MIN_SEARCH_LENGTH = 2;

/** Directory list. Queries shorter than MIN_SEARCH_LENGTH show the full list. */
export function usePeopleDirectory(query: string) {
  const { people } = useRepositories();
  const trimmed = query.trim();
  const isSearch = trimmed.length >= MIN_SEARCH_LENGTH;
  return useQuery({
    queryKey: isSearch ? politicianKeys.search(trimmed) : politicianKeys.list(),
    queryFn: () => (isSearch ? people.searchPeople(trimmed) : people.getPeople()),
  });
}

export function usePersonProfile(id: string) {
  const { people } = useRepositories();
  return useQuery({
    queryKey: politicianKeys.profile(id),
    queryFn: () => people.getPersonProfile(id),
  });
}
