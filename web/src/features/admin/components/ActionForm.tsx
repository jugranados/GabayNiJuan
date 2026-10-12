'use client';

import { useRouter } from 'next/navigation';
import { useActionState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { INITIAL_ACTION_STATE, type ActionState } from '@/features/admin/actionState';

export type FormAction = (previous: ActionState, data: FormData) => Promise<ActionState>;

/** What went wrong, and a reload when the record changed under the editor (optimistic concurrency). */
export function ActionError({ state }: { state: ActionState }) {
  const router = useRouter();
  if (!state.error) return null;
  return (
    <div role="alert" className="card border-ink bg-surface">
      <p className="font-semibold">
        {state.stale ? 'This record was changed by someone else.' : 'This could not be saved.'}
      </p>
      <p className="text-sm">{state.error}</p>
      {state.stale ? (
        <button type="button" className="btn mt-2" onClick={() => router.refresh()}>
          Reload record
        </button>
      ) : null}
    </div>
  );
}

/** A form bound to a server action that shows the action's error next to itself. */
export function ActionForm({
  action,
  children,
  className,
  label,
  savedMessage,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  label?: string;
  savedMessage?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} aria-label={label} className={className}>
      <ActionError state={state} />
      {state.ok && savedMessage ? (
        <p role="status" className="text-sm font-semibold">
          {savedMessage}
        </p>
      ) : null}
      {children}
    </form>
  );
}

export function SubmitButton({
  children,
  danger,
  primary,
  disabled,
  name,
  value,
}: {
  children: ReactNode;
  danger?: boolean;
  primary?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={`btn${primary ? ' btn-primary' : ''}${danger ? ' btn-danger' : ''}`}
    >
      {children}
    </button>
  );
}
