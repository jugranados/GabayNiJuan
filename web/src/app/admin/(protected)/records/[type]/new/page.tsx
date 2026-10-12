import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { recordTypeBySlug } from '@/domain/editorial/records';
import { isUuid } from '@/domain/slug';
import { createRecordAction } from '@/features/admin/actions';
import { RecordForm } from '@/features/admin/components/RecordForm';
import { loadFormRefOptions } from '@/features/admin/refOptions';
import { getEditorialForPage } from '@/server/editorial';

export const metadata: Metadata = { title: 'New record' };

export default async function NewRecordPage({
  params,
  searchParams,
}: PageProps<'/admin/records/[type]/new'>) {
  const editorial = await getEditorialForPage();
  if (!editorial) return null;
  const def = recordTypeBySlug((await params).type);
  if (!def) notFound();

  // "New … for this person" links prefill the person.
  const person = (await searchParams).person;
  const initial: Record<string, string> = {};
  if (typeof person === 'string' && isUuid(person)) {
    if (def.fields.some((field) => field.name === 'person_id')) initial.person_id = person;
    if (def.recordType === 'CLAIM') initial.subject_person_id = person;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">New {def.singular}</h1>
      <p className="mt-2 text-sm text-muted">
        Saved as a draft. Nothing is public until it has been reviewed, approved and published.
      </p>
      <div className="card mt-4">
        <RecordForm
          def={def}
          action={createRecordAction.bind(null, def.slug)}
          initial={initial}
          refOptions={await loadFormRefOptions(editorial, def, initial)}
          submitLabel="Save draft"
        />
      </div>
    </div>
  );
}
