import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthState } from '../AuthContext';
import { RequireAuth, RequireCapability } from '../guards';

function auth(overrides: Partial<AuthState>): AuthState {
  return { status: 'signed-in', signIn: vi.fn(), signOut: vi.fn(), ...overrides };
}

function renderAt(state: AuthState, ui = <p>secret dashboard</p>) {
  return render(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route element={<RequireAuth />}>
            <Route index element={ui} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('RequireAuth', () => {
  it('redirects unauthenticated visitors to the login page', () => {
    renderAt(auth({ status: 'signed-out' }));
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
  });
  it('shows nothing sensitive while loading', () => {
    renderAt(auth({ status: 'loading' }));
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
  });
  it('blocks signed-in users with no editorial role', () => {
    renderAt(auth({ role: undefined }));
    expect(screen.getByText(/no editorial access/i)).toBeInTheDocument();
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
  });
  it('lets a reviewer in', () => {
    renderAt(auth({ role: 'REVIEWER' }));
    expect(screen.getByText('secret dashboard')).toBeInTheDocument();
  });
});

describe('RequireCapability', () => {
  const page = (role: AuthState['role']) =>
    render(
      <AuthContext.Provider value={auth({ role })}>
        <RequireCapability capability="manage-roles"><p>roles page</p></RequireCapability>
      </AuthContext.Provider>,
    );
  it('hides the role-management page from non-admins', () => {
    page('APPROVER');
    expect(screen.queryByText('roles page')).not.toBeInTheDocument();
  });
  it('shows it to admins', () => {
    page('ADMIN');
    expect(screen.getByText('roles page')).toBeInTheDocument();
  });
});
