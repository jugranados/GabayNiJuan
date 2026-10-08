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
import type {
  DirectoryFilterKey,
  DirectoryFilterOptions,
  DirectoryFilters,
} from '@/domain/models/directory';
import {
  PARTICIPATION_STATUS_INFO,
  PARTICIPATION_STATUS_ORDER,
} from '@/features/elections/participationLabels';
import { OFFICE_LEVEL_LABELS } from '@/features/offices/officeLevelLabels';

export type UiFilterKey = Exclude<DirectoryFilterKey, 'jurisdictionId'>;

export type FilterDefinition = {
  key: UiFilterKey;
  label: string;
};

export type FilterChoice = { value: string; label: string };

export const FILTER_DEFINITIONS: readonly FilterDefinition[] = [
  { key: 'electionId', label: 'Election' },
  { key: 'officeLevel', label: 'Office level' },
  { key: 'officeId', label: 'Office' },
  { key: 'participationStatus', label: 'Participation status' },
  { key: 'organizationId', label: 'Political organization' },
];

export function choicesFor(key: UiFilterKey, options: DirectoryFilterOptions): FilterChoice[] {
  switch (key) {
    case 'electionId':
      return options.elections.map((e) => ({ value: e.id, label: e.name }));
    case 'officeLevel':
      return OFFICE_LEVELS.map((level) => ({ value: level, label: OFFICE_LEVEL_LABELS[level] }));
    case 'officeId':
      return options.offices.map((o) => ({ value: o.id, label: o.name }));
    case 'participationStatus':
      return PARTICIPATION_STATUS_ORDER.map((status) => ({
        value: status,
        label: PARTICIPATION_STATUS_INFO[status].label,
      }));
    case 'organizationId':
      return options.organizations.map((o) => ({ value: o.id, label: o.name }));
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
  return choicesFor(key, options).find((choice) => choice.value === value)?.label ?? 'Selected';
}

/** Filters currently set that the UI knows how to show and clear. */
export function activeUiFilters(
  filters: DirectoryFilters,
): { definition: FilterDefinition; value: string }[] {
  return FILTER_DEFINITIONS.flatMap((definition) => {
    const value = filters[definition.key];
    return value ? [{ definition, value }] : [];
  });
}
