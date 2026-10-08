import { router, useLocalSearchParams } from 'expo-router';

import { Body, ErrorView, LoadingView, Screen } from '@/components/ui';
import { ClaimDetailView } from '@/features/sources/components/ClaimDetailView';
import { useClaimDetail } from '@/features/sources/hooks/queries';

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: detail, error, isPending } = useClaimDetail(id);

  if (isPending) return <LoadingView />;
  if (error) return <ErrorView error={error} />;
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
