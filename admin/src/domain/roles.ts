import type { EditorialRole } from './enums';

const RANK: Readonly<Record<EditorialRole, number>> = { REVIEWER: 1, APPROVER: 2, ADMIN: 3 };

/** Highest of a user's role rows, or undefined when they have none. */
export function highestRole(roles: readonly EditorialRole[]): EditorialRole | undefined {
  return [...roles].sort((a, b) => RANK[b] - RANK[a])[0];
}

export function hasRole(role: EditorialRole | undefined, minimum: EditorialRole): boolean {
  return role !== undefined && RANK[role] >= RANK[minimum];
}

/**
 * What the UI offers. This only decides which controls to show: PostgreSQL RLS and
 * triggers are the security boundary and re-check every action.
 */
export type Capability =
  | 'edit-drafts'
  | 'review-corrections'
  | 'approve'
  | 'publish'
  | 'retract'
  | 'edit-published'
  | 'manage-roles';

const MINIMUM: Readonly<Record<Capability, EditorialRole>> = {
  'edit-drafts': 'REVIEWER',
  'review-corrections': 'REVIEWER',
  approve: 'APPROVER',
  publish: 'APPROVER',
  retract: 'APPROVER',
  'edit-published': 'APPROVER',
  'manage-roles': 'ADMIN',
};

export function can(role: EditorialRole | undefined, capability: Capability): boolean {
  return hasRole(role, MINIMUM[capability]);
}
