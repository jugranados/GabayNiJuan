import type { Metadata } from 'next';

import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';
import { getAppConfig } from '@/server/config';

import './globals.css';

export function generateMetadata(): Metadata {
  const config = getAppConfig();
  return {
    metadataBase: new URL(config.siteUrl),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    // Fictional development data must never be indexed; indexing is an explicit opt-in.
    robots: config.indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
