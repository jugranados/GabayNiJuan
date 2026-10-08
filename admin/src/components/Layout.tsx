import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import { label } from '@/domain/enums';
import { can } from '@/domain/roles';

export function Layout() {
  const { email, role, signOut } = useAuth();
  return (
    <>
      <header className="top">
        <strong>Gabay ni Juan · Editorial</strong>
        <nav aria-label="Main">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/queue">Work queue</NavLink>
          <NavLink to="/corrections">Corrections</NavLink>
          <NavLink to="/revisions">Revisions</NavLink>
          {can(role, 'manage-roles') && <NavLink to="/roles">Users / roles</NavLink>}
        </nav>
        <span className="muted">
          {email} · {role ? label(role) : 'no role'}
        </span>
        <button className="secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
