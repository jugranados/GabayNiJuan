/**
 * The directory's filter model. Screens iterate FILTER_DEFINITIONS instead of
 * hard-coding filters, so adding a structured, documented field means adding
 * one entry here (and a column in the query), nothing in the screens.
 *
 * Prohibited, by product rule: filters that rank or judge people ("best",
 * "most trusted", "clean record", "most experienced", "most popular").
 * jurisdictionId is supported by the query but has no definition here until
 * jurisdictions have human-readable names.
 */
import { OFFICE_LEVELS } from '@/domain/enums';
import type { DirectoryFilterOptions } from '@/domain/models/directory';
import type { DirectoryUrlFilters, UrlFilterKey } from '@/features/politicians/directoryParams';
import {
  PARTICIPATION_STATUS_INFO,
  PARTICIPATION_STATUS_ORDER,
} from '@/features/elections/participationLabels';
import { OFFICE_LEVEL_LABELS } from '@/features/offices/officeLevelLabels';

/** Filters the UI shows, in URL vocabulary: elections, offices and organizations by slug. */
export type UiFilterKey = UrlFilterKey;

export type FilterDefinition = {
  key: UiFilterKey;
  label: string;
};

export type FilterChoice = { value: string; label: string };

export const FILTER_DEFINITIONS: readonly FilterDefinition[] = [
  { key: 'election', label: 'Election' },
  { key: 'officeLevel', label: 'Office level' },
  { key: 'office', label: 'Office' },
  { key: 'participationStatus', label: 'Participation status' },
  { key: 'organization', label: 'Political organization' },
];

export function choicesFor(key: UiFilterKey, options: DirectoryFilterOptions): FilterChoice[] {
  switch (key) {
    case 'election':
      return options.elections.map((e) => ({ value: e.slug, label: e.name }));
    case 'officeLevel':
      return OFFICE_LEVELS.map((level) => ({ value: level, label: OFFICE_LEVEL_LABELS[level] }));
    case 'office':
      return options.offices.map((o) => ({ value: o.slug, label: o.name }));
    case 'participationStatus':
      return PARTICIPATION_STATUS_ORDER.map((status) => ({
        value: status,
        label: PARTICIPATION_STATUS_INFO[status].label,
      }));
    case 'organization':
      return options.organizations.map((o) => ({ value: o.slug, label: o.name }));
  }
}

/** Display text for an active filter value (falls back while options are still loading). */
export function describeFilterValue(
  key: UiFilterKey,
  value: string,
  options: DirectoryFilterOptions | undefined,
): string {
  if (key === 'officeLevel')
    return OFFICE_LEVEL_LABELS[value as keyof typeof OFFICE_LEVEL_LABELS] ?? value;
  if (key === 'participationStatus') {
    return (
      PARTICIPATION_STATUS_INFO[value as keyof typeof PARTICIPATION_STATUS_INFO]?.label ?? value
    );
  }
  if (!options) return 'Selected';
  // A reference that matches no public record (a stale or mistyped link) is said to be not found.
  return choicesFor(key, options).find((choice) => choice.value === value)?.label ?? 'Not found';
}

/** Filters currently set that the UI knows how to show and clear. */
export function activeUiFilters(
  filters: DirectoryUrlFilters,
): { definition: FilterDefinition; value: string }[] {
  return FILTER_DEFINITIONS.flatMap((definition) => {
    const value = filters[definition.key];
    return value ? [{ definition, value }] : [];
  });
}
