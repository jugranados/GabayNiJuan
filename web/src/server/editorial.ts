import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';
import { z } from 'zod';

import * as api from '@/data/editorial/api';
import { EditorialError } from '@/data/editorial/errors';
import { hasRole } from '@/domain/editorial/roles';
import { EDITORIAL_ROLES, type EditorialRole } from '@/domain/enums';
import { resolveAdminAccess, type AdminAccess } from '@/features/admin/access';
import { createEditorialClient } from '@/lib/supabase/server';

export { EditorialError };

const roleRowsSchema = z.array(z.object({ role: z.enum(EDITORIAL_ROLES) }));

/** Raised when a server action or page is reached without a valid editorial session. */
export class EditorialAccessError extends Error {
  override readonly name = 'EditorialAccessError';
}

const loadSession = cache(async (): Promise<{ access: AdminAccess; client?: SupabaseClient }> => {
  const client = await createEditorialClient();
  if (!client) return { access: resolveAdminAccess({ configured: false, user: null, roles: [] }) };

  // Verified with the auth server, not read from an unverified cookie.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { access: resolveAdminAccess({ configured: true, user: null, roles: [] }) };
  }
  const user = { id: data.user.id, email: data.user.email };

  // RLS lets a user read only their own role rows.
  const rows = await client.from('editorial_roles').select('role').eq('user_id', user.id);
  // A failed or malformed role read means "no role": access is never granted by default.
  const parsed = rows.error ? undefined : roleRowsSchema.safeParse(rows.data);
  const roles = parsed?.success ? parsed.data.map((row) => row.role) : [];
  return { access: resolveAdminAccess({ configured: true, user, roles }), client };
});

/** The current visitor's access to /admin. One check per request, shared by layout, pages and actions. */
export async function getAdminAccess(): Promise<AdminAccess> {
  return (await loadSession()).access;
}

function bind(client: SupabaseClient) {
  type Tail<F> = F extends (client: SupabaseClient, ...rest: infer R) => infer Out
    ? (...rest: R) => Out
    : never;
  const withClient = <F extends (client: SupabaseClient, ...rest: never[]) => unknown>(fn: F) =>
    ((...rest: unknown[]) =>
      (fn as unknown as (...all: unknown[]) => unknown)(client, ...rest)) as Tail<F>;
  return {
    queue: withClient(api.fetchQueue),
    record: withClient(api.fetchRecord),
    createRecord: withClient(api.createRecord),
    updateRecord: withClient(api.updateRecord),
    transitionRecord: withClient(api.transitionRecord),
    contestParticipations: withClient(api.fetchContestParticipations),
    electionOffices: withClient(api.fetchElectionOffices),
    evidence: withClient(api.fetchEvidence),
    setEvidence: withClient(api.setEvidence),
    removeEvidence: withClient(api.removeEvidence),
    readiness: withClient(api.fetchReadiness),
    revisions: withClient(api.fetchRevisions),
    corrections: withClient(api.fetchCorrections),
    correction: withClient(api.fetchCorrection),
    correctionsFor: withClient(api.fetchCorrectionsFor),
    reviewCorrection: withClient(api.reviewCorrection),
    staff: withClient(api.fetchStaff),
    setStaffRole: withClient(api.setStaffRole),
    roleEvents: withClient(api.fetchRoleEvents),
  };
}

export type Editorial = ReturnType<typeof bind> & {
  userId: string;
  email?: string;
  role: EditorialRole;
};

/**
 * The signed-in editor and data access bound to THEIR session. Throws
 * EditorialAccessError unless the visitor is signed in with at least `minimum`.
 * Every editorial page and every server action starts here, so nothing editorial
 * runs for an anonymous or role-less request even if a layout is bypassed.
 */
export async function getEditorial(minimum: EditorialRole = 'REVIEWER'): Promise<Editorial> {
  const { access, client } = await loadSession();
  if (access.state !== 'authorized' || !client || !hasRole(access.role, minimum)) {
    throw new EditorialAccessError('Editorial access required');
  }
  return { ...bind(client), userId: access.userId, email: access.email, role: access.role };
}

/** Email + password sign-in for invited staff. Returns false on any failure, without detail. */
export async function signInEditor(email: string, password: string): Promise<boolean | 'not-configured'> {
  const client = await createEditorialClient();
  if (!client) return 'not-configured';
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

export async function signOutEditor(): Promise<void> {
  const client = await createEditorialClient();
  await client?.auth.signOut();
}

/**
 * For /admin pages. Layouts and pages render independently, so a page cannot rely on the
 * layout's check: it asks here. Returns undefined when the layout is already showing the
 * signed-out redirect or the "no editorial access" state, so the page renders nothing.
 */
export async function getEditorialForPage(): Promise<Editorial | undefined> {
  const { access } = await loadSession();
  return access.state === 'authorized' ? getEditorial() : undefined;
}
