import type { Metadata } from 'next';

import { can, ROLE_LABELS } from '@/domain/editorial/roles';
import { EDITORIAL_ROLES } from '@/domain/enums';
import { setStaffRoleAction } from '@/features/admin/actions';
import { ActionForm, SubmitButton } from '@/features/admin/components/ActionForm';
import { formatTimestamp } from '@/features/admin/paths';
import { getEditorialForPage } from '@/server/editorial';

export const metadata: Metadata = { title: 'Users and roles' };

export default async function RolesPage() {
  const editorial = await getEditorialForPage();
  if (!editorial) return null;
  // Hidden from non-admins here; set_staff_role() refuses them in the database regardless.
  if (!can(editorial.role, 'manage-roles')) {
    return (
      <>
        <h1 className="text-3xl font-bold">Not available</h1>
        <p className="mt-4">Your role does not include this area.</p>
      </>
    );
  }
  const [staff, events] = await Promise.all([editorial.staff(), editorial.roleEvents()]);
  return (
    <>
      <h1 className="text-3xl font-bold">Users / editorial roles</h1>
      <p className="mt-2 text-sm text-muted">
        Create or invite the account in the Supabase dashboard first (public sign-up is disabled),
        then assign a role here. Each user has one role. The last administrator cannot be removed.
      </p>

      <div className="card relative mt-4 overflow-x-auto">
        <table aria-label="Staff" className="data-table">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Remove</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.userId}>
                <th scope="row">{member.email}</th>
                <td>
                  <ActionForm action={setStaffRoleAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="email" value={member.email} />
                    <select
                      name="role"
                      aria-label={`Role for ${member.email}`}
                      defaultValue={member.role ?? 'REVIEWER'}
                      className="field max-w-48"
                    >
                      {EDITORIAL_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    <SubmitButton>Save</SubmitButton>
                  </ActionForm>
                </td>
                <td>
                  <ActionForm action={setStaffRoleAction}>
                    <input type="hidden" name="email" value={member.email} />
                    <input type="hidden" name="role" value="" />
                    <SubmitButton danger>
                      Remove role<span className="sr-only"> from {member.email}</span>
                    </SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="assign-heading" className="card mt-4 max-w-xl">
        <h2 id="assign-heading" className="text-xl font-bold">
          Assign a role
        </h2>
        <ActionForm action={setStaffRoleAction} label="Assign role" savedMessage="Role saved." className="mt-2 space-y-3">
          <div>
            <label htmlFor="role-email" className="mb-1 block font-semibold">
              Account email
            </label>
            <input id="role-email" name="email" type="email" required autoComplete="off" className="field" />
          </div>
          <div>
            <label htmlFor="role-role" className="mb-1 block font-semibold">
              Role
            </label>
            <select id="role-role" name="role" defaultValue="REVIEWER" className="field">
              {EDITORIAL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton primary>Assign</SubmitButton>
        </ActionForm>
      </section>

      <section aria-labelledby="log-heading" className="card mt-4">
        <h2 id="log-heading" className="text-xl font-bold">
          Role change log
        </h2>
        {events.length === 0 ? (
          <p className="text-muted">No role changes recorded.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {events.map((event) => (
              <li key={event.id}>
                {formatTimestamp(event.changedAt)} — {event.targetEmail}:{' '}
                {event.oldRole ? ROLE_LABELS[event.oldRole] : 'none'} →{' '}
                {event.newRole ? ROLE_LABELS[event.newRole] : 'none'}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
