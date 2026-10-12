import { render, screen } from '@testing-library/react';

import type { AdminAccess } from '@/features/admin/access';
import { resolveAdminAccess } from '@/features/admin/access';
import { hasRole, highestRole } from '@/domain/editorial/roles';

let access: AdminAccess = { state: 'signed-out' };
const editorialForPage = vi.fn();
vi.mock('@/server/editorial', () => ({
  getAdminAccess: async () => access,
  getEditorialForPage: () => editorialForPage(),
}));
vi.mock('@/features/admin/actions', () => ({ signOut: async () => undefined, signIn: async () => ({}) }));

import ProtectedAdminLayout from '@/app/admin/(protected)/layout';
import AdminLoginPage from '@/app/admin/login/page';
import DashboardPage from '@/app/admin/(protected)/page';
import RolesPage from '@/app/admin/(protected)/roles/page';

const user = { id: 'u-1', email: 'staff@example.org' };
const protectedArea = async () =>
  render(await ProtectedAdminLayout({ children: <p>EDITORIAL CONTENT</p> }));

describe('resolveAdminAccess', () => {
  it('grants access only to a signed-in user with an editorial role', () => {
    expect(resolveAdminAccess({ configured: false, user, roles: ['ADMIN'] }).state).toBe('not-configured');
    expect(resolveAdminAccess({ configured: true, user: null, roles: ['ADMIN'] }).state).toBe('signed-out');
    expect(resolveAdminAccess({ configured: true, user, roles: [] })).toEqual({
      state: 'no-role',
      userId: 'u-1',
      email: 'staff@example.org',
    });
    expect(resolveAdminAccess({ configured: true, user, roles: ['REVIEWER', 'APPROVER'] })).toEqual({
      state: 'authorized',
      userId: 'u-1',
      email: 'staff@example.org',
      role: 'APPROVER',
    });
  });

  it('orders roles REVIEWER < APPROVER < ADMIN', () => {
    expect(highestRole(['REVIEWER', 'ADMIN', 'APPROVER'])).toBe('ADMIN');
    expect(highestRole([])).toBeUndefined();
    expect(hasRole('REVIEWER', 'APPROVER')).toBe(false);
    expect(hasRole('ADMIN', 'APPROVER')).toBe(true);
    expect(hasRole(undefined, 'REVIEWER')).toBe(false);
  });
});

describe('/admin boundary', () => {
  it('redirects a signed-out visitor to the sign-in page without rendering anything', async () => {
    for (const state of ['signed-out', 'not-configured'] as const) {
      access = { state };
      await expect(protectedArea()).rejects.toMatchObject({
        digest: expect.stringMatching(/^NEXT_REDIRECT;[^;]*;\/admin\/login;/),
      });
    }
  });

  it('denies a signed-in user who has no editorial role', async () => {
    access = { state: 'no-role', userId: 'u-2', email: 'outsider@example.org' };
    await protectedArea();
    expect(screen.getByRole('heading', { name: 'No editorial access' })).toBeInTheDocument();
    expect(screen.queryByText('EDITORIAL CONTENT')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it.each(['REVIEWER', 'APPROVER', 'ADMIN'] as const)('lets a %s in', async (role) => {
    access = { state: 'authorized', userId: 'u-1', email: 'staff@example.org', role };
    await protectedArea();
    expect(screen.getByText('EDITORIAL CONTENT')).toBeInTheDocument();
  });

  it('pages render nothing on their own when there is no editorial session', async () => {
    editorialForPage.mockResolvedValue(undefined);
    expect(await DashboardPage()).toBeNull();
    expect(await RolesPage()).toBeNull();
  });

  it('hides role management from reviewers and approvers', async () => {
    for (const role of ['REVIEWER', 'APPROVER'] as const) {
      const staff = vi.fn();
      editorialForPage.mockResolvedValue({ role, staff, roleEvents: vi.fn() });
      const { container, unmount } = render(await RolesPage());
      expect(container).toHaveTextContent('Your role does not include this area.');
      expect(staff).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('shows the navigation for the role, with role management for administrators only', async () => {
    access = { state: 'authorized', userId: 'u-1', email: 'staff@example.org', role: 'APPROVER' };
    const { unmount } = await protectedArea();
    expect(screen.getByRole('link', { name: 'Work queue' })).toHaveAttribute('href', '/admin/queue');
    expect(screen.queryByRole('link', { name: 'Users / roles' })).toBeNull();
    unmount();
    access = { ...access, role: 'ADMIN' };
    await protectedArea();
    expect(screen.getByRole('link', { name: 'Users / roles' })).toHaveAttribute('href', '/admin/roles');
  });

  it('offers sign-in only: no sign-up or account creation', async () => {
    access = { state: 'signed-out' };
    const { container } = render(await AdminLoginPage());
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign up|register|create account/i })).toBeNull();
    expect(container).toHaveTextContent('there is no public sign-up');
  });
});
