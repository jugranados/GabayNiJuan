import type { EditorialRole } from '@/domain/enums';
import { highestRole } from '@/domain/editorial/roles';

/**
 * Who may see the editorial area. This decides what the pages render and which server
 * actions run; it is NOT the security boundary. PostgreSQL (Row Level Security, triggers,
 * RPC checks) re-checks every read and write with the signed-in user's own token.
 */
export type AdminAccess =
  | { state: 'not-configured' }
  | { state: 'signed-out' }
  | { state: 'no-role'; userId: string; email?: string }
  | { state: 'authorized'; userId: string; email?: string; role: EditorialRole };

export function resolveAdminAccess(input: {
  configured: boolean;
  user: { id: string; email?: string } | null;
  roles: readonly EditorialRole[];
}): AdminAccess {
  if (!input.configured) return { state: 'not-configured' };
  if (!input.user) return { state: 'signed-out' };
  const role = highestRole(input.roles);
  const identity = { userId: input.user.id, email: input.user.email };
  return role ? { state: 'authorized', ...identity, role } : { state: 'no-role', ...identity };
}
