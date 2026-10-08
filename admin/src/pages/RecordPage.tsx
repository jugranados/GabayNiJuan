import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import { EvidencePanel, ReadinessPanel } from '@/components/ClaimEvidence';
import { ErrorBanner } from '@/components/ErrorBanner';
import { RecordForm } from '@/components/RecordForm';
import { RevisionList } from '@/components/RevisionList';
import { StatusBadge } from '@/components/StatusBadge';
import { WorkflowBar } from '@/components/WorkflowBar';
import { createRecord, fetchCorrectionsFor, fetchQueue, fetchRecord, fetchRevisions, transitionRecord, updateRecord } from '@/data/api';
import { useStaffLabels } from '@/data/hooks';
import { label, type PublicationStatus } from '@/domain/enums';
import { RECORD_TYPES, recordTypeBySlug } from '@/domain/records';
import { can } from '@/domain/roles';
import { isContentEditable, reasonRequired } from '@/domain/workflow';
import { toEditorialError } from '@/lib/errors';

export function NewRecordPage() {
  const { slug } = useParams();
  const def = recordTypeBySlug(slug);
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (values: Record<string, unknown>) => createRecord(def!.table, values),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
      navigate(`/records/${def!.slug}/${row.id}`, { replace: true });
    },
  });
  if (!def) return <p>Unknown record type.</p>;
  const defaults: Record<string, string> = {};
  const personId = search.get('person');
  if (personId && def.fields.some((f) => f.name === 'person_id')) defaults.person_id = personId;
  if (personId && def.slug === 'claims') defaults.subject_person_id = personId;

  return (
    <div className="card">
      <h1>New {def.singular}</h1>
      <p className="help">Saved as a draft. Nothing is public until it has been reviewed, approved and published.</p>
      <ErrorBanner error={create.error} />
      <RecordForm def={def} defaults={defaults} submitLabel="Save draft" busy={create.isPending} onSubmit={(v) => create.mutate(v)} />
    </div>
  );
}

export function RecordPage() {
  const { slug, id } = useParams();
  const def = recordTypeBySlug(slug);
  const { role } = useAuth();
  const nameOf = useStaffLabels();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const key = ['record', def?.table, id];
  const record = useQuery({ queryKey: key, queryFn: () => fetchRecord(def!.table, id!), enabled: Boolean(def && id) });
  const revisions = useQuery({
    queryKey: ['revisions', def?.recordType, id],
    queryFn: () => fetchRevisions({ entityType: def!.recordType, entityId: id, limit: 50 }),
    enabled: Boolean(def && id),
  });
  const corrections = useQuery({ queryKey: ['corrections-for', id], queryFn: () => fetchCorrectionsFor(id!), enabled: Boolean(id) });
  const related = useQuery({
    queryKey: ['related', id],
    queryFn: () => fetchQueue({ personId: id }, 200),
    enabled: def?.recordType === 'PERSON' && Boolean(id),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['revisions'] });
    void qc.invalidateQueries({ queryKey: ['queue'] });
    void qc.invalidateQueries({ queryKey: ['readiness'] });
  };
  const save = useMutation({
    mutationFn: (values: Record<string, unknown>) => updateRecord(def!.table, id!, record.data!.version, values, reason || undefined),
    onSuccess: () => {
      setReason('');
      refresh();
    },
  });
  const move = useMutation({
    mutationFn: (args: { to: PublicationStatus; reason?: string }) => transitionRecord(def!.table, id!, args.to, record.data!.version, args.reason),
    onSuccess: refresh,
  });

  if (!def) return <p>Unknown record type.</p>;
  if (record.isLoading) return <p role="status">Loading…</p>;
  if (!record.data) return <ErrorBanner error={record.error ?? new Error('Record not found')} />;

  const row = record.data;
  const status = row.publication_status;
  const editable = isContentEditable(status, role);
  const mutationError = save.error ?? move.error;
  const stale = mutationError ? toEditorialError(mutationError as Error).stale || (mutationError as { stale?: boolean }).stale : false;
  const url = typeof row.url === 'string' ? row.url : undefined;
  const archived = typeof row.archived_url === 'string' ? row.archived_url : undefined;

  return (
    <div>
      <h1>
        {label(def.singular)} <StatusBadge status={status} />
      </h1>
      <p className="muted">
        Version {row.version} · Created by {nameOf(row.created_by)} · Submitted by {nameOf(row.reviewed_by)} · Approved by {nameOf(row.approved_by)}
      </p>
      <ErrorBanner
        error={mutationError}
        onReload={stale ? () => { save.reset(); move.reset(); refresh(); } : undefined}
      />

      <WorkflowBar status={status} role={role} busy={move.isPending} onTransition={(to, r) => move.mutate({ to, reason: r })} />

      <section className="card" aria-label="Record details">
        {!editable && (
          <p className="banner">
            {status === 'PUBLISHED'
              ? 'Published records can be changed only by an approver, with a reason. Every change is kept in the revision history.'
              : status === 'RETRACTED'
                ? 'Retracted records are kept for the audit trail and cannot be edited.'
                : 'This record is under review and is locked. Return it to draft to edit.'}
          </p>
        )}
        {status === 'PUBLISHED' && editable && (
          <>
            <label htmlFor="change-reason">Reason for change *</label>
            <textarea id="change-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Corrected office end date based on official source" />
          </>
        )}
        {(url || archived) && (
          <p>
            {url && <a href={url} target="_blank" rel="noopener noreferrer">Open original source</a>}
            {archived && <> · <a href={archived} target="_blank" rel="noopener noreferrer">Open archived copy</a></>}
          </p>
        )}
        <RecordForm
          key={`${row.id}:${row.version}`}
          def={def}
          initial={row}
          disabled={!editable || (reasonRequired(status) && !reason.trim())}
          submitLabel={status === 'PUBLISHED' ? 'Save change' : 'Save draft'}
          busy={save.isPending}
          onSubmit={(v) => save.mutate(v)}
        />
      </section>

      {def.recordType === 'CLAIM' && (
        <>
          <ReadinessPanel claimId={row.id} />
          <EvidencePanel claimId={row.id} status={status} canEdit={can(role, 'edit-drafts') && (status !== 'REVIEWED' && status !== 'APPROVED') && (status !== 'PUBLISHED' || can(role, 'edit-published'))} />
        </>
      )}

      {def.recordType === 'PERSON' && (
        <section className="card" aria-label="Related records">
          <h2>Related records</h2>
          <div className="row">
            {RECORD_TYPES.filter((t) => ['ELECTION_PARTICIPATION', 'OFFICE_TERM', 'AFFILIATION', 'EDUCATION', 'POLICY_POSITION', 'CLAIM'].includes(t.recordType)).map((t) => (
              <Link key={t.slug} to={`/records/${t.slug}/new?person=${row.id}`}>+ {t.singular}</Link>
            ))}
          </div>
          <ul>
            {related.data?.filter((r) => r.id !== row.id).map((r) => {
              const t = RECORD_TYPES.find((x) => x.recordType === r.record_type);
              return t ? (
                <li key={r.id}>
                  <Link to={`/records/${t.slug}/${r.id}`}>{label(t.singular)}: {r.label}</Link> <StatusBadge status={r.publication_status} />
                </li>
              ) : null;
            })}
          </ul>
        </section>
      )}

      <section className="card" aria-label="Correction requests">
        <h2>Correction requests</h2>
        {corrections.data?.length === 0 && <p className="muted">None.</p>}
        <ul>
          {corrections.data?.map((c) => (
            <li key={c.id}><Link to={`/corrections/${c.id}`}>{label(c.status)} — {c.description.slice(0, 80)}</Link></li>
          ))}
        </ul>
      </section>

      <section className="card" aria-label="Revision history">
        <h2>Revision history</h2>
        <RevisionList revisions={revisions.data ?? []} nameOf={nameOf} allowRaw={can(role, 'manage-roles')} />
      </section>
    </div>
  );
}
