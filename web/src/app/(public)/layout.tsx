import Link from 'next/link';

import { FictionalDataBanner } from '@/components/ui';
import { NEUTRALITY_STATEMENT, SITE_NAME } from '@/lib/site';
import { getAppConfig } from '@/server/config';

const NAV = [
  ['/politicians', 'Politicians'],
  ['/verification', 'How verification works'],
  ['/methodology', 'Methodology'],
] as const;

/**
 * Shell for every voter-facing page. It reads no cookies and no session:
 * public pages never depend on who is signed in to /admin.
 */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  const showFictionalBanner = !getAppConfig().indexable;
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to main content
      </a>
      {showFictionalBanner ? <FictionalDataBanner /> : null}
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 px-4 py-2">
          <Link href="/" className="inline-flex min-h-11 items-center text-lg font-bold">
            {SITE_NAME}
          </Link>
          <nav aria-label="Main">
            <ul className="flex flex-wrap gap-x-5">
              {NAV.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="link inline-flex min-h-11 items-center">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-4xl space-y-1 px-4 py-6 text-sm text-muted">
          <p>{NEUTRALITY_STATEMENT}</p>
          <p>
            Information that is missing here has not been added yet. It is not a statement about any
            person.
          </p>
        </div>
      </footer>
    </>
  );
}
