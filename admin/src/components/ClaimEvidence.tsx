import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchEvidence, fetchQueue, fetchReadiness, removeEvidence, setEvidence } from '@/data/api';
import { label } from '@/domain/enums';
import { buildChecklist, isReadyForReview } from '@/domain/readiness';
import { reasonRequired } from '@/domain/workflow';
import type { PublicationStatus } from '@/domain/enums';

import { ErrorBanner } from './ErrorBanner';

export function ReadinessPanel({ claimId }: { claimId: string }) {
  const readiness = useQuery({ queryKey: ['readiness', claimId], queryFn: () => fetchReadiness(claimId) });
  if (readiness.isLoading) return <p className="muted">Checking requirements…</p>;
  if (readiness.error || !readiness.data) return <ErrorBanner error={readiness.error} />;
  const r = readiness.data;
  const ready = isReadyForReview(r);
  return (
    <section className="card" aria-label="Verification requirements">
      <h2>Verification</h2>
      <p>
        Selected: <strong>{label(r.verification_status)}</strong>
      </p>
      <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
        {buildChecklist(r).map((item) => (
          <li key={item.label} className={item.met ? 'ok' : 'error'}>
            {item.met ? '✓' : '✗'} {item.label}
          </li>
        ))}
      </ul>
      <p className={ready ? 'ok' : 'warn'}>
        {ready ? 'Ready for review' : `Not ready: ${r.error}`}
        {ready && r.unpublished_sources > 0 && ` — ${r.unpublished_sources} cited source(s) must be published before this claim can be published.`}
      </p>
      <p className="help">This is a workflow aid for editors. The database enforces these rules; it is not a rating of any person.</p>
    </section>
  );
}

export function EvidencePanel({ claimId, status, canEdit }: { claimId: string; status: PublicationStatus; canEdit: boolean }) {
  const qc = useQueryClient();
  const evidence = useQuery({ queryKey: ['evidence', claimId], queryFn: () => fetchEvidence(claimId) });
  const sources = useQuery({ queryKey: ['ref-options', 'SOURCE'], queryFn: () => fetchQueue({ recordType: 'SOURCE' }, 500) });
  const [sourceId, setSourceId] = useState('');
  const [supports, setSupports] = useState(true);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const needsReason = reasonRequired(status);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['evidence', claimId] });
    void qc.invalidateQueries({ queryKey: ['readiness', claimId] });
  };
  const add = useMutation({
    mutationFn: () => setEvidence({ claimId, sourceId, supports, note, reason }),
    onSuccess: () => {
      setSourceId('');
      setNote('');
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeEvidence(claimId, id, reason),
    onSuccess: refresh,
  });

  return (
    <section className="card" aria-label="Evidence">
      <h2>Evidence</h2>
      <p className="help">Claim → Evidence → Sources. A source either supports or contradicts the claim; contradictions are preserved, never hidden.</p>
      <ErrorBanner error={add.error ?? remove.error ?? evidence.error} />
      {evidence.data?.length === 0 && <p className="muted">No sources attached yet.</p>}
      <ul>
        {evidence.data?.map((e) => (
          <li key={e.source_id}>
            <strong className={e.supports ? 'ok' : 'error'}>{e.supports ? 'Supports' : 'Contradicts'}</strong> — {e.sources.title} ({e.sources.publisher},{' '}
            {label(e.sources.source_type)}) {e.sources.publication_status !== 'PUBLISHED' && <em className="muted">[source not yet published]</em>}
            {e.sources.url && (
              <>
                {' '}
                <a href={e.sources.url} target="_blank" rel="noopener noreferrer">
                  Open original source
                </a>
              </>
            )}
            {e.note && <div className="muted">Note: {e.note}</div>}
            {canEdit && (
              <button type="button" className="secondary" disabled={remove.isPending || (needsReason && !reason.trim())} onClick={() => remove.mutate(e.source_id)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          aria-label="Attach evidence"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <label htmlFor="evidence-source">Source</label>
          <select id="evidence-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">Select a source…</option>
            {sources.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <label htmlFor="evidence-supports">Relationship</label>
          <select id="evidence-supports" value={supports ? 'yes' : 'no'} onChange={(e) => setSupports(e.target.value === 'yes')}>
            <option value="yes">Supports the claim</option>
            <option value="no">Contradicts the claim</option>
          </select>
          <label htmlFor="evidence-note">Note</label>
          <input id="evidence-note" value={note} onChange={(e) => setNote(e.target.value)} />
          {needsReason && (
            <>
              <label htmlFor="evidence-reason">Reason for change (required)</label>
              <input id="evidence-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button type="submit" disabled={!sourceId || add.isPending || (needsReason && !reason.trim())}>
              Attach evidence
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
