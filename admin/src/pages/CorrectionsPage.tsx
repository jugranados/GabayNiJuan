import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBanner } from '@/components/ErrorBanner';
import { fetchCorrections, reviewCorrection } from '@/data/api';
import { useStaffLabels } from '@/data/hooks';
import { CORRECTION_STATUSES, label, type CorrectionStatus } from '@/domain/enums';
import { recordTypeByType } from '@/domain/records';
import { toEditorialError } from '@/lib/errors';

const NEXT: Readonly<Record<CorrectionStatus, readonly CorrectionStatus[]>> = {
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['RESOLVED'],
  REJECTED: [],
  RESOLVED: [],
};

export function CorrectionsPage() {
  const { id } = useParams();
  const [status, setStatus] = useState<CorrectionStatus | ''>('');
  const query = useQuery({ queryKey: ['corrections', status], queryFn: () => fetchCorrections(status || undefined) });
  const nameOf = useStaffLabels();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const review = useMutation({
    mutationFn: (a: { id: string; to: CorrectionStatus; version: number }) => reviewCorrection(a.id, a.to, a.version, note || undefined),
    onSuccess: () => {
      setNote('');
      void qc.invalidateQueries({ queryKey: ['corrections'] });
      void qc.invalidateQueries({ queryKey: ['corrections-for'] });
    },
  });
  const selected = id ? query.data?.find((c) => c.id === id) : undefined;

  return (
    <div>
      <h1>Correction requests</h1>
      <p className="help">Private. Submissions never change published data. Accepting a request only records the decision; fix the record through the normal draft → review → approval → publish flow.</p>
      <div className="card row">
        <label htmlFor="c-status">Status</label>
        <select id="c-status" value={status} onChange={(e) => setStatus(e.target.value as CorrectionStatus | '')}>
          <option value="">All</option>
          {CORRECTION_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      </div>
      <ErrorBanner error={query.error} />
      {selected ? (
        <div className="card" aria-label="Correction detail">
          <p><Link to="/corrections">← All requests</Link></p>
          <h2>{label(selected.status)}</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{selected.description}</p>
          <p>
            Affected record:{' '}
            {(() => {
              const def = recordTypeByType(selected.record_type);
              return def ? <Link to={`/records/${def.slug}/${selected.record_id}`}>{label(def.singular)}</Link> : label(selected.record_type);
            })()}
            {selected.claim_id && <> · <Link to={`/records/claims/${selected.claim_id}`}>Related claim</Link></>}
          </p>
          {selected.source_url && (
            <p>Submitted source: <a href={selected.source_url} target="_blank" rel="noopener noreferrer">Open submitted source</a> <span className="muted">(untrusted link — verify before relying on it)</span></p>
          )}
          <p className="muted">Contact: {selected.contact_email ?? 'none provided'} · Submitted {new Date(selected.created_at).toLocaleString()}</p>
          {selected.reviewed_at && <p className="muted">Last reviewed by {nameOf(selected.reviewed_by)} on {new Date(selected.reviewed_at).toLocaleString()}</p>}
          {selected.resolution_note && <p>Resolution note: {selected.resolution_note}</p>}
          <ErrorBanner error={review.error} onReload={review.error && toEditorialError(review.error as Error).stale ? () => { review.reset(); void qc.invalidateQueries({ queryKey: ['corrections'] }); } : undefined} />
          {NEXT[selected.status].length > 0 && (
            <>
              <label htmlFor="c-note">Resolution note (required to accept, reject or resolve)</label>
              <textarea id="c-note" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row" style={{ marginTop: 10 }}>
                {NEXT[selected.status].map((to) => (
                  <button key={to} type="button" disabled={review.isPending || (to !== 'UNDER_REVIEW' && !note.trim())} className={to === 'REJECTED' ? 'danger' : undefined} onClick={() => review.mutate({ id: selected.id, to, version: selected.version })}>
                    {to === 'UNDER_REVIEW' ? 'Start review' : label(to)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          {query.data?.length === 0 && <p className="muted">No correction requests.</p>}
          <table aria-label="Correction requests">
            <tbody>
              {query.data?.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/corrections/${c.id}`}>{c.description.slice(0, 90)}</Link></td>
                  <td>{label(c.record_type)}</td>
                  <td>{label(c.status)}</td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
