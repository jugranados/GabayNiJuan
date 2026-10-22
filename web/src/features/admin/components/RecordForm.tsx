'use client';

import { useActionState, useState, useTransition } from 'react';

import type { RefOption } from '@/domain/editorial/models';
import type { FieldDef, RecordTypeDef } from '@/domain/editorial/records';
import { enumLabel } from '@/domain/enums';
import { INITIAL_ACTION_STATE } from '@/features/admin/actionState';
import { loadRefOptions } from '@/features/admin/actions';
import { ActionError, SubmitButton, type FormAction } from '@/features/admin/components/ActionForm';

type Props = {
  def: RecordTypeDef;
  action: FormAction;
  /** Current values, keyed by field name. */
  initial: Readonly<Record<string, string>>;
  /** Choices for each `ref` field, keyed by field name. */
  refOptions: Readonly<Record<string, readonly RefOption[]>>;
  /** Sent back for optimistic concurrency when editing. */
  version?: number;
  disabled?: boolean;
  /** Published records can only be changed with a stated reason. */
  reasonRequired?: boolean;
  submitLabel: string;
};

function Field({
  field,
  children,
  error,
}: {
  field: FieldDef;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={field.name} className="mb-1 block font-semibold">
        {field.label}
        {field.required ? ' *' : ''}
      </label>
      {children}
      {field.help ? (
        <p id={`${field.name}-help`} className="mt-1 text-sm text-muted">
          {field.help}
        </p>
      ) : null}
      {error ? (
        <p id={`${field.name}-error`} role="alert" className="mt-1 text-sm font-semibold">
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The editor for one record, generated from its field list (domain/editorial/records).
 * Validation runs on the server with the same Zod schema; the database then applies its
 * own rules. A rejected form keeps what the editor typed.
 */
export function RecordForm({
  def,
  action,
  initial,
  refOptions,
  version,
  disabled,
  reasonRequired,
  submitLabel,
}: Props) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};

  // A claim's "subject record" choices depend on the chosen subject record type.
  const [subjectType, setSubjectType] = useState(values.subject_record_type ?? '');
  const [subjectOptions, setSubjectOptions] = useState<readonly RefOption[]>(
    refOptions.subject_record_id ?? [],
  );
  const [loadingSubjects, startLoading] = useTransition();
  const changeSubjectType = (next: string) => {
    setSubjectType(next);
    setSubjectOptions([]);
    if (next) startLoading(async () => setSubjectOptions(await loadRefOptions(next)));
  };

  const describedBy = (field: FieldDef) =>
    [field.help ? `${field.name}-help` : '', errors[field.name] ? `${field.name}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <form action={formAction} aria-label={`${def.singular} form`} className="space-y-4">
      <ActionError state={state} />
      {state.ok ? (
        <p role="status" className="font-semibold">
          Saved.
        </p>
      ) : null}
      {version !== undefined ? <input type="hidden" name="version" value={version} /> : null}

      {def.recordType === 'CLAIM' ? (
        <p className="text-sm text-muted">
          A claim is a precise factual proposition that Gabay ni Juan displays or relies upon.
          Example (fictional): “Juan Halimbawa served as Mayor of Sample City from 2022 to 2025.”
          Claims never judge a person’s character or fitness.
        </p>
      ) : null}

      {reasonRequired ? (
        <div>
          <label htmlFor="reason" className="mb-1 block font-semibold">
            Reason for change *
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            rows={2}
            disabled={disabled}
            className="field"
            placeholder="e.g. Corrected office end date based on official source"
          />
          <p className="mt-1 text-sm text-muted">Kept permanently in the revision history.</p>
        </div>
      ) : null}

      {def.fields.map((field) => {
        const shared = {
          id: field.name,
          name: field.name,
          disabled,
          className: 'field',
          'aria-describedby': describedBy(field),
          'aria-invalid': errors[field.name] ? (true as const) : undefined,
        };
        const value = values[field.name] ?? '';
        const isSubjectRecord = field.refType === '@subject';
        const options = isSubjectRecord ? subjectOptions : (refOptions[field.name] ?? []);
        return (
          <Field key={field.name} field={field} error={errors[field.name]}>
            {field.kind === 'select' ? (
              <select
                {...shared}
                key={value}
                defaultValue={value}
                onChange={
                  field.name === 'subject_record_type'
                    ? (event) => changeSubjectType(event.target.value)
                    : undefined
                }
              >
                <option value="">{field.required ? 'Select…' : '—'}</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {enumLabel(option)}
                  </option>
                ))}
              </select>
            ) : field.kind === 'ref' ? (
              <select
                {...shared}
                key={`${value}:${options.length}`}
                defaultValue={value}
                disabled={disabled || (isSubjectRecord && !subjectType)}
              >
                <option value="">
                  {isSubjectRecord && !subjectType
                    ? 'Choose a subject record type first'
                    : loadingSubjects && isSubjectRecord
                      ? 'Loading…'
                      : 'Select…'}
                </option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.kind === 'textarea' ? (
              <textarea {...shared} defaultValue={value} rows={4} />
            ) : (
              <input
                {...shared}
                defaultValue={value}
                type={
                  field.kind === 'date'
                    ? 'date'
                    : field.kind === 'url'
                      ? 'url'
                      : field.kind === 'integer'
                        ? 'number'
                        : 'text'
                }
                {...(field.kind === 'integer' ? { min: 0, max: 9999, step: 1 } : {})}
              />
            )}
          </Field>
        );
      })}
      <SubmitButton primary disabled={disabled}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
