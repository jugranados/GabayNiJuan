import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';

import { useRefOptions } from '@/data/hooks';
import { label } from '@/domain/enums';
import { buildFormSchema, type FieldDef, type RecordTypeDef } from '@/domain/records';
import type { RecordRow } from '@/data/schemas';

type Values = Record<string, string>;

type Props = {
  def: RecordTypeDef;
  initial?: RecordRow;
  defaults?: Values;
  disabled?: boolean;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (values: Record<string, string | null>) => void;
};

function RefSelect({ field, recordType, register, disabled }: { field: FieldDef; recordType: string | undefined; register: ReturnType<typeof useForm<Values>>['register']; disabled?: boolean }) {
  const options = useRefOptions(recordType);
  return (
    <select id={field.name} disabled={disabled || !recordType} {...register(field.name)}>
      <option value="">{recordType ? 'Select…' : 'Choose a record type first'}</option>
      {(options.data ?? []).map((o) => (
        <option key={o.id} value={o.id}>
          {o.label ?? o.id}
        </option>
      ))}
    </select>
  );
}

export function RecordForm({ def, initial, defaults, disabled, submitLabel, busy, onSubmit }: Props) {
  const schema = useMemo(() => buildFormSchema(def), [def]);
  const defaultValues = useMemo(() => {
    const out: Values = {};
    for (const f of def.fields) {
      const raw = initial?.[f.name];
      out[f.name] = typeof raw === 'string' ? raw : (defaults?.[f.name] ?? '');
    }
    return out;
  }, [def, initial, defaults]);

  const { register, handleSubmit, control, formState } = useForm<Values>({
    defaultValues,
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
  });
  const subjectType = useWatch({ control, name: 'subject_record_type' });

  return (
    <form
      aria-label={`${def.singular} form`}
      onSubmit={handleSubmit((values) => onSubmit(values as unknown as Record<string, string | null>))}
    >
      {def.recordType === 'CLAIM' && (
        <p className="help">
          A claim is a precise factual proposition that Gabay ni Juan displays or relies upon. Example (fictional): “Juan
          Halimbawa served as Mayor of Sample City from 2022 to 2025.” Claims never judge a person’s character or fitness.
        </p>
      )}
      {def.fields.map((f) => {
        const error = formState.errors[f.name]?.message;
        return (
          <div key={f.name}>
            <label htmlFor={f.name}>
              {f.label}
              {f.required ? ' *' : ''}
            </label>
            {f.kind === 'select' && (
              <select id={f.name} disabled={disabled} {...register(f.name)}>
                <option value="">{f.required ? 'Select…' : '—'}</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {label(o)}
                  </option>
                ))}
              </select>
            )}
            {f.kind === 'ref' && (
              <RefSelect
                field={f}
                disabled={disabled}
                register={register}
                recordType={f.refType === '@subject' ? subjectType || undefined : f.refType}
              />
            )}
            {f.kind === 'textarea' && <textarea id={f.name} disabled={disabled} {...register(f.name)} />}
            {(f.kind === 'text' || f.kind === 'url') && <input id={f.name} disabled={disabled} type={f.kind === 'url' ? 'url' : 'text'} {...register(f.name)} />}
            {f.kind === 'date' && <input id={f.name} disabled={disabled} type="date" {...register(f.name)} />}
            {f.help && <div className="help">{f.help}</div>}
            {error && <div className="error" role="alert">{String(error)}</div>}
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 12 }}>
        <button type="submit" disabled={disabled || busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
