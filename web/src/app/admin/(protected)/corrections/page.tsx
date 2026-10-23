import type { Metadata } from 'next';
import Link from 'next/link';

import { CORRECTION_STATUSES, enumLabel } from '@/domain/enums';
import { adminPaths, formatTimestamp } from '@/features/admin/paths';
import { getEditorialForPage } from '@/server/editorial';

export const metadata: Metadata = { title: 'Correction requests' };

export default async function CorrectionsPage({ searchParams }: PageProps<'/admin/corrections'>) {
  const editorial = await getEditorialForPage();
  if (!editorial) return null;
  const raw = (await searchParams).status;
  const status = CORRECTION_STATUSES.find((value) => value === raw);
  const requests = await editorial.corrections(status);
  return (
    <>
      <h1 className="text-3xl font-bold">Correction requests</h1>
      <p className="mt-2 text-sm text-muted">
        Private. Submissions never change published data. Accepting a request only records the
        decision; fix the record through the normal draft → review → approval → publish flow.
      </p>
      <form method="get" className="card mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="c-status" className="mb-1 block text-sm font-semibold">
            Status
          </label>
          <select id="c-status" name="status" defaultValue={status ?? ''} className="field">
            <option value="">All</option>
            {CORRECTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {enumLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn">
          Apply
        </button>
      </form>
      {requests.length === 0 ? (
        <p className="card mt-4 text-muted">No correction requests.</p>
      ) : (
        <div className="relative mt-4 overflow-x-auto">
          <table aria-label="Correction requests" className="data-table">
            <thead>
              <tr>
                <th scope="col">Report</th>
                <th scope="col">About</th>
                <th scope="col">Status</th>
                <th scope="col">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link href={adminPaths.correction(request.id)} className="link">
                      {request.description.slice(0, 90)}
                    </Link>
                  </td>
                  <td>{enumLabel(request.recordType)}</td>
                  <td>{enumLabel(request.status)}</td>
                  <td>{formatTimestamp(request.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
