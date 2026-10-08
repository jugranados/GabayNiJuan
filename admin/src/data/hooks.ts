import { useQuery } from '@tanstack/react-query';

import { fetchQueue, fetchStaff } from './api';

/** user id -> email, for showing editor/reviewer/approver names. Falls back to a short id. */
export function useStaffLabels() {
  const query = useQuery({ queryKey: ['staff'], queryFn: fetchStaff, staleTime: 60_000 });
  const map = new Map((query.data ?? []).map((s) => [s.user_id, s.email] as const));
  return (id: string | null | undefined): string => {
    if (!id) return '—';
    if (id.startsWith('system:')) return id;
    return map.get(id) ?? `${id.slice(0, 8)}…`;
  };
}

export function useRefOptions(recordType: string | undefined) {
  return useQuery({
    queryKey: ['ref-options', recordType],
    queryFn: () => fetchQueue({ recordType }, 500),
    enabled: Boolean(recordType),
  });
}
