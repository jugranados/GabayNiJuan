import type { Metadata } from 'next';
import Link from 'next/link';

import { RECORD_TYPES } from '@/domain/editorial/records';
import { enumLabel, PUBLICATION_STATUSES } from '@/domain/enums';
import { RevisionList, staffLabeler } from '@/features/admin/components/RevisionList';
import { adminPaths } from '@/features/admin/paths';
import { getEditorialForPage } from '@/server/editorial';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const editorial = await getEditorialForPage();
  if (!editorial) return null;
  const [rows, revisions, staff, openCorrections] = await Promise.all([
    editorial.queue({}, 1000),
    editorial.revisions({ limit: 10 }),
    editorial.staff(),
    editorial.corrections('SUBMITTED'),
  ]);
  return (
    <>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted">
        Operational counts for editors. They are not rankings and are never shown to voters.
      </p>

      <ul aria-label="Counts by publication state" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PUBLICATION_STATUSES.map((status) => (
          <li key={status}>
            <Link href={`${adminPaths.queue}?status=${status}`} className="card block no-underline">
              <strong className="block text-2xl">
                {rows.filter((row) => row.status === status).length}
              </strong>
              {enumLabel(status)}
            </Link>
          </li>
        ))}
        <li>
          <Link href={adminPaths.corrections} className="card block no-underline">
            <strong className="block text-2xl">{openCorrections.length}</strong>
            New correction requests
          </Link>
        </li>
      </ul>

      <section aria-labelledby="records-heading" className="card mt-6">
        <h2 id="records-heading" className="text-xl font-bold">
          Records
        </h2>
        <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {RECORD_TYPES.map((type) => (
            <li key={type.slug} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1">
              <span>
                <Link href={`${adminPaths.queue}?type=${type.recordType}`} className="link">
                  {type.title}
                </Link>{' '}
                ({rows.filter((row) => row.recordType === type.recordType).length})
              </span>
              <Link href={adminPaths.newRecord(type.slug)} className="link text-sm">
                New {type.singular}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recent-heading" className="card mt-6">
        <h2 id="recent-heading" className="mb-3 text-xl font-bold">
          Recent revisions
        </h2>
        <RevisionList revisions={revisions} nameOf={staffLabeler(staff)} />
      </section>
    </>
  );
}
