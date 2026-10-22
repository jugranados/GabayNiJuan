'use client';

import { useActionState, useEffect, useRef } from 'react';

import { CORRECTION_DESCRIPTION_MAX, CORRECTION_NOTICE } from '@/domain/corrections';
import { submitCorrection, type CorrectionFormState } from '@/features/corrections/actions';
import { HONEYPOT_FIELD, STARTED_AT_FIELD } from '@/features/corrections/guard';

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
} & Pick<React.ComponentProps<'input'>, 'type' | 'maxLength' | 'required' | 'autoComplete' | 'inputMode'>;

function Field({ name, label, hint, error, multiline, ...input }: FieldProps) {
  const describedBy = [hint ? `${name}-hint` : undefined, error ? `${name}-error` : undefined]
    .filter(Boolean)
    .join(' ');
  const shared = {
    id: name,
    name,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': error ? true : undefined,
    className: 'field',
  };
  return (
    <div>
      <label htmlFor={name} className="mb-1 block font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={`${name}-hint`} className="mb-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {multiline ? (
        <textarea {...shared} rows={6} maxLength={input.maxLength} required={input.required} />
      ) : (
        <input {...shared} {...input} />
      )}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm font-semibold">
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Report an error". No account is needed. The notice states plainly that a
 * report is a request for review and does not change the public record.
 */
export function ReportErrorForm({ type, id }: { type: string; id: string }) {
  const [state, action, pending] = useActionState<CorrectionFormState, FormData>(submitCorrection, {
    status: 'idle',
  });

  // When the visitor opened the form; the server rejects submissions made implausibly fast.
  const startedAt = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (startedAt.current) startedAt.current.value = String(Date.now());
  }, [state]);

  if (state.status === 'sent') {
    return (
      <div role="status" className="card bg-surface">
        <p className="font-semibold">Thank you. Your report was received.</p>
        <p className="mt-1">{CORRECTION_NOTICE}</p>
      </div>
    );
  }

  const errors = state.status === 'invalid' ? state.errors : {};
  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name={STARTED_AT_FIELD} ref={startedAt} defaultValue="" />
      {/* Honeypot: hidden from people and assistive technology; only scripts fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="report-website">Leave this field empty</label>
        <input id="report-website" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <Field
        name="description"
        label="What appears incorrect?"
        multiline
        required
        maxLength={CORRECTION_DESCRIPTION_MAX}
        error={errors.description}
      />
      <Field
        name="sourceUrl"
        label="Source link (optional but encouraged)"
        hint="A link to a document or page that shows the correct information."
        type="url"
        inputMode="url"
        maxLength={2000}
        autoComplete="off"
        error={errors.sourceUrl}
      />
      <Field
        name="contactEmail"
        label="Email (optional)"
        hint="Only used if reviewers need to ask a question. It is never shown publicly."
        type="email"
        maxLength={254}
        autoComplete="email"
        error={errors.contactEmail}
      />
      {state.status === 'slow-down' ? (
        <p role="alert" className="font-semibold">
          You have sent several reports in a short time. Please wait a few minutes and try again.
        </p>
      ) : null}
      {state.status === 'failed' ? (
        <p role="alert" className="font-semibold">
          Your report could not be sent. Please try again in a moment.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? 'Sending…' : 'Send report'}
      </button>
    </form>
  );
}
