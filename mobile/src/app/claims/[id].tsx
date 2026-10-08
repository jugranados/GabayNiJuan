import { router, useLocalSearchParams } from 'expo-router';

import { ErrorView } from '@/components/states';
import { Body, LoadingView, Screen } from '@/components/ui';
import { ClaimDetailView } from '@/features/sources/components/ClaimDetailView';
import { useClaimDetail } from '@/features/sources/hooks/queries';

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: detail, error, isPending, refetch } = useClaimDetail(id);

  if (isPending) return <LoadingView />;
  if (error) return <ErrorView error={error} onRetry={() => void refetch()} />;
  if (!detail) {
    return (
      <Screen>
        <Body>This claim could not be found.</Body>
      </Screen>
    );
  }
  return (
    <ClaimDetailView
      detail={detail}
      onOpenSubject={(personId) =>
        router.push({ pathname: '/politicians/[id]', params: { id: personId } })
      }
    />
  );
}
