import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';

import { MissingRecords, Section } from '@/components/ui';
import type { ElectionParticipationStatus } from '@/domain/enums';
import { philippineDate } from '@/domain/elections';
import { isUuid } from '@/domain/slug';
import {
  ElectionDateStatus,
  JsonLdScript,
  ParticipationStatusGuide,
  StatusCounts,
} from '@/features/elections/components/ElectionParts';
import { PARTICIPATION_STATUS_INFO, PARTICIPATION_STATUS_ORDER } from '@/features/elections/participationLabels';
import { ELECTIONS_PATH, electionOfficePath, electionPath } from '@/features/elections/paths';
import { OFFICE_LEVEL_LABELS } from '@/features/offices/officeLevelLabels';
import { directoryHref } from '@/features/politicians/directoryParams';
import { pageMetadata } from '@/lib/site';
import { breadcrumbJsonLd, electionEventJsonLd } from '@/lib/structuredData';
import { getAppConfig } from '@/server/config';
import { getRepositories } from '@/server/repositories';

// Rendered on first request, then cached briefly; publishing in /admin revalidates at once.
export const revalidate = 60;
export const generateStaticParams = () => [];

const loadElection = cache((slug: string) => getRepositories().elections.getElectionDetail(slug));

export async function generateMetadata({ params }: PageProps<'/elections/[slug]'>): Promise<Metadata> {
  const detail = await loadElection((await params).slug);
  if (!detail) return { title: 'Election not found', robots: { index: false, follow: false } };
  const { election } = detail;
  // Descriptive only: what the page lists, never a conclusion or a call to action.
  return pageMetadata({
    title: election.name,
    description: `Offices contested in ${election.name} and the documented participation records for each, with the exact status of each record and its sources.`,
    path: electionPath(election.slug),
  });
}

export default async function ElectionPage({ params }: PageProps<'/elections/[slug]'>) {
  const { slug } = await params;
  const detail = await loadElection(slug);
  if (!detail) {
    // An address that uses the database id moves to the slug URL.
    if (isUuid(slug)) {
      const election = await getRepositories().elections.getElectionById(slug);
      if (election) permanentRedirect(electionPath(election.slug));
    }
    notFound();
  }

  const { election, offices } = detail;
  const today = philippineDate(new Date());
  const totals: Partial<Record<ElectionParticipationStatus, number>> = {};
  for (const { statusCounts } of offices) {
    for (const status of PARTICIPATION_STATUS_ORDER) {
      if (statusCounts[status]) totals[status] = (totals[status] ?? 0) + statusCounts[status];
    }
  }
  const participantTotal = offices.reduce((sum, office) => sum + office.participantCount, 0);
  const siteUrl = getAppConfig().siteUrl;

  return (
    <>
      <JsonLdScript
        data={[
          electionEventJsonLd(election, `${siteUrl}${electionPath(election.slug)}`),
          breadcrumbJsonLd([
            { name: 'Elections', url: `${siteUrl}${ELECTIONS_PATH}` },
            { name: election.name, url: `${siteUrl}${electionPath(election.slug)}` },
          ]),
        ]}
      />
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href={ELECTIONS_PATH} className="link">
          Elections
        </Link>
      </nav>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{election.name}</h1>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="font-semibold">Date and status</dt>
        <dd>
          <ElectionDateStatus election={election} today={today} />
        </dd>
        <dt className="font-semibold">Country</dt>
        <dd>Philippines</dd>
      </dl>

      <Section id="offices" title="Offices">
        {offices.length === 0 ? (
          <MissingRecords />
        ) : (
          <>
            <p className="text-sm text-muted">
              Listed in ballot order. The number beside each status counts people by their most
              recent documented record for that office.
            </p>
            <ul className="space-y-3">
              {offices.map(({ office, participantCount, statusCounts }) => (
                <li key={office.id} className="card">
                  <h3 className="text-lg font-semibold">
                    <Link href={electionOfficePath(election.slug, office.slug)} className="link">
                      {office.name}
                    </Link>
                  </h3>
                  <p className="text-sm text-muted">{OFFICE_LEVEL_LABELS[office.level]} office</p>
                  {participantCount === 0 ? (
                    <MissingRecords />
                  ) : (
                    <StatusCounts counts={statusCounts} />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section id="participation" title="Participation summary">
        {participantTotal === 0 ? (
          <MissingRecords />
        ) : (
          <>
            <p>
              People with documented participation records in this election, by the exact status
              of their most recent record. These are counts of records, not a measure of support.
            </p>
            <ul className="space-y-1">
              {PARTICIPATION_STATUS_ORDER.filter((status) => totals[status]).map((status) => (
                <li key={status}>
                  <Link
                    href={directoryHref({
                      filters: { election: election.slug, participationStatus: status },
                    })}
                    className="link inline-flex min-h-11 items-center"
                  >
                    {PARTICIPATION_STATUS_INFO[status].groupHeading}: {totals[status]}
                  </Link>
                </li>
              ))}
            </ul>
            <p>
              <Link href={directoryHref({ filters: { election: election.slug } })} className="btn">
                View all participants in the directory
              </Link>
            </p>
          </>
        )}
      </Section>

      <Section id="about" title="About this information">
        <p>
          The election date, status and the offices listed here are recorded by editors from
          official election records, preferably from COMELEC. Each participation record is a
          separate claim with its own sources: a public declaration, a filed certificate of
          candidacy and an official list of candidates are different records, and one is never
          inferred from another.
        </p>
        <ParticipationStatusGuide />
        <p>
          <Link href="/methodology" className="link">
            Methodology
          </Link>{' '}
          ·{' '}
          <Link href="/verification" className="link">
            How verification works
          </Link>
        </p>
      </Section>
    </>
  );
}
