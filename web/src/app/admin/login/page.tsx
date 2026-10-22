import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/features/admin/SignInForm';
import { getAdminAccess } from '@/server/editorial';

export const metadata: Metadata = { title: 'Sign in' };

export default async function AdminLoginPage() {
  const access = await getAdminAccess();
  if (access.state === 'authorized' || access.state === 'no-role') redirect('/admin');
  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold">Editorial sign-in</h1>
      {access.state === 'not-configured' ? (
        <p className="mt-4">
          Editorial sign-in is not configured for this deployment. Set the public Supabase URL and
          anon key (see <code>web/.env.example</code>).
        </p>
      ) : (
        <>
          <p className="mt-4 text-muted">
            For invited reviewers, approvers and administrators. Accounts are created by an
            administrator; there is no public sign-up.
          </p>
          <div className="mt-6">
            <SignInForm />
          </div>
        </>
      )}
    </div>
  );
}
