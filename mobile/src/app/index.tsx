import { router } from 'expo-router';

import { HomeView } from '@/features/politicians/components/HomeView';
import { useDirectoryUiStore } from '@/features/politicians/directoryStore';

export default function HomeScreen() {
  const applyPreset = useDirectoryUiStore((state) => state.applyPreset);
  return (
    <HomeView
      onBrowse={(preset) => {
        applyPreset(preset);
        router.push('/politicians');
      }}
      onOpenAbout={() => router.push('/about')}
    />
  );
}
