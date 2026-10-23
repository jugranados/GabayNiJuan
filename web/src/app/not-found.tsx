import type { Metadata } from 'next';

import { NotFoundMessage, PublicShell } from '@/components/PublicShell';

export const metadata: Metadata = { title: 'Page not found' };

/**
 * An address that matches no route renders here, outside the (public) group's layout, so it
 * brings the public shell with it instead of Next.js' bare 404.
 */
export default function NotFound() {
  return (
    <PublicShell>
      <NotFoundMessage />
    </PublicShell>
  );
}
