import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PERSON_RELATED_RECORD_TYPES, RECORD_TYPES, recordTypeBySlug, recordTypeByType } from '@/domain/editorial/records';
import { can } from '@/domain/editorial/roles';
import { isContentEditable, reasonRequired } from '@/domain/editorial/workflow';
import { enumLabel } from '@/domain/enums';
import { isUuid } from '@/domain/slug';
import {
  removeEvidenceAction,
  saveRecordAction,
  setEvidenceAction,
  transitionAction,
} from '@/features/admin/actions';
import { EvidencePanel, ReadinessPanel } from '@/features/admin/components/ClaimEvidence';
import { RecordForm } from '@/features/admin/components/RecordForm';
import { RevisionList, staffLabeler } from '@/features/admin/components/RevisionList';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { WorkflowBar } from '@/features/admin/components/WorkflowBar';
import { adminPaths } from '@/features/admin/paths';
import { loadFormRefOptions } from '@/features/admin/refOptions';
import { getEditorialForPage } from '@/server/editorial';

export const metadata: Metadata = { title: 'Record' };

const LOCKED_NOTICE = {
  PUBLISHED:
    'Published records can be changed only by an approver, with a reason. Every change is kept in the revision history.',
  RETRACTED: 'Retracted records are kept for the audit trail and cannot be edited.',
  LOCKED: 'This record is under review and is locked. Return it to draft to edit.',
} as const;

export default async function RecordPage({ params }: PageProps<'/admin/records/[type]/[id]'>) {
  const editorial = await getEditorialForPage();
  if (!editorial) return null;
  const { type, id } = await params;
  const def = recordTypeBySlug(type);
  if (!def || !isUuid(id)) notFound();
  const record = await editorial.record(def, id);
  if (!record) notFound();

  const isClaim = def.recordType === 'CLAIM';
  const isPerson = def.recordType === 'PERSON';
  const isElection = def.recordType === 'ELECTION';
  const [revisions, corrections, staff, refOptions, related, evidence, readiness, sources, electionOffices, officeOptions] =
    await Promise.all([
      editorial.revisions({ entityType: def.recordType, entityId: id, limit: 50 }),
      editorial.correctionsFor(id),
      editorial.staff(),
      loadFormRefOptions(editorial, def, record.values),
      isPerson ? editorial.queue({ personId: id }, 200) : undefined,
      isClaim ? editorial.evidence(id) : undefined,
      isClaim ? editorial.readiness(id) : undefined,
      isClaim ? editorial.queue({ recordType: 'SOURCE' }, 500) : undefined,
      isElection ? editorial.electionOffices(id) : undefined,
      isElection ? editorial.queue({ recordType: 'OFFICE' }, 500) : undefined,
    ]);

  const { status } = record;
  const editable = isContentEditable(status, editorial.role);
  const nameOf = staffLabeler(staff);
  const evidenceEditable =
    can(editorial.role, 'edit-drafts') &&
    status !== 'REVIEWED' &&
    status !== 'APPROVED' &&
    status !== 'RETRACTED' &&
    (status !== 'PUBLISHED' || can(editorial.role, 'edit-published'));

  // Where this record points, so an editor can move between related records.
  const references = def.fields.flatMap((field) => {
    if (field.kind !== 'ref' || !record.values[field.name]) return [];
    const target =
      field.refType === '@subject'
        ? recordTypeByType(record.values.subject_record_type ?? '')
        : field.refType && recordTypeByType(field.refType);
    const refId = record.values[field.name] as string;
    const label = refOptions[field.name]?.find((option) => option.id === refId)?.label ?? refId;
    return target ? [{ field: field.label, href: adminPaths.record(target.slug, refId), label }] : [];
  });

  return (
    <>
      <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold">
        {enumLabel(def.singular)} <StatusBadge status={status} />
      </h1>
      <p className="mt-1 text-sm text-muted">
        Version {record.version} · Created by {nameOf(record.createdBy)} · Submitted by{' '}
        {nameOf(record.reviewedBy)} · Approved by {nameOf(record.approvedBy)}
      </p>

      <div className="mt-4 space-y-4">
        <WorkflowBar
          status={status}
          role={editorial.role}
          version={record.version}
          action={transitionAction.bind(null, def.slug, id)}
        />

        {references.length > 0 ? (
          <section aria-label="Linked records" className="card">
            <h2 className="text-xl font-bold">Linked records</h2>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {references.map((reference) => (
                <div key={reference.field} className="contents">
                  <dt className="font-semibold">{reference.field}</dt>
                  <dd>
                    <Link href={reference.href} className="link">
                      {reference.label}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section aria-label="Record details" className="card">
          <h2 className="mb-2 text-xl font-bold">Details</h2>
          {!editable ? (
            <p className="mb-3 border-l-4 border-ink bg-surface p-2 text-sm">
              {status === 'PUBLISHED' || status === 'RETRACTED'
                ? LOCKED_NOTICE[status]
                : LOCKED_NOTICE.LOCKED}
            </p>
          ) : null}
          {record.values.url || record.values.archived_url ? (
            <p className="mb-3 flex flex-wrap gap-x-6 text-sm">
              {record.values.url ? (
                <a href={record.values.url} target="_blank" rel="noopener noreferrer" className="link">
                  Open original source (new tab)
                </a>
              ) : null}
              {record.values.archived_url ? (
                <a href={record.values.archived_url} target="_blank" rel="noopener noreferrer" className="link">
                  Open archived copy (new tab)
                </a>
              ) : null}
            </p>
          ) : null}
          <RecordForm
            key={record.id}
            def={def}
            action={saveRecordAction.bind(null, def.slug, id)}
            initial={record.values}
            refOptions={refOptions}
            version={record.version}
            disabled={!editable}
            reasonRequired={editable && reasonRequired(status)}
            submitLabel={status === 'PUBLISHED' ? 'Save change' : 'Save draft'}
          />
        </section>

        {isClaim && readiness ? <ReadinessPanel readiness={readiness} /> : null}
        {isClaim && evidence ? (
          <EvidencePanel
            evidence={evidence}
            sourceOptions={(sources ?? []).map(({ id: sourceId, label }) => ({ id: sourceId, label }))}
            sourceHref={(sourceId) => adminPaths.record('sources', sourceId)}
            canEdit={evidenceEditable}
            needsReason={reasonRequired(status)}
            setAction={setEvidenceAction.bind(null, id)}
            removeAction={removeEvidenceAction.bind(null, id)}
          />
        ) : null}

        {isPerson ? (
          <section aria-label="Related records" className="card">
            <h2 className="text-xl font-bold">Related records</h2>
            <ul className="mt-2 flex flex-wrap gap-x-5">
              {RECORD_TYPES.filter((item) => PERSON_RELATED_RECORD_TYPES.includes(item.recordType)).map(
                (item) => (
                  <li key={item.slug}>
                    <Link href={adminPaths.newRecord(item.slug, id)} className="link text-sm">
                      New {item.singular}
                    </Link>
                  </li>
                ),
              )}
            </ul>
            {(related ?? []).filter((item) => item.id !== id).length === 0 ? (
              <p className="mt-2 text-muted">No related records yet.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {(related ?? [])
                  .filter((item) => item.id !== id)
                  .map((item) => {
                    const target = recordTypeByType(item.recordType);
                    return target ? (
                      <li key={item.id} className="flex flex-wrap items-center gap-2">
                        <Link href={adminPaths.record(target.slug, item.id)} className="link">
                          {enumLabel(target.singular)}: {item.label}
                        </Link>
                        <StatusBadge status={item.status} />
                      </li>
                    ) : null;
                  })}
              </ul>
            )}
          </section>
        ) : null}

        {isElection ? (
          <section aria-label="Offices in this election" className="card">
            <h2 className="text-xl font-bold">Offices in this election</h2>
            <p className="text-sm text-muted">
              Each office contested in this election is an election office record with its own
              review and publication. Participations can only be recorded for these offices.
            </p>
            <p className="mt-2 flex flex-wrap gap-x-5">
              <Link href={adminPaths.newForElection('election-offices', id)} className="link text-sm">
                Add an office to this election
              </Link>
              <Link href={adminPaths.newForElection('participations', id)} className="link text-sm">
                New election participation in this election
              </Link>
            </p>
            {(electionOffices ?? []).length === 0 ? (
              <p className="mt-2 text-muted">No offices yet.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {(electionOffices ?? []).map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted">{item.sortOrder}</span>
                    <Link href={adminPaths.record('election-offices', item.id)} className="link">
                      {officeOptions?.find((office) => office.id === item.officeId)?.label ?? item.officeId}
                    </Link>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section aria-label="Correction requests" className="card">
          <h2 className="text-xl font-bold">Correction requests</h2>
          {corrections.length === 0 ? (
            <p className="text-muted">None.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {corrections.map((correction) => (
                <li key={correction.id}>
                  <Link href={adminPaths.correction(correction.id)} className="link">
                    {enumLabel(correction.status)} — {correction.description.slice(0, 80)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Revision history" className="card">
          <h2 className="mb-3 text-xl font-bold">Revision history</h2>
          <RevisionList revisions={revisions} nameOf={nameOf} allowRaw={can(editorial.role, 'manage-roles')} />
        </section>
      </div>
    </>
  );
}
