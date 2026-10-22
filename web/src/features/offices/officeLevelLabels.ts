import { OFFICE_LEVELS, type OfficeLevel } from '@/domain/enums';

export const OFFICE_LEVEL_LABELS: Readonly<Record<OfficeLevel, string>> = {
  NATIONAL: 'National',
  PROVINCIAL: 'Provincial',
  CITY: 'City',
  MUNICIPAL: 'Municipal',
  DISTRICT: 'District',
  BARANGAY: 'Barangay',
};

/** Broadest to most local. */
export const OFFICE_LEVEL_ORDER: readonly OfficeLevel[] = OFFICE_LEVELS;
