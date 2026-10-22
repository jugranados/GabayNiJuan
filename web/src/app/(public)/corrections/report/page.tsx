import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/ui';
import { CORRECTION_NOTICE } from '@/domain/corrections';
import { ReportErrorForm } from '@/features/corrections/ReportErrorForm';
import { resolveCorrectionTarget } from '@/features/corrections/target';
import { correctionsAvailable } from '@/server/repositories';

export const metadata: Metadata = {
  title: 'Report an error',
  description: 'Tell reviewers about information that looks incorrect.',
  robots: { index: false, follow: false },
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ReportErrorPage({ searchParams }: PageProps<'/corrections/report'>) {
  const params = await searchParams;
  const type = first(params.type);
  const id = first(params.id);
  const target = await resolveCorrectionTarget(type, id);

  return (
    <>
      <h1 className="text-3xl font-bold sm:text-4xl">Report an error</h1>
      {!target || !type || !id ? (
        <div className="mt-6">
          <EmptyState title="This report could not be started">
            <p>
              Open a profile or a claim and use its “Report an error” link, so reviewers know which
              record you mean.
            </p>
            <p>
              <Link href="/politicians" className="link">
                Browse all politicians
              </Link>
            </p>
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="mt-4">
            About:{' '}
            <Link href={target.backHref} className="link">
              {target.label}
            </Link>
          </p>
          <p className="mt-2 text-muted">{CORRECTION_NOTICE}</p>
          <div className="mt-6">
            {correctionsAvailable() ? (
              <ReportErrorForm type={type} id={id} />
            ) : (
              <EmptyState title="Reports are not available in this preview">
                <p>
                  This preview shows fictional development data and is not connected to the
                  editorial review queue, so reports cannot be sent from it.
                </p>
              </EmptyState>
            )}
          </div>
        </>
      )}
    </>
  );
}
