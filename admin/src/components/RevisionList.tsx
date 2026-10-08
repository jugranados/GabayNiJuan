import { useState } from 'react';

import { diffValues, formatValue } from '@/domain/diff';
import { label } from '@/domain/enums';
import type { Revision } from '@/data/schemas';

import { StatusBadge } from './StatusBadge';

type Props = {
  revisions: Revision[];
  nameOf: (id: string | null | undefined) => string;
  /** Raw JSON is for administrators investigating an issue. */
  allowRaw?: boolean;
};

export function RevisionList({ revisions, nameOf, allowRaw }: Props) {
  const [raw, setRaw] = useState<string | undefined>();
  if (revisions.length === 0) return <p className="muted">No revisions recorded.</p>;
  return (
    <ol style={{ paddingLeft: 18 }}>
      {revisions.map((r) => {
        const changes = diffValues(r.old_value, r.new_value);
        return (
          <li key={r.id} style={{ marginBottom: 14 }}>
            <div className="row">
              <strong>{new Date(r.created_at).toLocaleString()}</strong>
              <span className="badge">{label(r.entity_type)}</span>
              <StatusBadge status={r.approval_state} />
            </div>
            <div className="muted">
              Editor: {nameOf(r.editor_id)} · Approver: {nameOf(r.approver_id)} · Reason: {r.reason}
            </div>
            {r.old_value === null ? (
              <div className="muted">Record created.</div>
            ) : r.new_value === null ? (
              <div className="muted">Record deleted (system action).</div>
            ) : changes.length === 0 ? (
              <div className="muted">No field changes.</div>
            ) : (
              <table aria-label="Changed fields">
                <thead>
                  <tr><th>Field</th><th>Before</th><th>After</th></tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.field}>
                      <td>{c.field}</td>
                      <td>{formatValue(c.before)}</td>
                      <td>{formatValue(c.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {allowRaw && (
              <>
                <button type="button" className="secondary" onClick={() => setRaw(raw === r.id ? undefined : r.id)}>
                  {raw === r.id ? 'Hide raw data' : 'Show raw data'}
                </button>
                {raw === r.id && <pre>{JSON.stringify({ old: r.old_value, new: r.new_value }, null, 2)}</pre>}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
