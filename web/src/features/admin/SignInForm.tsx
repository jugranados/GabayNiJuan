'use client';

import { useActionState } from 'react';

import { signIn } from '@/features/admin/actions';
import { INITIAL_ACTION_STATE } from '@/features/admin/actionState';

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block font-semibold">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block font-semibold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>
      {state.error ? (
        <p role="alert" className="font-semibold">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
