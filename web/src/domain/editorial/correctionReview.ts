import type { CorrectionStatus } from '@/domain/enums';

/**
 * Mirror of the lifecycle enforced by the database function review_correction(). Decides
 * which buttons to offer; the database decides whether a move succeeds.
 */
export const CORRECTION_TRANSITIONS: Readonly<Record<CorrectionStatus, readonly CorrectionStatus[]>> = {
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['RESOLVED'],
  REJECTED: [],
  RESOLVED: [],
};

/** Starting a review needs no explanation; every decision does. */
export function correctionNoteRequired(to: CorrectionStatus): boolean {
  return to !== 'UNDER_REVIEW';
}

export const CORRECTION_ACTION_LABELS: Readonly<Record<CorrectionStatus, string>> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Start review',
  ACCEPTED: 'Accept',
  REJECTED: 'Reject',
  RESOLVED: 'Mark resolved',
};
