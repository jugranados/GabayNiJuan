import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE_NAME } from '@/lib/site';

// The editorial area is never indexable. src/proxy.ts also sends X-Robots-Tag
// and robots.txt disallows /admin.
export const metadata: Metadata = {
  title: { default: 'Editorial', template: `%s | ${SITE_NAME} editorial` },
  robots: { index: false, follow: false, nocache: true },
};

// Always rendered per request: an editorial page must never be prerendered or shared between visitors.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 px-4 py-2">
          <p className="inline-flex min-h-11 items-center text-lg font-bold">{SITE_NAME} · Editorial</p>
          <Link href="/" className="link inline-flex min-h-11 items-center">
            Public site
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}
