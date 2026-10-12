/**
 * The public directory keeps all of its state in the URL, so a search or a
 * filtered view can be shared, bookmarked, crawled and rendered on the server:
 *
 *   /politicians?q=juan&level=national&status=filed-coc&page=2
 *
 * There is deliberately no `sort` parameter: the order is always alphabetical.
 */
import { ELECTION_PARTICIPATION_STATUSES, OFFICE_LEVELS } from '@/domain/enums';
import { cleanSearchText, compactFilters, DEFAULT_PAGE_SIZE } from '@/domain/directory';
import type { DirectoryFilters, DirectoryQuery } from '@/domain/models/directory';

export const DIRECTORY_PATH = '/politicians';
export const DIRECTORY_PAGE_SIZE = DEFAULT_PAGE_SIZE;
const MAX_PAGE = 10_000;
const MAX_QUERY_LENGTH = 100;

/** URL parameter name for each filter the directory UI exposes. */
export const FILTER_PARAMS = {
  electionId: 'election',
  officeLevel: 'level',
  officeId: 'office',
  participationStatus: 'status',
  organizationId: 'organization',
} as const;
export type UrlFilterKey = keyof typeof FILTER_PARAMS;

export type DirectoryState = {
  /** Search text as typed (trimmed). May be too short to apply. */
  q: string;
  filters: DirectoryFilters;
  /** 1-based. */
  page: number;
};

export type RawSearchParams = Readonly<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** `FILED_COC` <-> `filed-coc`: readable in a URL, exact in the domain. */
export const enumToParam = (value: string): string => value.toLowerCase().replace(/_/g, '-');

function paramToEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  const candidate = value?.toUpperCase().replace(/-/g, '_');
  return allowed.find((item) => item === candidate);
}

/** Ids are opaque (uuids in the database). Anything that is not id-shaped is dropped. */
function paramToId(value: string | undefined): string | undefined {
  return value && /^[A-Za-z0-9-]{1,64}$/.test(value) ? value : undefined;
}

export function parseDirectoryState(params: RawSearchParams): DirectoryState {
  const pageNumber = Number(first(params.page));
  return {
    q: cleanSearchText(first(params.q)).slice(0, MAX_QUERY_LENGTH),
    filters: compactFilters({
      electionId: paramToId(first(params[FILTER_PARAMS.electionId])),
      officeId: paramToId(first(params[FILTER_PARAMS.officeId])),
      organizationId: paramToId(first(params[FILTER_PARAMS.organizationId])),
      officeLevel: paramToEnum(first(params[FILTER_PARAMS.officeLevel]), OFFICE_LEVELS),
      participationStatus: paramToEnum(
        first(params[FILTER_PARAMS.participationStatus]),
        ELECTION_PARTICIPATION_STATUSES,
      ),
    }),
    page: Number.isInteger(pageNumber) && pageNumber >= 1 ? Math.min(pageNumber, MAX_PAGE) : 1,
  };
}

/** Canonical URL for a directory state: fixed parameter order, defaults omitted. */
export function directoryHref(state: Partial<DirectoryState>): string {
  const search = new URLSearchParams();
  if (state.q) search.set('q', state.q);
  for (const key of Object.keys(FILTER_PARAMS) as UrlFilterKey[]) {
    const value = state.filters?.[key];
    if (value) {
      search.set(
        FILTER_PARAMS[key],
        key === 'officeLevel' || key === 'participationStatus' ? enumToParam(value) : value,
      );
    }
  }
  if (state.page && state.page > 1) search.set('page', String(state.page));
  const text = search.toString();
  return text ? `${DIRECTORY_PATH}?${text}` : DIRECTORY_PATH;
}

export function toDirectoryQuery(state: DirectoryState): DirectoryQuery {
  return {
    query: state.q,
    filters: state.filters,
    sort: 'NAME_ASC',
    page: { limit: DIRECTORY_PAGE_SIZE, offset: (state.page - 1) * DIRECTORY_PAGE_SIZE },
  };
}

export function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));
}

/** True when the visitor narrowed the list by search text or any filter. */
export function isNarrowed(state: DirectoryState): boolean {
  return state.q.length > 0 || Object.keys(state.filters).length > 0;
}
