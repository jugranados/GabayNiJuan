/**
 * The public directory keeps all of its state in the URL, so a search or a
 * filtered view can be shared, bookmarked, crawled and rendered on the server:
 *
 *   /politicians?q=juan&election=<election slug>&office=<office slug>&level=national&status=filed-coc&page=2
 *
 * Elections, offices and organizations are named by their public slug. The server resolves a
 * slug to the record's id before querying; ids never need to appear in a URL. Links made
 * before slugs existed used ids (`?election=<uuid>`): they still resolve, and the page
 * redirects them permanently to the readable URL (see resolveDirectoryState).
 *
 * There is deliberately no `sort` parameter: the order is always alphabetical.
 */
import { ELECTION_PARTICIPATION_STATUSES, OFFICE_LEVELS } from '@/domain/enums';
import type { ElectionParticipationStatus, OfficeLevel } from '@/domain/enums';
import { cleanSearchText, compactFilters, DEFAULT_PAGE_SIZE } from '@/domain/directory';
import type {
  DirectoryFilterOptions,
  DirectoryFilters,
  DirectoryQuery,
} from '@/domain/models/directory';

export const DIRECTORY_PATH = '/politicians';
export const DIRECTORY_PAGE_SIZE = DEFAULT_PAGE_SIZE;
const MAX_PAGE = 10_000;
const MAX_QUERY_LENGTH = 100;

/**
 * Filters as they appear in a URL. `election`, `office` and `organization` hold a public slug
 * (or, in a legacy link, an id); `officeLevel` and `participationStatus` hold the exact enum value.
 */
export type DirectoryUrlFilters = {
  election?: string;
  office?: string;
  organization?: string;
  officeLevel?: OfficeLevel;
  participationStatus?: ElectionParticipationStatus;
};
export type UrlFilterKey = keyof DirectoryUrlFilters;

/** URL parameter name for each filter the directory UI exposes, in canonical order. */
export const FILTER_PARAMS = {
  election: 'election',
  officeLevel: 'level',
  office: 'office',
  participationStatus: 'status',
  organization: 'organization',
} as const satisfies Record<UrlFilterKey, string>;

export type DirectoryState = {
  /** Search text as typed (trimmed). May be too short to apply. */
  q: string;
  filters: DirectoryUrlFilters;
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

/** A slug or a legacy id. Anything else is dropped before it reaches a lookup. */
function paramToReference(value: string | undefined): string | undefined {
  return value && /^[A-Za-z0-9-]{1,120}$/.test(value) ? value : undefined;
}

function compactUrlFilters(filters: DirectoryUrlFilters): DirectoryUrlFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as DirectoryUrlFilters;
}

export function parseDirectoryState(params: RawSearchParams): DirectoryState {
  const pageNumber = Number(first(params.page));
  return {
    q: cleanSearchText(first(params.q)).slice(0, MAX_QUERY_LENGTH),
    filters: compactUrlFilters({
      election: paramToReference(first(params[FILTER_PARAMS.election])),
      office: paramToReference(first(params[FILTER_PARAMS.office])),
      organization: paramToReference(first(params[FILTER_PARAMS.organization])),
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

export type ResolvedDirectoryState = {
  /** The same view with every reference written as its slug: the canonical state. */
  state: DirectoryState;
  /** Ids for the query. */
  filters: DirectoryFilters;
  /** A reference was given as an id (a link from before slugs). Redirect to `state`. */
  usedLegacyIds: boolean;
  /** A reference matches no public record. Nothing can match, so the result is empty. */
  unresolved: boolean;
};

/**
 * Turns URL references into ids using the public filter options. A slug is matched first;
 * an id is still accepted so old links keep working, and is reported so the page can
 * redirect to the readable URL. An unknown reference is kept (and shown as not found) rather
 * than dropped, so a stale link never silently widens to an unfiltered list.
 */
export function resolveDirectoryState(
  state: DirectoryState,
  options: DirectoryFilterOptions,
): ResolvedDirectoryState {
  let usedLegacyIds = false;
  let unresolved = false;
  const resolve = (
    reference: string | undefined,
    records: readonly { id: string; slug: string }[],
  ): { id?: string; slug?: string } => {
    if (!reference) return {};
    const bySlug = records.find((record) => record.slug === reference);
    if (bySlug) return bySlug;
    const byId = records.find((record) => record.id.toLowerCase() === reference.toLowerCase());
    if (byId) {
      usedLegacyIds = true;
      return byId;
    }
    unresolved = true;
    return { slug: reference };
  };

  const election = resolve(state.filters.election, options.elections);
  const office = resolve(state.filters.office, options.offices);
  const organization = resolve(state.filters.organization, options.organizations);
  return {
    state: {
      ...state,
      filters: compactUrlFilters({
        ...state.filters,
        election: election.slug,
        office: office.slug,
        organization: organization.slug,
      }),
    },
    filters: compactFilters({
      electionId: election.id,
      officeId: office.id,
      organizationId: organization.id,
      officeLevel: state.filters.officeLevel,
      participationStatus: state.filters.participationStatus,
    }),
    usedLegacyIds,
    unresolved,
  };
}

export function toDirectoryQuery(state: DirectoryState, filters: DirectoryFilters): DirectoryQuery {
  return {
    query: state.q,
    filters,
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
