import Link from 'next/link';
import { redirect } from 'next/navigation';

import { can, ROLE_LABELS } from '@/domain/editorial/roles';
import { signOut } from '@/features/admin/actions';
import { adminPaths } from '@/features/admin/paths';
import { getAdminAccess } from '@/server/editorial';

function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="btn">
        Sign out
      </button>
    </form>
  );
}

/**
 * Boundary for every editorial page. Runs on each request (it reads cookies), so nothing
 * below it is ever cached or rendered for a visitor without a role. Pages and server
 * actions repeat the check themselves (getEditorial), and the database has the final say.
 */
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAdminAccess();

  if (access.state === 'not-configured' || access.state === 'signed-out') {
    redirect(adminPaths.login);
  }

  if (access.state === 'no-role') {
    return (
      <div className="max-w-xl">
        <h1 className="text-3xl font-bold">No editorial access</h1>
        <p className="mt-4">
          You are signed in{access.email ? ` as ${access.email}` : ''}, but this account has no
          editorial role. An administrator must assign one before you can use this area.
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    );
  }

  const nav: [string, string][] = [
    [adminPaths.home, 'Dashboard'],
    [adminPaths.queue, 'Work queue'],
    [adminPaths.corrections, 'Corrections'],
    [adminPaths.revisions, 'Revisions'],
    ...(can(access.role, 'manage-roles') ? ([[adminPaths.roles, 'Users / roles']] as [string, string][]) : []),
  ];
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <nav aria-label="Editorial">
          <ul className="flex flex-wrap gap-x-5">
            {nav.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="link inline-flex min-h-11 items-center">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            {access.email ?? 'Signed in'} · <strong>{ROLE_LABELS[access.role]}</strong>
          </span>
          <SignOutButton />
        </div>
      </div>
      {children}
    </>
  );
}
