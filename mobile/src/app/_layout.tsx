import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { createAppRepositories } from '@/data/repositories/createAppRepositories';
import type { Repositories } from '@/domain/repositories';
import { isDataError } from '@/domain/validation/errors';
import { readAppConfig } from '@/shared/config/env';
import { RepositoriesProvider } from '@/shared/hooks/useRepositories';

type Bootstrap = { repositories: Repositories } | { configError: string };

function bootstrap(): Bootstrap {
  try {
    return { repositories: createAppRepositories(readAppConfig()) };
  } catch (error) {
    return { configError: error instanceof Error ? error.message : String(error) };
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Invalid data will stay invalid; retrying it only delays the explicit error.
        retry: (failureCount, error) => !isDataError(error) && failureCount < 2,
        staleTime: 5 * 60 * 1000,
      },
    },
  });
}

export default function RootLayout() {
  const [state] = useState(bootstrap);
  const [queryClient] = useState(createQueryClient);

  if ('configError' in state) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }} accessibilityRole="alert">
        <Text style={{ fontSize: 18, fontWeight: '600' }}>Configuration error</Text>
        <Text>{state.configError}</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoriesProvider repositories={state.repositories}>
        <StatusBar style="dark" />
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Gabay ni Juan' }} />
          <Stack.Screen name="politicians/index" options={{ title: 'Politicians' }} />
          <Stack.Screen name="politicians/[id]" options={{ title: 'Profile' }} />
          <Stack.Screen name="about" options={{ title: 'About the Data' }} />
        </Stack>
      </RepositoriesProvider>
    </QueryClientProvider>
  );
}
