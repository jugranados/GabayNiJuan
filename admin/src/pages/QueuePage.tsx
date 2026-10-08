import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { ErrorBanner } from '@/components/ErrorBanner';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchQueue, fetchStaff, type QueueFilters } from '@/data/api';
import { useStaffLabels } from '@/data/hooks';
import { PUBLICATION_STATUSES, label, type PublicationStatus } from '@/domain/enums';
import { RECORD_TYPES, recordTypeByType } from '@/domain/records';

export function QueuePage() {
  const [params, setParams] = useSearchParams();
  const nameOf = useStaffLabels();
  const filters: QueueFilters = {
    status: PUBLICATION_STATUSES.find((s) => s === params.get('status')) as PublicationStatus | undefined,
    recordType: params.get('type') ?? undefined,
    editorId: params.get('editor') ?? undefined,
    updatedSince: params.get('since') ? `${params.get('since')}T00:00:00Z` : undefined,
  };
  const queue = useQuery({ queryKey: ['queue', filters], queryFn: () => fetchQueue(filters) });
  const staff = useQuery({ queryKey: ['staff'], queryFn: fetchStaff });

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <h1>Work queue</h1>
      <form className="card row" aria-label="Queue filters" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="f-status">Publication status</label>
          <select id="f-status" value={params.get('status') ?? ''} onChange={(e) => set('status', e.target.value)}>
            <option value="">All</option>
            {PUBLICATION_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-type">Record type</label>
          <select id="f-type" value={params.get('type') ?? ''} onChange={(e) => set('type', e.target.value)}>
            <option value="">All</option>
            {RECORD_TYPES.map((t) => <option key={t.recordType} value={t.recordType}>{t.title}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-editor">Created by</label>
          <select id="f-editor" value={params.get('editor') ?? ''} onChange={(e) => set('editor', e.target.value)}>
            <option value="">Anyone</option>
            {staff.data?.map((s) => <option key={s.user_id} value={s.user_id}>{s.email}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-since">Updated since</label>
          <input id="f-since" type="date" value={params.get('since') ?? ''} onChange={(e) => set('since', e.target.value)} />
        </div>
      </form>
      <ErrorBanner error={queue.error} />
      <div className="card">
        {queue.isLoading && <p role="status">Loading…</p>}
        {queue.data?.length === 0 && <p className="muted">No records match.</p>}
        {!!queue.data?.length && (
          <table aria-label="Work queue">
            <thead>
              <tr><th>Type</th><th>Description</th><th>State</th><th>Last modified</th><th>Editor</th><th>Reviewer</th><th>Approver</th></tr>
            </thead>
            <tbody>
              {queue.data.map((row) => {
                const def = recordTypeByType(row.record_type);
                return (
                  <tr key={`${row.table_name}:${row.id}`}>
                    <td>{def?.singular ?? row.record_type}</td>
                    <td>{def ? <Link to={`/records/${def.slug}/${row.id}`}>{row.label ?? row.id}</Link> : row.label}</td>
                    <td><StatusBadge status={row.publication_status} /></td>
                    <td>{new Date(row.updated_at).toLocaleString()}</td>
                    <td>{nameOf(row.created_by)}</td>
                    <td>{nameOf(row.reviewed_by)}</td>
                    <td>{nameOf(row.approved_by)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
