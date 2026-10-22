import type { RefOption } from '@/domain/editorial/models';
import {
  EDITORIAL_RECORD_TYPES,
  type EditorialRecordType,
  type RecordTypeDef,
} from '@/domain/editorial/records';
import type { Editorial } from '@/server/editorial';

/**
 * Choices for every reference field of a record form, keyed by field name. A claim's
 * "subject record" choices depend on the subject record type already chosen.
 */
export async function loadFormRefOptions(
  editorial: Editorial,
  def: RecordTypeDef,
  values: Readonly<Record<string, string>>,
): Promise<Record<string, RefOption[]>> {
  const wanted = def.fields.flatMap((field): [string, EditorialRecordType][] => {
    if (field.kind !== 'ref') return [];
    const type =
      field.refType === '@subject'
        ? EDITORIAL_RECORD_TYPES.find((value) => value === values.subject_record_type)
        : field.refType;
    return type ? [[field.name, type]] : [];
  });
  const lists = await Promise.all(
    wanted.map(([, recordType]) => editorial.queue({ recordType }, 500)),
  );
  return Object.fromEntries(
    wanted.map(([name], index) => [
      name,
      (lists[index] ?? []).map(({ id, label }) => ({ id, label })),
    ]),
  );
}
