import type { Metadata } from 'next';
import { permanentRedirect, redirect } from 'next/navigation';
import { cache } from 'react';

import { EmptyState } from '@/components/ui';
import { effectiveSearchText } from '@/domain/directory';
import { ActiveFilters, DirectoryFilters } from '@/features/politicians/components/DirectoryFilters';
import { Pagination } from '@/features/politicians/components/Pagination';
import { PoliticianCard } from '@/features/politicians/components/PoliticianCard';
import {
  directoryHref,
  isNarrowed,
  parseDirectoryState,
  resolveDirectoryState,
  toDirectoryQuery,
  type RawSearchParams,
} from '@/features/politicians/directoryParams';
import { pageMetadata } from '@/lib/site';
import { getRepositories } from '@/server/repositories';

const loadFilterOptions = cache(() => getRepositories().people.getDirectoryFilterOptions());

/** The URL's state with elections, offices and organizations resolved from slugs (or legacy ids). */
async function resolveFromUrl(searchParams: Promise<RawSearchParams>) {
  return resolveDirectoryState(parseDirectoryState(await searchParams), await loadFilterOptions());
}

export async function generateMetadata({ searchParams }: PageProps<'/politicians'>): Promise<Metadata> {
  // The canonical URL always uses slugs, so a legacy id link and its readable form are one page.
  const { state } = await resolveFromUrl(searchParams);
  return pageMetadata({
    title: state.page > 1 ? `Politicians (page ${state.page})` : 'Politicians',
    description:
      'An alphabetical directory of political figures with documented public records. Search by name or filter by election, office, office level, participation status and political organization.',
    path: directoryHref(state),
    // Searches and filtered views are useful to share but are not separate documents to index.
    noIndex: isNarrowed(state),
  });
}

/**
 * The voter directory, rendered on the server from the URL: name search,
 * filters, and a paginated list that is always alphabetical. Never ranked.
 */
export default async function PoliticiansPage({ searchParams }: PageProps<'/politicians'>) {
  const resolved = await resolveFromUrl(searchParams);
  const { state } = resolved;
  // Links from before slugs (?election=<uuid>) move permanently to the readable URL.
  if (resolved.usedLegacyIds) permanentRedirect(directoryHref(state));

  const options = await loadFilterOptions();
  // A filter naming no public record cannot match anyone; it is not silently dropped.
  const page = resolved.unresolved
    ? { items: [], total: 0 }
    : await getRepositories().people.searchDirectory(toDirectoryQuery(state, resolved.filters));

  // A page number past the end (stale link, or the list shrank) goes back to the first page.
  if (page.items.length === 0 && state.page > 1) {
    redirect(directoryHref({ ...state, page: 1 }));
  }

  const narrowed = isNarrowed(state);
  const searched = effectiveSearchText(state.q);
  return (
    <>
      <h1 className="text-3xl font-bold sm:text-4xl">Politicians</h1>
      <div className="mt-6">
        <DirectoryFilters state={state} options={options} />
      </div>
      <ActiveFilters state={state} options={options} />

      <div className="mt-6" role="status">
        <p>
          <strong>
            {page.total} {page.total === 1 ? 'result' : 'results'}
          </strong>
          {searched ? <> for “{searched}”</> : null} · alphabetical by name
        </p>
        <p className="text-sm text-muted">Order does not imply ranking.</p>
      </div>

      {page.items.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {page.items.map((entry) => (
            <PoliticianCard key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : narrowed ? (
        <div className="mt-4">
          <EmptyState title="No politicians match this search">
            <p>
              Try a different name or fewer filters. Gabay ni Juan only covers the figures that have
              been added so far, so a missing name does not mean a person has no public record.
            </p>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState title="No records have been added yet">
            <p>Politicians will appear here once their records have been added and reviewed.</p>
          </EmptyState>
        </div>
      )}

      <Pagination state={state} total={page.total} />
    </>
  );
}
