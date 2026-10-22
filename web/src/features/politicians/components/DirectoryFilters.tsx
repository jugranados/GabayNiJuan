import Link from 'next/link';

import { isSearchTooShort, MIN_SEARCH_LENGTH } from '@/domain/directory';
import type { DirectoryFilterOptions } from '@/domain/models/directory';
import {
  DIRECTORY_PATH,
  directoryHref,
  enumToParam,
  FILTER_PARAMS,
  isNarrowed,
  type DirectoryState,
} from '@/features/politicians/directoryParams';
import {
  activeUiFilters,
  choicesFor,
  describeFilterValue,
  FILTER_DEFINITIONS,
} from '@/features/politicians/filterConfig';

const isEnumFilter = (key: string) => key === 'officeLevel' || key === 'participationStatus';

/**
 * Search and filters as a plain GET form: it works without JavaScript, the
 * state lives in the URL, and submitting always returns to page 1. Only
 * documented, structured fields are offered; nothing here ranks or judges.
 */
export function DirectoryFilters({
  state,
  options,
}: {
  state: DirectoryState;
  options: DirectoryFilterOptions;
}) {
  return (
    <form method="get" action={DIRECTORY_PATH} role="search" aria-label="Search and filter politicians">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="directory-q" className="mb-1 block font-semibold">
            Search by name
          </label>
          <input
            id="directory-q"
            name="q"
            type="search"
            defaultValue={state.q}
            maxLength={100}
            autoComplete="off"
            aria-describedby="directory-q-hint"
            className="field"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </div>
      <p id="directory-q-hint" className="mt-1 text-sm text-muted">
        {isSearchTooShort(state.q)
          ? `Type at least ${MIN_SEARCH_LENGTH} characters to search by name. Showing results without the name search.`
          : 'Searches names only. Every word you type must appear in the name.'}
      </p>

      <fieldset className="mt-4">
        <legend className="font-semibold">Filters</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FILTER_DEFINITIONS.map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={`filter-${key}`} className="mb-1 block text-sm">
                {label}
              </label>
              <select
                id={`filter-${key}`}
                name={FILTER_PARAMS[key]}
                defaultValue={
                  state.filters[key] ? (isEnumFilter(key) ? enumToParam(state.filters[key]) : state.filters[key]) : ''
                }
                className="field"
              >
                <option value="">Any</option>
                {choicesFor(key, options).map((choice) => (
                  <option
                    key={choice.value}
                    value={isEnumFilter(key) ? enumToParam(choice.value) : choice.value}
                  >
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn">
            Apply filters
          </button>
          {isNarrowed(state) ? (
            <Link href={DIRECTORY_PATH} className="link inline-flex min-h-11 items-center">
              Clear search and filters
            </Link>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}

/** The filters in effect, each with a link that removes just that one. */
export function ActiveFilters({
  state,
  options,
}: {
  state: DirectoryState;
  options: DirectoryFilterOptions;
}) {
  const active = activeUiFilters(state.filters);
  if (active.length === 0) return null;
  return (
    <ul aria-label="Active filters" className="mt-4 flex flex-wrap gap-2">
      {active.map(({ definition, value }) => {
        const text = `${definition.label}: ${describeFilterValue(definition.key, value, options)}`;
        return (
          <li key={definition.key}>
            <Link
              href={directoryHref({
                q: state.q,
                filters: { ...state.filters, [definition.key]: undefined },
              })}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm"
            >
              {text}
              <span aria-hidden="true">×</span>
              <span className="sr-only">(remove this filter)</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
