import { useState } from 'react';

import { label, type EditorialRole, type PublicationStatus } from '@/domain/enums';
import { availableTransitions, reasonRequired, TRANSITION_LABELS } from '@/domain/workflow';

import { StatusBadge } from './StatusBadge';

type Props = {
  status: PublicationStatus;
  role: EditorialRole | undefined;
  busy?: boolean;
  onTransition: (to: PublicationStatus, reason?: string) => void;
};

/**
 * Offers only the transitions the role may attempt. The database state machine, two-person
 * rule and claim readiness checks decide whether they succeed.
 */
export function WorkflowBar({ status, role, busy, onTransition }: Props) {
  const [pending, setPending] = useState<PublicationStatus | undefined>();
  const [reason, setReason] = useState('');
  const options = availableTransitions(status, role);

  const choose = (to: PublicationStatus) => {
    if (reasonRequired(status, to) || to === 'REJECTED') setPending(to);
    else onTransition(to);
  };
  const needsReason = pending !== undefined && reasonRequired(status, pending);

  return (
    <section className="card" aria-label="Publication workflow">
      <div className="row">
        <strong>Publication state:</strong> <StatusBadge status={status} />
        {options.map((to) => (
          <button key={to} type="button" disabled={busy} className={to === 'REJECTED' || to === 'RETRACTED' ? 'danger' : undefined} onClick={() => choose(to)}>
            {TRANSITION_LABELS[to]}
          </button>
        ))}
        {options.length === 0 && <span className="muted">No transitions available to your role from {label(status)}.</span>}
      </div>
      {pending && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onTransition(pending, reason.trim() || undefined);
            setPending(undefined);
            setReason('');
          }}
        >
          <label htmlFor="transition-reason">{needsReason ? 'Reason for change (required)' : 'Reason (optional)'}</label>
          <textarea id="transition-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Source found invalid; record attached to wrong person" />
          <div className="row">
            <button type="submit" disabled={busy || (needsReason && reason.trim() === '')}>
              Confirm: {TRANSITION_LABELS[pending]}
            </button>
            <button type="button" className="secondary" onClick={() => setPending(undefined)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
