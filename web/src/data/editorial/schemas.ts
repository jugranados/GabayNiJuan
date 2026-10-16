/**
 * Zod contracts for what the editorial tables, the `editorial_queue` view and the editorial
 * RPCs return to a signed-in staff member. Same rules as data/schemas/rows.ts: no coercion,
 * unknown enum values are rejected.
 */
import { z } from 'zod';

import {
  CORRECTION_STATUSES,
  ELECTION_PARTICIPATION_STATUSES,
  EDITORIAL_ROLES,
  PUBLICATION_STATUSES,
  VERIFICATION_STATUSES,
} from '@/domain/enums';

const uuid = z.uuid();
const nullableUuid = uuid.nullable();

export const recordRowSchema = z.looseObject({
  id: uuid,
  publication_status: z.enum(PUBLICATION_STATUSES),
  version: z.number().int(),
  created_by: nullableUuid,
  reviewed_by: nullableUuid,
  approved_by: nullableUuid,
  created_at: z.string(),
  updated_at: z.string(),
});

export const queueRowSchema = z.object({
  record_type: z.string(),
  table_name: z.string(),
  id: uuid,
  label: z.string().nullable(),
  person_id: nullableUuid,
  publication_status: z.enum(PUBLICATION_STATUSES),
  version: z.number().int(),
  created_by: nullableUuid,
  reviewed_by: nullableUuid,
  approved_by: nullableUuid,
  updated_at: z.string(),
});

export const evidenceRowSchema = z.object({
  claim_id: uuid,
  source_id: uuid,
  supports: z.boolean(),
  note: z.string().nullable(),
  sources: z.object({
    title: z.string(),
    publisher: z.string(),
    source_type: z.string(),
    url: z.string().nullable(),
    publication_status: z.enum(PUBLICATION_STATUSES),
  }),
});

export const readinessSchema = z.object({
  verification_status: z.enum(VERIFICATION_STATUSES),
  total: z.number(),
  supporting: z.number(),
  contradicting: z.number(),
  tier1_supporting: z.number(),
  distinct_publishers: z.number(),
  unpublished_sources: z.number(),
  error: z.string().nullable(),
});

export const revisionSchema = z.object({
  id: uuid,
  entity_type: z.string(),
  entity_id: z.string(),
  old_value: z.unknown().nullable(),
  new_value: z.unknown().nullable(),
  editor_id: z.string(),
  approver_id: z.string().nullable(),
  reason: z.string(),
  created_at: z.string(),
  approval_state: z.enum(PUBLICATION_STATUSES),
});

export const correctionSchema = z.object({
  id: uuid,
  record_type: z.string(),
  record_id: uuid,
  claim_id: nullableUuid,
  description: z.string(),
  source_url: z.string().nullable(),
  contact_email: z.string().nullable(),
  status: z.enum(CORRECTION_STATUSES),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
  reviewed_by: nullableUuid,
  resolution_note: z.string().nullable(),
  version: z.number().int(),
});

export const staffSchema = z.object({
  user_id: uuid,
  email: z.string(),
  role: z.enum(EDITORIAL_ROLES).nullable(),
});

export const roleEventSchema = z.object({
  id: uuid,
  target_email: z.string(),
  old_role: z.enum(EDITORIAL_ROLES).nullable(),
  new_role: z.enum(EDITORIAL_ROLES).nullable(),
  changed_by: nullableUuid,
  changed_at: z.string(),
});

export const contestParticipationSchema = z.object({
  id: uuid,
  status: z.enum(ELECTION_PARTICIPATION_STATUSES),
  effective_from: z.string(),
  publication_status: z.enum(PUBLICATION_STATUSES),
});

export const electionOfficeEditorialSchema = z.object({
  id: uuid,
  office_id: uuid,
  sort_order: z.number().int(),
  publication_status: z.enum(PUBLICATION_STATUSES),
});
