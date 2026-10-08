import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useAuth } from '@/auth/AuthContext';
import { ErrorBanner } from '@/components/ErrorBanner';
import { RevisionList } from '@/components/RevisionList';
import { fetchRevisions } from '@/data/api';
import { useStaffLabels } from '@/data/hooks';
import { can } from '@/domain/roles';
import { RECORD_TYPES } from '@/domain/records';

export function RevisionsPage() {
  const { role } = useAuth();
  const [entityType, setEntityType] = useState('');
  const nameOf = useStaffLabels();
  const query = useQuery({ queryKey: ['revisions', entityType], queryFn: () => fetchRevisions({ entityType: entityType || undefined, limit: 100 }) });
  return (
    <div>
      <h1>Revision history</h1>
      <p className="help">Append-only. Every change to every record is kept here; nothing can be edited or deleted.</p>
      <div className="card row">
        <label htmlFor="r-type">Record type</label>
        <select id="r-type" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">All</option>
          {RECORD_TYPES.map((t) => <option key={t.recordType} value={t.recordType}>{t.title}</option>)}
          <option value="CLAIM_EVIDENCE">Claim evidence</option>
        </select>
      </div>
      <ErrorBanner error={query.error} />
      <div className="card">
        <RevisionList revisions={query.data ?? []} nameOf={nameOf} allowRaw={can(role, 'manage-roles')} />
      </div>
    </div>
  );
}
