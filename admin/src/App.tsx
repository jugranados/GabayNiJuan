import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth, RequireCapability } from '@/auth/guards';
import { Layout } from '@/components/Layout';
import { CorrectionsPage } from '@/pages/CorrectionsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { QueuePage } from '@/pages/QueuePage';
import { NewRecordPage, RecordPage } from '@/pages/RecordPage';
import { RevisionsPage } from '@/pages/RevisionsPage';
import { RolesPage } from '@/pages/RolesPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="queue" element={<QueuePage />} />
                <Route path="records/:slug/new" element={<NewRecordPage />} />
                <Route path="records/:slug/:id" element={<RecordPage />} />
                <Route path="corrections" element={<CorrectionsPage />} />
                <Route path="corrections/:id" element={<CorrectionsPage />} />
                <Route path="revisions" element={<RevisionsPage />} />
                <Route path="roles" element={<RequireCapability capability="manage-roles"><RolesPage /></RequireCapability>} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
