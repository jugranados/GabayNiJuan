import { router } from 'expo-router';

import { DirectoryView } from '@/features/politicians/components/DirectoryView';

export default function PoliticiansScreen() {
  return (
    <DirectoryView
      onOpenPerson={(id) => router.push({ pathname: '/politicians/[id]', params: { id } })}
    />
  );
}
