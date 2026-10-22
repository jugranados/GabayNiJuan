/**
 * Zod contract for the directory page returned by the `search_directory`
 * database function (and mimicked by the in-memory source). Same rules as
 * rows.ts: no coercion, unknown enum values are rejected.
 */
import { z } from 'zod';

import { AFFILIATION_TYPES, ELECTION_PARTICIPATION_STATUSES } from '@/domain/enums';
import { idSchema, isoDateSchema, nonEmptyTextSchema } from '@/domain/validation/primitives';

const optionalText = nonEmptyTextSchema.nullish();

export const directoryParticipationSchema = z.object({
  office_name: nonEmptyTextSchema,
  election_name: nonEmptyTextSchema,
  election_date: isoDateSchema,
  status: z.enum(ELECTION_PARTICIPATION_STATUSES),
  effective_from: isoDateSchema,
});

export const directoryAffiliationSchema = z.object({
  organization_name: nonEmptyTextSchema,
  affiliation_type: z.enum(AFFILIATION_TYPES),
  start_date: isoDateSchema,
});

export const directoryItemSchema = z.object({
  id: idSchema,
  first_name: nonEmptyTextSchema,
  middle_name: optionalText,
  last_name: nonEmptyTextSchema,
  suffix: optionalText,
  preferred_name: optionalText,
  photo_asset_id: optionalText,
  participations: z.array(directoryParticipationSchema),
  affiliation: directoryAffiliationSchema.nullish(),
});

export const directoryPageRowSchema = z.object({
  total: z.number().int().nonnegative(),
  items: z.array(directoryItemSchema),
});

export type DirectoryItemRow = z.infer<typeof directoryItemSchema>;
export type DirectoryPageRow = z.infer<typeof directoryPageRowSchema>;
