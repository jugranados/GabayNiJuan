/**
 * Pure rules for directory queries. Shared by the repository, both data
 * sources and the UI so every part normalises input the same way.
 */
import type {
  DirectoryFilterKey,
  DirectoryFilters,
  DirectoryQuery,
} from '@/domain/models/directory';

export const MIN_SEARCH_LENGTH = 2;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const FILTER_KEYS: readonly DirectoryFilterKey[] = [
  'electionId',
  'officeId',
  'officeLevel',
  'participationStatus',
  'organizationId',
  'jurisdictionId',
];

/** Trims and collapses whitespace. */
export function cleanSearchText(text: string | undefined): string {
  return (text ?? '').trim().replace(/\s+/g, ' ');
}

/** Normalised text to search for, or undefined while it is too short to apply. */
export function effectiveSearchText(text: string | undefined): string | undefined {
  const cleaned = cleanSearchText(text);
  return cleaned.length >= MIN_SEARCH_LENGTH ? cleaned : undefined;
}

/** True when the user typed something that is not yet long enough to search. */
export function isSearchTooShort(text: string | undefined): boolean {
  const cleaned = cleanSearchText(text);
  return cleaned.length > 0 && cleaned.length < MIN_SEARCH_LENGTH;
}

/** Removes empty values so equal filters always compare and cache equally. */
export function compactFilters(filters: DirectoryFilters | undefined): DirectoryFilters {
  const result: DirectoryFilters = {};
  for (const key of FILTER_KEYS) {
    const value = filters?.[key];
    if (value !== undefined && value !== '') {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

export function activeFilterKeys(filters: DirectoryFilters | undefined): DirectoryFilterKey[] {
  const compact = compactFilters(filters);
  return FILTER_KEYS.filter((key) => compact[key] !== undefined);
}

export function countActiveFilters(filters: DirectoryFilters | undefined): number {
  return activeFilterKeys(filters).length;
}

export type NormalizedDirectoryQuery = {
  query?: string;
  filters: DirectoryFilters;
  sort: 'NAME_ASC';
  limit: number;
  offset: number;
};

export function normalizeDirectoryQuery(input: DirectoryQuery = {}): NormalizedDirectoryQuery {
  const limit = Math.min(
    Math.max(Math.trunc(input.page?.limit ?? DEFAULT_PAGE_SIZE), 1),
    MAX_PAGE_SIZE,
  );
  const offset = Math.max(Math.trunc(input.page?.offset ?? 0), 0);
  return {
    query: effectiveSearchText(input.query),
    filters: compactFilters(input.filters),
    sort: 'NAME_ASC',
    limit,
    offset,
  };
}

/** Stable key for caches: equal queries produce equal keys. */
export function directoryQueryKey(input: DirectoryQuery): string {
  const { query, filters, sort } = normalizeDirectoryQuery({ ...input, page: undefined });
  return JSON.stringify({ query: query?.toLowerCase() ?? null, filters, sort });
}
