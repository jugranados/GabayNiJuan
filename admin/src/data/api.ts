import { z } from 'zod';

import type { CorrectionStatus, EditorialRole, PublicationStatus } from '@/domain/enums';
import type { Readiness } from '@/domain/readiness';
import { getSupabase } from '@/lib/supabase';
import { toEditorialError } from '@/lib/errors';

import {
  correctionSchema,
  evidenceRowSchema,
  queueRowSchema,
  readinessSchema,
  recordRowSchema,
  revisionSchema,
  roleEventSchema,
  staffSchema,
  type CorrectionRequest,
  type EvidenceRow,
  type QueueRow,
  type RecordRow,
  type Revision,
  type RoleEvent,
  type StaffMember,
} from './schemas';

type Result<T> = { data: T | null; error: { message?: string; code?: string } | null };

function unwrap<T>(result: Result<T>): T {
  if (result.error) throw toEditorialError(result.error);
  return result.data as T;
}

// ---- Session -----------------------------------------------------------------------------

export async function fetchMyRoles(userId: string): Promise<EditorialRole[]> {
  const rows = unwrap(await getSupabase().from('editorial_roles').select('role').eq('user_id', userId));
  return z.array(z.object({ role: z.enum(['REVIEWER', 'APPROVER', 'ADMIN']) })).parse(rows).map((r) => r.role);
}

// ---- Queue ---------------------------------------------------------------------------------

export type QueueFilters = {
  status?: PublicationStatus;
  recordType?: string;
  editorId?: string;
  updatedSince?: string;
  /** Records waiting for a second person: REVIEWED rows not created/reviewed by `excludeUserId`. */
  awaitingApprovalFor?: string;
  personId?: string;
};

export async function fetchQueue(filters: QueueFilters = {}, limit = 200): Promise<QueueRow[]> {
  let q = getSupabase().from('editorial_queue').select('*').order('updated_at', { ascending: false }).limit(limit);
  if (filters.status) q = q.eq('publication_status', filters.status);
  if (filters.recordType) q = q.eq('record_type', filters.recordType);
  if (filters.editorId) q = q.eq('created_by', filters.editorId);
  if (filters.updatedSince) q = q.gte('updated_at', filters.updatedSince);
  if (filters.personId) q = q.eq('person_id', filters.personId);
  if (filters.awaitingApprovalFor) {
    q = q.eq('publication_status', 'REVIEWED').neq('created_by', filters.awaitingApprovalFor).neq('reviewed_by', filters.awaitingApprovalFor);
  }
  return z.array(queueRowSchema).parse(unwrap(await q));
}

// ---- Records -------------------------------------------------------------------------------

export async function fetchRecord(table: string, id: string): Promise<RecordRow | null> {
  const data = unwrap(await getSupabase().from(table).select('*').eq('id', id).maybeSingle());
  return data ? recordRowSchema.parse(data) : null;
}

export async function createRecord(table: string, values: Record<string, unknown>): Promise<RecordRow> {
  // created_by and the DRAFT status are set by database triggers; the client cannot choose them.
  const data = unwrap(await getSupabase().from(table).insert(values).select('*').single());
  return recordRowSchema.parse(data);
}

export async function updateRecord(
  table: string,
  id: string,
  expectedVersion: number,
  changes: Record<string, unknown>,
  reason?: string,
): Promise<RecordRow> {
  const data = unwrap(
    await getSupabase().rpc('editorial_update', {
      p_table: table,
      p_id: id,
      p_expected_version: expectedVersion,
      p_changes: changes,
      p_reason: reason ?? null,
    }),
  );
  return recordRowSchema.parse(data);
}

export async function transitionRecord(
  table: string,
  id: string,
  to: PublicationStatus,
  expectedVersion: number,
  reason?: string,
): Promise<RecordRow> {
  const data = unwrap(
    await getSupabase().rpc('editorial_transition', {
      p_table: table,
      p_id: id,
      p_to: to,
      p_expected_version: expectedVersion,
      p_reason: reason ?? null,
    }),
  );
  return recordRowSchema.parse(data);
}

// ---- Evidence ------------------------------------------------------------------------------

export async function fetchEvidence(claimId: string): Promise<EvidenceRow[]> {
  const data = unwrap(
    await getSupabase()
      .from('claim_evidence')
      .select('claim_id, source_id, supports, note, sources(title, publisher, source_type, url, publication_status)')
      .eq('claim_id', claimId),
  );
  return z.array(evidenceRowSchema).parse(data);
}

export async function setEvidence(args: {
  claimId: string;
  sourceId: string;
  supports: boolean;
  note?: string;
  reason?: string;
}): Promise<void> {
  unwrap(
    await getSupabase().rpc('editorial_set_evidence', {
      p_claim_id: args.claimId,
      p_source_id: args.sourceId,
      p_supports: args.supports,
      p_note: args.note ?? null,
      p_reason: args.reason ?? null,
    }),
  );
}

export async function removeEvidence(claimId: string, sourceId: string, reason?: string): Promise<void> {
  unwrap(
    await getSupabase().rpc('editorial_remove_evidence', {
      p_claim_id: claimId,
      p_source_id: sourceId,
      p_reason: reason ?? null,
    }),
  );
}

export async function fetchReadiness(claimId: string): Promise<Readiness> {
  return readinessSchema.parse(unwrap(await getSupabase().rpc('claim_readiness', { p_claim_id: claimId })));
}

// ---- Revisions -----------------------------------------------------------------------------

export async function fetchRevisions(args: { entityType?: string; entityId?: string; limit?: number } = {}): Promise<Revision[]> {
  let q = getSupabase().from('revisions').select('*').order('created_at', { ascending: false }).limit(args.limit ?? 100);
  if (args.entityType) q = q.eq('entity_type', args.entityType);
  if (args.entityId) q = q.eq('entity_id', args.entityId);
  return z.array(revisionSchema).parse(unwrap(await q));
}

// ---- Corrections ---------------------------------------------------------------------------

export async function fetchCorrections(status?: CorrectionStatus): Promise<CorrectionRequest[]> {
  let q = getSupabase().from('correction_requests').select('*').order('created_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  return z.array(correctionSchema).parse(unwrap(await q));
}

export async function fetchCorrectionsFor(recordId: string): Promise<CorrectionRequest[]> {
  const q = getSupabase().from('correction_requests').select('*').or(`record_id.eq.${recordId},claim_id.eq.${recordId}`).order('created_at', { ascending: false });
  return z.array(correctionSchema).parse(unwrap(await q));
}

export async function reviewCorrection(id: string, status: CorrectionStatus, expectedVersion: number, note?: string): Promise<CorrectionRequest> {
  const data = unwrap(
    await getSupabase().rpc('review_correction', { p_id: id, p_status: status, p_expected_version: expectedVersion, p_note: note ?? null }),
  );
  return correctionSchema.parse(data);
}

// ---- Staff ---------------------------------------------------------------------------------

export async function fetchStaff(): Promise<StaffMember[]> {
  return z.array(staffSchema).parse(unwrap(await getSupabase().rpc('staff_directory')));
}

export async function setStaffRole(email: string, role: EditorialRole | null): Promise<void> {
  unwrap(await getSupabase().rpc('set_staff_role', { p_email: email, p_role: role }));
}

export async function fetchRoleEvents(): Promise<RoleEvent[]> {
  const q = getSupabase().from('editorial_role_events').select('*').order('changed_at', { ascending: false }).limit(50);
  return z.array(roleEventSchema).parse(unwrap(await q));
}
