import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/shared/hooks/useRepositories';

export const claimKeys = {
  all: ['claims'] as const,
  detail: (id: string) => [...claimKeys.all, 'detail', id] as const,
};

export function useClaimDetail(id: string) {
  const { claims } = useRepositories();
  return useQuery({
    queryKey: claimKeys.detail(id),
    queryFn: () => claims.getClaimDetail(id),
  });
}
