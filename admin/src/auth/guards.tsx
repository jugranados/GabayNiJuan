import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { can, type Capability } from '@/domain/roles';

import { useAuth } from './AuthContext';

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') return <p role="status">Loading…</p>;
  if (auth.status === 'signed-out') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!auth.role) {
    return (
      <main className="card narrow">
        <h1>No editorial access</h1>
        <p>This account has no editorial role. Ask an administrator to assign one.</p>
        <button onClick={() => void auth.signOut()}>Sign out</button>
      </main>
    );
  }
  return <Outlet />;
}

/** Hides a page the role cannot use. The database re-checks every action regardless. */
export function RequireCapability({ capability, children }: { capability: Capability; children: ReactNode }) {
  const { role } = useAuth();
  if (!can(role, capability)) {
    return (
      <section className="card">
        <h1>Not available</h1>
        <p>Your role does not include this area.</p>
      </section>
    );
  }
  return <>{children}</>;
}
