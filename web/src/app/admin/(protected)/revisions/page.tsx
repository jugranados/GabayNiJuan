import type { Metadata } from 'next';

import { RECORD_TYPES } from '@/domain/editorial/records';
import { can } from '@/domain/editorial/roles';
import { REVISION_ENTITY_TYPES } from '@/domain/enums';
import { RevisionList, staffLabeler } from '@/features/admin/components/RevisionList';
import { getEditorialForPage } from '@/server/editorial';

export const metadata: Metadata = { title: 'Revision history' };

export default async function RevisionsPage({ searchParams }: PageProps<'/admin/revisions'>) {
  const editorial = await getEditorialForPage();
  if (!editorial) return null;
  const raw = (await searchParams).type;
  const entityType = REVISION_ENTITY_TYPES.find((value) => value === raw);
  const [revisions, staff] = await Promise.all([
    editorial.revisions({ entityType, limit: 100 }),
    editorial.staff(),
  ]);
  return (
    <>
      <h1 className="text-3xl font-bold">Revision history</h1>
      <p className="mt-2 text-sm text-muted">
        Append-only. Every change to every record is kept here; nothing can be edited or deleted.
        Showing the latest 100.
      </p>
      <form method="get" className="card mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="r-type" className="mb-1 block text-sm font-semibold">
            Record type
          </label>
          <select id="r-type" name="type" defaultValue={entityType ?? ''} className="field">
            <option value="">All</option>
            {RECORD_TYPES.map((type) => (
              <option key={type.recordType} value={type.recordType}>
                {type.title}
              </option>
            ))}
            <option value="CLAIM_EVIDENCE">Claim evidence</option>
          </select>
        </div>
        <button type="submit" className="btn">
          Apply
        </button>
      </form>
      <div className="card mt-4">
        <RevisionList
          revisions={revisions}
          nameOf={staffLabeler(staff)}
          allowRaw={can(editorial.role, 'manage-roles')}
        />
      </div>
    </>
  );
}
