import type { EvidenceLink, RefOption } from '@/domain/editorial/models';
import { buildChecklist, isReadyForReview, type Readiness } from '@/domain/editorial/readiness';
import { enumLabel } from '@/domain/enums';
import { ActionForm, SubmitButton, type FormAction } from '@/features/admin/components/ActionForm';

/**
 * What the claim's verification status requires and whether the attached evidence meets it.
 * The verdict is the database's (`claim_readiness`); the checklist only explains it.
 */
export function ReadinessPanel({ readiness }: { readiness: Readiness }) {
  const ready = isReadyForReview(readiness);
  return (
    <section aria-label="Verification requirements" className="card">
      <h2 className="text-xl font-bold">Verification</h2>
      <p>
        Selected status: <strong>{enumLabel(readiness.verification_status)}</strong>
      </p>
      <ul className="mt-2 space-y-1">
        {buildChecklist(readiness).map((item) => (
          <li key={item.label}>
            <span aria-hidden="true">{item.met ? '✓' : '✗'}</span>{' '}
            <span className="sr-only">{item.met ? 'Met:' : 'Not met:'}</span> {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-2 font-semibold">
        {ready ? 'Ready for review.' : `Not ready: ${readiness.error}`}
      </p>
      {ready && readiness.unpublished_sources > 0 ? (
        <p className="text-sm">
          {readiness.unpublished_sources} cited source(s) must be published before this claim can be
          published.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted">
        This is a workflow aid for editors. The database enforces these rules; it is not a rating of
        any person.
      </p>
    </section>
  );
}

/** Claim → evidence → sources. Contradicting sources are kept and labelled, never hidden. */
export function EvidencePanel({
  evidence,
  sourceOptions,
  sourceHref,
  canEdit,
  needsReason,
  setAction,
  removeAction,
}: {
  evidence: readonly EvidenceLink[];
  sourceOptions: readonly RefOption[];
  sourceHref: (sourceId: string) => string;
  canEdit: boolean;
  /** The claim is published: every evidence change must state a reason. */
  needsReason: boolean;
  setAction: FormAction;
  removeAction: FormAction;
}) {
  const reasonField = (id: string) =>
    needsReason ? (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-semibold">
          Reason for change (required)
        </label>
        <input id={id} name="reason" required className="field" />
      </div>
    ) : null;
  return (
    <section aria-label="Evidence" className="card">
      <h2 className="text-xl font-bold">Evidence</h2>
      <p className="text-sm text-muted">
        A source either supports or contradicts the claim. Contradictions are preserved, never
        hidden.
      </p>
      {evidence.length === 0 ? <p className="mt-2 text-muted">No sources attached yet.</p> : null}
      <ul className="mt-3 space-y-3">
        {evidence.map((link) => (
          <li key={link.sourceId} className="border-l-2 border-line pl-3">
            <p>
              <strong>{link.supports ? 'Supports' : 'Contradicts'}</strong> ·{' '}
              <a href={sourceHref(link.sourceId)} className="link">
                {link.source.title}
              </a>
            </p>
            <p className="text-sm text-muted">
              {link.source.publisher} · {enumLabel(link.source.sourceType)}
              {link.source.status !== 'PUBLISHED'
                ? ` · Source not yet published (${enumLabel(link.source.status)})`
                : ''}
            </p>
            {link.note ? <p className="text-sm">Note: {link.note}</p> : null}
            {link.source.url ? (
              <a href={link.source.url} target="_blank" rel="noopener noreferrer" className="link text-sm">
                Open original source (new tab)
              </a>
            ) : null}
            {canEdit ? (
              <ActionForm action={removeAction} className="mt-2 flex flex-wrap items-end gap-2">
                <input type="hidden" name="sourceId" value={link.sourceId} />
                {reasonField(`remove-reason-${link.sourceId}`)}
                <SubmitButton>
                  Remove<span className="sr-only">: {link.source.title}</span>
                </SubmitButton>
              </ActionForm>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <ActionForm action={setAction} label="Attach evidence" className="mt-4 space-y-3 border-t border-line pt-4">
          <h3 className="font-bold">Attach a source</h3>
          <div>
            <label htmlFor="evidence-source" className="mb-1 block text-sm font-semibold">
              Source
            </label>
            <select id="evidence-source" name="sourceId" required defaultValue="" className="field">
              <option value="">Select a source…</option>
              {sourceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="evidence-supports" className="mb-1 block text-sm font-semibold">
              Relationship
            </label>
            <select id="evidence-supports" name="supports" defaultValue="yes" className="field">
              <option value="yes">Supports the claim</option>
              <option value="no">Contradicts the claim</option>
            </select>
          </div>
          <div>
            <label htmlFor="evidence-note" className="mb-1 block text-sm font-semibold">
              Note
            </label>
            <input id="evidence-note" name="note" className="field" />
          </div>
          {reasonField('evidence-reason')}
          <SubmitButton>Attach evidence</SubmitButton>
        </ActionForm>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Evidence cannot be changed in this state or with your role.
        </p>
      )}
    </section>
  );
}
