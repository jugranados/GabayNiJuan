/**
 * Editorial data access. Every function takes the SIGNED-IN EDITOR'S Supabase client
 * (anon key + their session), so PostgreSQL decides what succeeds: Row Level Security,
 * the workflow triggers and the RPC guards. Nothing here uses a privileged key, and
 * nothing here is reachable from public pages.
 *
 * Reads are validated with Zod and mapped to the view models in domain/editorial/models.
 * Writes go through the database functions that enforce reasons, the state machine and
 * optimistic concurrency.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { CorrectionStatus, EditorialRole, PublicationStatus } from '@/domain/enums';
import type {
  ContestParticipationRecord,
  CorrectionRequest,
  EditorialRecord,
  EvidenceLink,
  QueueItem,
  RevisionEntry,
  RoleEvent,
  StaffMember,
} from '@/domain/editorial/models';
import type { Readiness } from '@/domain/editorial/readiness';
import type { EditorialRecordType, RecordTypeDef } from '@/domain/editorial/records';

import { toEditorialError } from './errors';
import {
  contestParticipationSchema,
  correctionSchema,
  electionOfficeEditorialSchema,
  evidenceRowSchema,
  queueRowSchema,
  readinessSchema,
  recordRowSchema,
  revisionSchema,
  roleEventSchema,
  staffSchema,
} from './schemas';

type Result<T> = { data: T | null; error: { message?: string; code?: string } | null };

function unwrap<T>(result: Result<T>): T {
  if (result.error) throw toEditorialError(result.error);
  return result.data as T;
}

const opt = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

// ---- Mappers -------------------------------------------------------------------------------

function toRecord(def: RecordTypeDef, raw: unknown): EditorialRecord {
  const row = recordRowSchema.parse(raw);
  const values: Record<string, string> = {};
  for (const field of def.fields) {
    const value = row[field.name];
    values[field.name] =
      typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  }
  return {
    id: row.id,
    status: row.publication_status,
    version: row.version,
    createdBy: opt(row.created_by),
    reviewedBy: opt(row.reviewed_by),
    approvedBy: opt(row.approved_by),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    values,
  };
}

function toQueueItem(raw: z.infer<typeof queueRowSchema>): QueueItem {
  return {
    recordType: raw.record_type,
    id: raw.id,
    label: raw.label ?? raw.id,
    personId: opt(raw.person_id),
    status: raw.publication_status,
    version: raw.version,
    createdBy: opt(raw.created_by),
    reviewedBy: opt(raw.reviewed_by),
    approvedBy: opt(raw.approved_by),
    updatedAt: raw.updated_at,
  };
}

function toCorrection(raw: unknown): CorrectionRequest {
  const row = correctionSchema.parse(raw);
  return {
    id: row.id,
    recordType: row.record_type,
    recordId: row.record_id,
    claimId: opt(row.claim_id),
    description: row.description,
    sourceUrl: opt(row.source_url),
    contactEmail: opt(row.contact_email),
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: opt(row.reviewed_at),
    reviewedBy: opt(row.reviewed_by),
    resolutionNote: opt(row.resolution_note),
    version: row.version,
  };
}

// ---- Queue ---------------------------------------------------------------------------------

export type QueueFilters = {
  status?: PublicationStatus;
  recordType?: EditorialRecordType;
  editorId?: string;
  /** ISO timestamp. */
  updatedSince?: string;
  personId?: string;
  /** One record, to read its queue label. */
  id?: string;
};

export async function fetchQueue(
  client: SupabaseClient,
  filters: QueueFilters = {},
  limit = 200,
): Promise<QueueItem[]> {
  let q = client
    .from('editorial_queue')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (filters.status) q = q.eq('publication_status', filters.status);
  if (filters.recordType) q = q.eq('record_type', filters.recordType);
  if (filters.editorId) q = q.eq('created_by', filters.editorId);
  if (filters.updatedSince) q = q.gte('updated_at', filters.updatedSince);
  if (filters.personId) q = q.eq('person_id', filters.personId);
  if (filters.id) q = q.eq('id', filters.id);
  return z.array(queueRowSchema).parse(unwrap(await q)).map(toQueueItem);
}

// ---- Records -------------------------------------------------------------------------------

export async function fetchRecord(
  client: SupabaseClient,
  def: RecordTypeDef,
  id: string,
): Promise<EditorialRecord | null> {
  const data = unwrap(await client.from(def.table).select('*').eq('id', id).maybeSingle());
  return data ? toRecord(def, data) : null;
}

/** `created_by` and the DRAFT status are set by database triggers; the caller cannot choose them. */
export async function createRecord(
  client: SupabaseClient,
  def: RecordTypeDef,
  values: Record<string, string | null>,
): Promise<EditorialRecord> {
  return toRecord(def, unwrap(await client.from(def.table).insert(values).select('*').single()));
}

export async function updateRecord(
  client: SupabaseClient,
  def: RecordTypeDef,
  args: { id: string; expectedVersion: number; changes: Record<string, string | null>; reason?: string },
): Promise<EditorialRecord> {
  const data = unwrap(
    await client.rpc('editorial_update', {
      p_table: def.table,
      p_id: args.id,
      p_expected_version: args.expectedVersion,
      p_changes: args.changes,
      p_reason: args.reason ?? null,
    }),
  );
  return toRecord(def, data);
}

export async function transitionRecord(
  client: SupabaseClient,
  def: RecordTypeDef,
  args: { id: string; to: PublicationStatus; expectedVersion: number; reason?: string },
): Promise<EditorialRecord> {
  const data = unwrap(
    await client.rpc('editorial_transition', {
      p_table: def.table,
      p_id: args.id,
      p_to: args.to,
      p_expected_version: args.expectedVersion,
      p_reason: args.reason ?? null,
    }),
  );
  return toRecord(def, data);
}

/**
 * Every participation record of one person for one election and office, in any workflow
 * state, for the succession check (domain/elections.ts).
 */
export async function fetchContestParticipations(
  client: SupabaseClient,
  args: { personId: string; electionId: string; officeId: string },
): Promise<ContestParticipationRecord[]> {
  const data = unwrap(
    await client
      .from('election_participations')
      .select('id, status, effective_from, publication_status')
      .eq('person_id', args.personId)
      .eq('election_id', args.electionId)
      .eq('office_id', args.officeId),
  );
  return z
    .array(contestParticipationSchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      status: row.status,
      effectiveFrom: row.effective_from,
      publicationStatus: row.publication_status,
    }));
}

/** Election offices of one election, for its editorial page. */
export async function fetchElectionOffices(
  client: SupabaseClient,
  electionId: string,
): Promise<{ id: string; officeId: string; sortOrder: number; status: PublicationStatus }[]> {
  const data = unwrap(
    await client
      .from('election_offices')
      .select('id, office_id, sort_order, publication_status')
      .eq('election_id', electionId)
      .order('sort_order'),
  );
  return z
    .array(electionOfficeEditorialSchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      officeId: row.office_id,
      sortOrder: row.sort_order,
      status: row.publication_status,
    }));
}

// ---- Evidence ------------------------------------------------------------------------------

export async function fetchEvidence(client: SupabaseClient, claimId: string): Promise<EvidenceLink[]> {
  const data = unwrap(
    await client
      .from('claim_evidence')
      .select(
        'claim_id, source_id, supports, note, sources(title, publisher, source_type, url, publication_status)',
      )
      .eq('claim_id', claimId),
  );
  return z
    .array(evidenceRowSchema)
    .parse(data)
    .map((row) => ({
      claimId: row.claim_id,
      sourceId: row.source_id,
      supports: row.supports,
      note: opt(row.note),
      source: {
        title: row.sources.title,
        publisher: row.sources.publisher,
        sourceType: row.sources.source_type,
        url: opt(row.sources.url),
        status: row.sources.publication_status,
      },
    }));
}

export async function setEvidence(
  client: SupabaseClient,
  args: { claimId: string; sourceId: string; supports: boolean; note?: string; reason?: string },
): Promise<void> {
  unwrap(
    await client.rpc('editorial_set_evidence', {
      p_claim_id: args.claimId,
      p_source_id: args.sourceId,
      p_supports: args.supports,
      p_note: args.note ?? null,
      p_reason: args.reason ?? null,
    }),
  );
}

export async function removeEvidence(
  client: SupabaseClient,
  args: { claimId: string; sourceId: string; reason?: string },
): Promise<void> {
  unwrap(
    await client.rpc('editorial_remove_evidence', {
      p_claim_id: args.claimId,
      p_source_id: args.sourceId,
      p_reason: args.reason ?? null,
    }),
  );
}

/** The database's own verdict: the same function the publish trigger uses. */
export async function fetchReadiness(client: SupabaseClient, claimId: string): Promise<Readiness> {
  return readinessSchema.parse(unwrap(await client.rpc('claim_readiness', { p_claim_id: claimId })));
}

// ---- Revisions -----------------------------------------------------------------------------

export async function fetchRevisions(
  client: SupabaseClient,
  args: { entityType?: string; entityId?: string; limit?: number } = {},
): Promise<RevisionEntry[]> {
  let q = client
    .from('revisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 100);
  if (args.entityType) q = q.eq('entity_type', args.entityType);
  if (args.entityId) q = q.eq('entity_id', args.entityId);
  return z
    .array(revisionSchema)
    .parse(unwrap(await q))
    .map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      oldValue: row.old_value ?? null,
      newValue: row.new_value ?? null,
      editorId: row.editor_id,
      approverId: opt(row.approver_id),
      reason: row.reason,
      createdAt: row.created_at,
      approvalState: row.approval_state,
    }));
}

// ---- Corrections ---------------------------------------------------------------------------

export async function fetchCorrections(
  client: SupabaseClient,
  status?: CorrectionStatus,
): Promise<CorrectionRequest[]> {
  let q = client
    .from('correction_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) q = q.eq('status', status);
  return (unwrap(await q) as unknown[]).map(toCorrection);
}

export async function fetchCorrection(
  client: SupabaseClient,
  id: string,
): Promise<CorrectionRequest | null> {
  const data = unwrap(await client.from('correction_requests').select('*').eq('id', id).maybeSingle());
  return data ? toCorrection(data) : null;
}

/** Requests about a record, or about a claim (as the record or as the related claim). */
export async function fetchCorrectionsFor(
  client: SupabaseClient,
  recordId: string,
): Promise<CorrectionRequest[]> {
  const q = client
    .from('correction_requests')
    .select('*')
    .or(`record_id.eq.${recordId},claim_id.eq.${recordId}`)
    .order('created_at', { ascending: false });
  return (unwrap(await q) as unknown[]).map(toCorrection);
}

export async function reviewCorrection(
  client: SupabaseClient,
  args: { id: string; status: CorrectionStatus; expectedVersion: number; note?: string },
): Promise<CorrectionRequest> {
  return toCorrection(
    unwrap(
      await client.rpc('review_correction', {
        p_id: args.id,
        p_status: args.status,
        p_expected_version: args.expectedVersion,
        p_note: args.note ?? null,
      }),
    ),
  );
}

// ---- Staff ---------------------------------------------------------------------------------

export async function fetchStaff(client: SupabaseClient): Promise<StaffMember[]> {
  return z
    .array(staffSchema)
    .parse(unwrap(await client.rpc('staff_directory')))
    .map((row) => ({ userId: row.user_id, email: row.email, role: opt(row.role) }));
}

export async function setStaffRole(
  client: SupabaseClient,
  email: string,
  role: EditorialRole | null,
): Promise<void> {
  unwrap(await client.rpc('set_staff_role', { p_email: email, p_role: role }));
}

export async function fetchRoleEvents(client: SupabaseClient): Promise<RoleEvent[]> {
  const q = client
    .from('editorial_role_events')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(50);
  return z
    .array(roleEventSchema)
    .parse(unwrap(await q))
    .map((row) => ({
      id: row.id,
      targetEmail: row.target_email,
      oldRole: opt(row.old_role),
      newRole: opt(row.new_role),
      changedBy: opt(row.changed_by),
      changedAt: row.changed_at,
    }));
}

