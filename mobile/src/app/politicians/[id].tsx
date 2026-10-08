import { router, useLocalSearchParams } from 'expo-router';

import { ErrorView } from '@/components/states';
import { Body, LoadingView, Screen } from '@/components/ui';
import { formatPersonName } from '@/domain/models/person';
import { PersonProfileView } from '@/features/politicians/components/PersonProfileView';
import { usePersonProfile } from '@/features/politicians/hooks/queries';

export default function PoliticianDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profile, error, isPending, refetch } = usePersonProfile(id);

  if (isPending) return <LoadingView />;
  if (error) return <ErrorView error={error} onRetry={() => void refetch()} />;
  if (!profile) {
    return (
      <Screen>
        <Body>This profile could not be found.</Body>
      </Screen>
    );
  }
  return (
    <PersonProfileView
      profile={profile}
      onOpenClaim={(claimId) => router.push({ pathname: '/claims/[id]', params: { id: claimId } })}
      onReportError={() =>
        router.push({
          pathname: '/report-error',
          params: {
            recordType: 'PERSON',
            recordId: profile.person.id,
            label: formatPersonName(profile.person),
          },
        })
      }
    />
  );
}
