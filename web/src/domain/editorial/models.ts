/**
 * View models for the editorial area. They are produced by src/data/editorial (Zod-validated,
 * then mapped) and are what /admin pages and components consume.
 */
import type {
  CorrectionStatus,
  EditorialRole,
  ElectionParticipationStatus,
  PublicationStatus,
} from '@/domain/enums';

import type { EditorialRecordType } from './records';

/** A stored record as the editor sees it. `values` is keyed by the field names in records.ts. */
export type EditorialRecord = {
  id: string;
  status: PublicationStatus;
  /** Optimistic-concurrency counter; sent back with every change. */
  version: number;
  createdBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  values: Readonly<Record<string, string>>;
};

/** One row of the work queue (`editorial_queue` view). */
export type QueueItem = {
  recordType: string;
  id: string;
  label: string;
  personId?: string;
  status: PublicationStatus;
  version: number;
  createdBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
  updatedAt: string;
};

export type RefOption = { id: string; label: string };

export type EvidenceLink = {
  claimId: string;
  sourceId: string;
  supports: boolean;
  note?: string;
  source: {
    title: string;
    publisher: string;
    sourceType: string;
    url?: string;
    status: PublicationStatus;
  };
};

export type RevisionEntry = {
  id: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  editorId: string;
  approverId?: string;
  reason: string;
  createdAt: string;
  approvalState: PublicationStatus;
};

export type CorrectionRequest = {
  id: string;
  recordType: string;
  recordId: string;
  claimId?: string;
  description: string;
  /** Submitted by an anonymous visitor: untrusted. */
  sourceUrl?: string;
  contactEmail?: string;
  status: CorrectionStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  resolutionNote?: string;
  version: number;
};

export type StaffMember = { userId: string; email: string; role?: EditorialRole };

export type RoleEvent = {
  id: string;
  targetEmail: string;
  oldRole?: EditorialRole;
  newRole?: EditorialRole;
  changedBy?: string;
  changedAt: string;
};

export type RecordTypeCount = { recordType: EditorialRecordType; count: number };

/** One participation record as the succession check needs it (any workflow state). */
export type ContestParticipationRecord = {
  id: string;
  status: ElectionParticipationStatus;
  effectiveFrom: string;
  publicationStatus: PublicationStatus;
};
