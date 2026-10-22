import type { EditorialRole, PublicationStatus } from '@/domain/enums';
import { enumLabel } from '@/domain/enums';
import {
  availableTransitions,
  reasonRequired,
  TRANSITION_LABELS,
} from '@/domain/editorial/workflow';
import { ActionForm, SubmitButton, type FormAction } from '@/features/admin/components/ActionForm';
import { StatusBadge } from '@/features/admin/components/StatusBadge';

const NEXT_STEP: Readonly<Record<PublicationStatus, string>> = {
  DRAFT: 'Attach sources, then mark sources attached.',
  SOURCE_ATTACHED: 'Check the record against its sources, then submit it for approval.',
  REVIEWED: 'Waiting for an approver who did not create or submit this record.',
  APPROVED: 'Approved. An approver can publish it.',
  PUBLISHED: 'Public. It can be corrected by an approver with a reason, or retracted.',
  RETRACTED: 'Withdrawn from the public site. Kept for the audit trail; this is final.',
  REJECTED: 'Not published. It can be reopened as a draft.',
};

/**
 * Offers only the transitions the role may attempt. The database state machine, two-person
 * rule and claim readiness checks decide whether they succeed. Rejecting and retracting ask
 * for a reason first; retracting requires one.
 */
export function WorkflowBar({
  status,
  role,
  version,
  action,
}: {
  status: PublicationStatus;
  role: EditorialRole | undefined;
  version: number;
  action: FormAction;
}) {
  const options = availableTransitions(status, role);
  const hidden = (to: PublicationStatus) => (
    <>
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="from" value={status} />
      <input type="hidden" name="version" value={version} />
    </>
  );
  return (
    <section aria-label="Publication workflow" className="card">
      <p className="flex flex-wrap items-center gap-2">
        <strong>Publication state:</strong> <StatusBadge status={status} />
      </p>
      <p className="mt-1 text-sm text-muted">{NEXT_STEP[status]}</p>
      {options.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No transitions are available to your role from {enumLabel(status)}.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-start gap-3">
          {options.map((to) => {
            const needsReason = reasonRequired(status, to);
            const danger = to === 'REJECTED' || to === 'RETRACTED';
            if (!needsReason && to !== 'REJECTED') {
              return (
                <ActionForm key={to} action={action}>
                  {hidden(to)}
                  <SubmitButton primary={to === 'PUBLISHED' || to === 'APPROVED'}>
                    {TRANSITION_LABELS[to]}
                  </SubmitButton>
                </ActionForm>
              );
            }
            return (
              <details key={to} className="basis-full sm:basis-auto">
                <summary className={`btn cursor-pointer${danger ? ' btn-danger' : ''}`}>
                  {TRANSITION_LABELS[to]}…
                </summary>
                <ActionForm action={action} className="mt-2 space-y-2">
                  {hidden(to)}
                  <label htmlFor={`reason-${to}`} className="block font-semibold">
                    {needsReason ? 'Reason for change (required)' : 'Reason (optional)'}
                  </label>
                  <textarea
                    id={`reason-${to}`}
                    name="reason"
                    required={needsReason}
                    rows={2}
                    className="field"
                    placeholder="e.g. Source found invalid; record attached to wrong person"
                  />
                  <SubmitButton danger={danger}>Confirm: {TRANSITION_LABELS[to]}</SubmitButton>
                </ActionForm>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
