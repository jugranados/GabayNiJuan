import { useLocalSearchParams } from 'expo-router';

import { Body, ErrorView, LoadingView, Screen } from '@/components/ui';
import { PersonProfileView } from '@/features/politicians/components/PersonProfileView';
import { usePersonProfile } from '@/features/politicians/hooks/queries';

export default function PoliticianDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profile, error, isPending } = usePersonProfile(id);

  if (isPending) return <LoadingView />;
  if (error) return <ErrorView error={error} />;
  if (!profile) {
    return (
      <Screen>
        <Body>This profile could not be found.</Body>
      </Screen>
    );
  }
  return <PersonProfileView profile={profile} />;
}
