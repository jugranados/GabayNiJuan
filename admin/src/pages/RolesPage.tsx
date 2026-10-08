import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ErrorBanner } from '@/components/ErrorBanner';
import { fetchRoleEvents, fetchStaff, setStaffRole } from '@/data/api';
import { EDITORIAL_ROLES, label, type EditorialRole } from '@/domain/enums';

export function RolesPage() {
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ['staff'], queryFn: fetchStaff });
  const events = useQuery({ queryKey: ['role-events'], queryFn: fetchRoleEvents });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EditorialRole>('REVIEWER');
  const change = useMutation({
    mutationFn: (a: { email: string; role: EditorialRole | null }) => setStaffRole(a.email, a.role),
    onSuccess: () => {
      setEmail('');
      void qc.invalidateQueries({ queryKey: ['staff'] });
      void qc.invalidateQueries({ queryKey: ['role-events'] });
    },
  });
  return (
    <div>
      <h1>Users / editorial roles</h1>
      <p className="help">
        Create or invite the account in the Supabase dashboard first (public sign-up is disabled), then assign a role here. Each user has one role. The last administrator cannot be removed.
      </p>
      <ErrorBanner error={change.error ?? staff.error} />
      <div className="card">
        <table aria-label="Staff">
          <thead><tr><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody>
            {staff.data?.map((s) => (
              <tr key={s.user_id}>
                <td>{s.email}</td>
                <td>
                  <select aria-label={`Role for ${s.email}`} value={s.role ?? ''} onChange={(e) => change.mutate({ email: s.email, role: (e.target.value || null) as EditorialRole | null })}>
                    {EDITORIAL_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                  </select>
                </td>
                <td><button type="button" className="danger" onClick={() => change.mutate({ email: s.email, role: null })}>Remove role</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card" aria-label="Assign role" onSubmit={(e) => { e.preventDefault(); change.mutate({ email: email.trim(), role }); }}>
        <h2>Assign a role</h2>
        <label htmlFor="role-email">Account email</label>
        <input id="role-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="role-role">Role</label>
        <select id="role-role" value={role} onChange={(e) => setRole(e.target.value as EditorialRole)}>
          {EDITORIAL_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
        </select>
        <div className="row" style={{ marginTop: 10 }}><button type="submit" disabled={change.isPending}>Assign</button></div>
      </form>
      <div className="card">
        <h2>Role change log</h2>
        <ul>
          {events.data?.map((e) => (
            <li key={e.id}>{new Date(e.changed_at).toLocaleString()} — {e.target_email}: {e.old_role ? label(e.old_role) : 'none'} → {e.new_role ? label(e.new_role) : 'none'}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
