import type { Metadata } from 'next';
import Link from 'next/link';

import { EDITORIAL_RECORD_TYPES, RECORD_TYPES, recordTypeByType } from '@/domain/editorial/records';
import { enumLabel, PUBLICATION_STATUSES } from '@/domain/enums';
import { staffLabeler } from '@/features/admin/components/RevisionList';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { adminPaths, formatTimestamp } from '@/features/admin/paths';
import { getEditorialForPage } from '@/server/editorial';

export const metadata: Metadata = { title: 'Work queue' };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The work queue. Filters live in the URL, so a filtered view can be bookmarked or shared with a colleague. */
export default async function QueuePage({ searchParams }: PageProps<'/admin/queue'>) {
  const editorial = await getEditorialForPage();
  if (!editorial) return null;
  const params = await searchParams;
  const status = PUBLICATION_STATUSES.find((value) => value === first(params.status));
  const recordType = EDITORIAL_RECORD_TYPES.find((value) => value === first(params.type));
  const editor = first(params.editor);
  const since = first(params.since);
  const validSince = since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : undefined;

  const staff = await editorial.staff();
  const editorId = staff.find((member) => member.userId === editor)?.userId;
  const rows = await editorial.queue({
    status,
    recordType,
    editorId,
    updatedSince: validSince ? `${validSince}T00:00:00Z` : undefined,
  });
  const nameOf = staffLabeler(staff);

  return (
    <>
      <h1 className="text-3xl font-bold">Work queue</h1>
      <form method="get" aria-label="Queue filters" className="card mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="f-status" className="mb-1 block text-sm font-semibold">
            Publication status
          </label>
          <select id="f-status" name="status" defaultValue={status ?? ''} className="field">
            <option value="">All</option>
            {PUBLICATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {enumLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-type" className="mb-1 block text-sm font-semibold">
            Record type
          </label>
          <select id="f-type" name="type" defaultValue={recordType ?? ''} className="field">
            <option value="">All</option>
            {RECORD_TYPES.map((type) => (
              <option key={type.recordType} value={type.recordType}>
                {type.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-editor" className="mb-1 block text-sm font-semibold">
            Created by
          </label>
          <select id="f-editor" name="editor" defaultValue={editorId ?? ''} className="field">
            <option value="">Anyone</option>
            {staff.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-since" className="mb-1 block text-sm font-semibold">
            Updated since
          </label>
          <input id="f-since" name="since" type="date" defaultValue={validSince ?? ''} className="field" />
        </div>
        <div className="flex items-end gap-3">
          <button type="submit" className="btn">
            Apply
          </button>
          <Link href={adminPaths.queue} className="link inline-flex min-h-11 items-center">
            Clear
          </Link>
        </div>
      </form>

      <p role="status" className="mt-4 text-sm text-muted">
        {rows.length} {rows.length === 1 ? 'record' : 'records'} · most recently changed first
        {rows.length === 200 ? ' · showing the first 200; narrow the filters to see others' : ''}
      </p>
      {/* `relative` on the scroll box keeps the status badges' absolutely positioned screen-reader
          text inside it, so the page itself never scrolls sideways on a phone. */}
      {rows.length === 0 ? (
        <p className="card mt-2 text-muted">No records match.</p>
      ) : (
        <div className="relative mt-2 overflow-x-auto">
          <table aria-label="Work queue" className="data-table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Description</th>
                <th scope="col">State</th>
                <th scope="col">Last modified</th>
                <th scope="col">Editor</th>
                <th scope="col">Submitted by</th>
                <th scope="col">Approver</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const def = recordTypeByType(row.recordType);
                return (
                  <tr key={`${row.recordType}:${row.id}`}>
                    <td>{def?.singular ?? enumLabel(row.recordType)}</td>
                    <td>
                      {def ? (
                        <Link href={adminPaths.record(def.slug, row.id)} className="link">
                          {row.label}
                        </Link>
                      ) : (
                        row.label
                      )}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>{formatTimestamp(row.updatedAt)}</td>
                    <td>{nameOf(row.createdBy)}</td>
                    <td>{nameOf(row.reviewedBy)}</td>
                    <td>{nameOf(row.approvedBy)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
