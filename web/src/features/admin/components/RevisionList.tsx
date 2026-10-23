import { diffValues, formatValue } from '@/domain/editorial/diff';
import type { RevisionEntry } from '@/domain/editorial/models';
import { enumLabel } from '@/domain/enums';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { formatTimestamp } from '@/features/admin/paths';

export type NameOf = (id: string | null | undefined) => string;

/** user id -> email for the audit trail. Falls back to a short id; system writes keep their label. */
export function staffLabeler(staff: readonly { userId: string; email: string }[]): NameOf {
  const emails = new Map(staff.map((member) => [member.userId, member.email]));
  return (id) => {
    if (!id) return '—';
    if (id.startsWith('system:')) return id;
    return emails.get(id) ?? `${id.slice(0, 8)}…`;
  };
}

/**
 * Append-only history: who changed what, when, why, and the resulting state, with a
 * field-level diff. Raw snapshots are for administrators investigating an issue.
 */
export function RevisionList({
  revisions,
  nameOf,
  allowRaw,
}: {
  revisions: readonly RevisionEntry[];
  nameOf: NameOf;
  allowRaw?: boolean;
}) {
  if (revisions.length === 0) return <p className="text-muted">No revisions recorded.</p>;
  return (
    <ol className="space-y-4">
      {revisions.map((revision) => {
        const changes = diffValues(revision.oldValue, revision.newValue);
        return (
          <li key={revision.id} className="border-l-2 border-line pl-3">
            <p className="flex flex-wrap items-center gap-2">
              <strong>
                <time dateTime={revision.createdAt}>{formatTimestamp(revision.createdAt)}</time>
              </strong>
              <span className="text-sm">{enumLabel(revision.entityType)}</span>
              <StatusBadge status={revision.approvalState} />
            </p>
            <p className="text-sm text-muted">
              Editor: {nameOf(revision.editorId)} · Approver: {nameOf(revision.approverId)} · Reason:{' '}
              {revision.reason}
            </p>
            {revision.oldValue === null ? (
              <p className="text-sm text-muted">Record created.</p>
            ) : revision.newValue === null ? (
              <p className="text-sm text-muted">Record deleted (system action).</p>
            ) : changes.length === 0 ? (
              <p className="text-sm text-muted">No field changes.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table aria-label="Changed fields" className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Before</th>
                      <th scope="col">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((change) => (
                      <tr key={change.field}>
                        <th scope="row">{change.field}</th>
                        <td>{formatValue(change.before)}</td>
                        <td>{formatValue(change.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {allowRaw ? (
              <details className="mt-1 text-sm">
                <summary className="link cursor-pointer">Show raw data</summary>
                <pre className="overflow-x-auto bg-surface p-2 text-xs">
                  {JSON.stringify({ old: revision.oldValue, new: revision.newValue }, null, 2)}
                </pre>
              </details>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
