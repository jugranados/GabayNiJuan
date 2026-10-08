import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { RevisionList } from '@/components/RevisionList';
import { fetchQueue, fetchRevisions } from '@/data/api';
import { useStaffLabels } from '@/data/hooks';
import { PUBLICATION_STATUSES, label } from '@/domain/enums';
import { RECORD_TYPES } from '@/domain/records';
import { ErrorBanner } from '@/components/ErrorBanner';

export function DashboardPage() {
  const queue = useQuery({ queryKey: ['queue', 'all'], queryFn: () => fetchQueue({}, 1000) });
  const revisions = useQuery({ queryKey: ['revisions', 'recent'], queryFn: () => fetchRevisions({ limit: 10 }) });
  const nameOf = useStaffLabels();
  const rows = queue.data ?? [];

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="help">Operational counts for editors. They are not rankings and are never shown to voters.</p>
      <ErrorBanner error={queue.error} />
      <div className="grid" aria-label="Counts by publication state">
        {PUBLICATION_STATUSES.map((s) => (
          <Link key={s} to={`/queue?status=${s}`} className="card stat">
            <strong>{rows.filter((r) => r.publication_status === s).length}</strong>
            {label(s)}
          </Link>
        ))}
      </div>
      <div className="card">
        <h2>Records</h2>
        <div className="row">
          {RECORD_TYPES.map((t) => (
            <span key={t.slug}>
              <Link to={`/queue?type=${t.recordType}`}>{t.title}</Link> ({rows.filter((r) => r.record_type === t.recordType).length}){' '}
              <Link to={`/records/${t.slug}/new`}>+ new</Link>
            </span>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Recent revisions</h2>
        <ErrorBanner error={revisions.error} />
        <RevisionList revisions={revisions.data ?? []} nameOf={nameOf} />
      </div>
    </div>
  );
}
