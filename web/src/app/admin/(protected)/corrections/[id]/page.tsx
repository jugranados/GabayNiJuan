import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  CORRECTION_ACTION_LABELS,
  CORRECTION_TRANSITIONS,
  correctionNoteRequired,
} from '@/domain/editorial/correctionReview';
import { recordTypeByType } from '@/domain/editorial/records';
import { enumLabel } from '@/domain/enums';
import { isUuid } from '@/domain/slug';
import { reviewCorrectionAction } from '@/features/admin/actions';
import { ActionForm, SubmitButton } from '@/features/admin/components/ActionForm';
import { staffLabeler } from '@/features/admin/components/RevisionList';
import { adminPaths, formatTimestamp } from '@/features/admin/paths';
import { getEditorialForPage } from '@/server/editorial';

export const metadata: Metadata = { title: 'Correction request' };

export default async function CorrectionPage({ params }: PageProps<'/admin/corrections/[id]'>) {
  const editorial = await getEditorialForPage();
  if (!editorial) return null;
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [request, staff] = await Promise.all([editorial.correction(id), editorial.staff()]);
  if (!request) notFound();

  const def = recordTypeByType(request.recordType);
  // What the report is about, read with the editor's own access so drafts and retracted records show too.
  const target = def ? await editorial.record(def, request.recordId) : null;
  const targetLabel = target
    ? (await editorial.queue({ recordType: def?.recordType, id: target.id }, 1))[0]?.label
    : undefined;
  const next = CORRECTION_TRANSITIONS[request.status];
  const nameOf = staffLabeler(staff);
  const action = reviewCorrectionAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <p>
        <Link href={adminPaths.corrections} className="link">
          ← All requests
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">Correction request</h1>
      <p className="mt-1">
        Status: <strong>{enumLabel(request.status)}</strong>
      </p>

      <section aria-label="Report" className="card mt-4">
        <h2 className="text-xl font-bold">What the visitor reported</h2>
        <p className="mt-2 whitespace-pre-wrap">{request.description}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-semibold">Affected record</dt>
          <dd>
            {def ? (
              <Link href={adminPaths.record(def.slug, request.recordId)} className="link">
                {enumLabel(def.singular)}
                {targetLabel ? `: ${targetLabel}` : ''}
              </Link>
            ) : (
              enumLabel(request.recordType)
            )}
            {target ? ` (${enumLabel(target.status)})` : ''}
          </dd>
          {request.claimId ? (
            <>
              <dt className="font-semibold">Related claim</dt>
              <dd>
                <Link href={adminPaths.record('claims', request.claimId)} className="link">
                  Open claim
                </Link>
              </dd>
            </>
          ) : null}
          <dt className="font-semibold">Submitted source</dt>
          <dd>
            {request.sourceUrl ? (
              <>
                <a href={request.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="link break-all">
                  {request.sourceUrl}
                </a>{' '}
                <span className="text-muted">(untrusted link — verify before relying on it)</span>
              </>
            ) : (
              'None provided'
            )}
          </dd>
          <dt className="font-semibold">Contact</dt>
          <dd>{request.contactEmail ?? 'None provided'}</dd>
          <dt className="font-semibold">Submitted</dt>
          <dd>{formatTimestamp(request.createdAt)}</dd>
          {request.reviewedAt ? (
            <>
              <dt className="font-semibold">Last reviewed</dt>
              <dd>
                {formatTimestamp(request.reviewedAt)} by {nameOf(request.reviewedBy)}
              </dd>
            </>
          ) : null}
          {request.resolutionNote ? (
            <>
              <dt className="font-semibold">Resolution note</dt>
              <dd className="whitespace-pre-wrap">{request.resolutionNote}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {next.length > 0 ? (
        <section aria-label="Decision" className="card mt-4">
          <h2 className="text-xl font-bold">Decision</h2>
          <p className="text-sm text-muted">
            A decision here changes only this request. To correct the record, edit it through the
            normal workflow, then mark the request resolved.
          </p>
          <ActionForm action={action} className="mt-3 space-y-3">
            <input type="hidden" name="version" value={request.version} />
            <div>
              <label htmlFor="c-note" className="mb-1 block font-semibold">
                Resolution note
                {next.every(correctionNoteRequired) ? ' (required)' : ' (required to accept, reject or resolve)'}
              </label>
              <textarea id="c-note" name="note" rows={3} className="field" />
            </div>
            <div className="flex flex-wrap gap-3">
              {next.map((to) => (
                <SubmitButton key={to} name="to" value={to} danger={to === 'REJECTED'}>
                  {CORRECTION_ACTION_LABELS[to]}
                </SubmitButton>
              ))}
            </div>
          </ActionForm>
        </section>
      ) : (
        <p className="card mt-4 text-muted">This request is closed.</p>
      )}
    </div>
  );
}
