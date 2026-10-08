import type { EditorialRole, PublicationStatus } from './enums';
import { hasRole } from './roles';

/**
 * Mirror of private.is_allowed_transition() in the database. The database is the
 * authority; this table only decides which buttons to offer. A test in CI compares it
 * with the SQL (scripts/check-enum-drift.mjs).
 */
export const TRANSITIONS: Readonly<Record<PublicationStatus, readonly PublicationStatus[]>> = {
  DRAFT: ['SOURCE_ATTACHED', 'REJECTED'],
  SOURCE_ATTACHED: ['REVIEWED', 'REJECTED'],
  REVIEWED: ['APPROVED', 'REJECTED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'REJECTED', 'DRAFT'],
  PUBLISHED: ['RETRACTED'],
  RETRACTED: [],
  REJECTED: ['DRAFT'],
};

const APPROVER_ONLY: ReadonlySet<PublicationStatus> = new Set(['APPROVED', 'PUBLISHED', 'RETRACTED']);

export function isAllowedTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Transitions the signed-in role may attempt from `from`. */
export function availableTransitions(from: PublicationStatus, role: EditorialRole | undefined): PublicationStatus[] {
  return TRANSITIONS[from].filter((to) => (APPROVER_ONLY.has(to) ? hasRole(role, 'APPROVER') : hasRole(role, 'REVIEWER')));
}

/** Changing or retracting a published record must carry a reason. */
export function reasonRequired(from: PublicationStatus, to?: PublicationStatus): boolean {
  return from === 'PUBLISHED' || from === 'RETRACTED' || to === 'RETRACTED';
}

/** Content is frozen while a record is under review, and final once retracted. */
export function isContentEditable(status: PublicationStatus, role: EditorialRole | undefined): boolean {
  if (status === 'REVIEWED' || status === 'APPROVED' || status === 'RETRACTED') return false;
  if (status === 'PUBLISHED') return hasRole(role, 'APPROVER');
  return hasRole(role, 'REVIEWER');
}

export const TRANSITION_LABELS: Readonly<Record<PublicationStatus, string>> = {
  DRAFT: 'Return to draft',
  SOURCE_ATTACHED: 'Mark sources attached',
  REVIEWED: 'Submit for approval',
  APPROVED: 'Approve',
  PUBLISHED: 'Publish',
  REJECTED: 'Reject',
  RETRACTED: 'Retract',
};
