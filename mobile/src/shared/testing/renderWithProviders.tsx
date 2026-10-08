import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { createMockRepositories } from '@/data/repositories/mockRepositories';
import type { Repositories } from '@/domain/repositories';
import { RepositoriesProvider } from '@/shared/hooks/useRepositories';

/** Test helper: renders UI with a fresh query cache and (by default) the fictional mock repositories. */
export function renderWithProviders(
  ui: ReactElement,
  repositories: Repositories = createMockRepositories(),
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <RepositoriesProvider repositories={repositories}>{ui}</RepositoriesProvider>
    </QueryClientProvider>,
  );
}
