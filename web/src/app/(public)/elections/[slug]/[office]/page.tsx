import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';

import { MissingRecords, Section } from '@/components/ui';
import { philippineDate } from '@/domain/elections';
import { isUuid } from '@/domain/slug';
import {
  ElectionDateStatus,
  JsonLdScript,
  ParticipantGroups,
  ParticipationStatusGuide,
} from '@/features/elections/components/ElectionParts';
import { CANDIDACY_NOTE } from '@/features/elections/participationLabels';
import { ELECTIONS_PATH, electionOfficePath, electionPath } from '@/features/elections/paths';
import { OFFICE_LEVEL_LABELS } from '@/features/offices/officeLevelLabels';
import { directoryHref } from '@/features/politicians/directoryParams';
import { pageMetadata } from '@/lib/site';
import { breadcrumbJsonLd } from '@/lib/structuredData';
import { getAppConfig } from '@/server/config';
import { getRepositories } from '@/server/repositories';

export const revalidate = 60;
export const generateStaticParams = () => [];

const loadOffice = cache((electionSlug: string, officeSlug: string) =>
  getRepositories().elections.getElectionOfficeDetail(electionSlug, officeSlug),
);

export async function generateMetadata({
  params,
}: PageProps<'/elections/[slug]/[office]'>): Promise<Metadata> {
  const { slug, office } = await params;
  const detail = await loadOffice(slug, office);
  if (!detail) return { title: 'Office not found', robots: { index: false, follow: false } };
  return pageMetadata({
    title: `${detail.office.name} — ${detail.election.name}`,
    description: `People with documented participation records for ${detail.office.name} in ${detail.election.name}, grouped by the exact status of each record, with sources.`,
    path: electionOfficePath(detail.election.slug, detail.office.slug),
  });
}

/** Moves an address that uses a database id (election or office) to its slug URL, if both exist. */
async function redirectLegacyIds(electionRef: string, officeRef: string): Promise<void> {
  if (!isUuid(electionRef) && !isUuid(officeRef)) return;
  const repositories = getRepositories().elections;
  const [election, office] = await Promise.all([
    isUuid(electionRef)
      ? repositories.getElectionById(electionRef)
      : repositories.getElectionDetail(electionRef).then((detail) => detail?.election ?? null),
    isUuid(officeRef) ? repositories.getOfficeById(officeRef) : Promise.resolve(null),
  ]);
  const officeSlug = office?.slug ?? (isUuid(officeRef) ? undefined : officeRef);
  if (election && officeSlug) permanentRedirect(electionOfficePath(election.slug, officeSlug));
}

export default async function ElectionOfficePage({ params }: PageProps<'/elections/[slug]/[office]'>) {
  const { slug, office: officeRef } = await params;
  const detail = await loadOffice(slug, officeRef);
  if (!detail) {
    await redirectLegacyIds(slug, officeRef);
    notFound();
  }

  const { election, office, groups, participantCount } = detail;
  const today = philippineDate(new Date());
  const siteUrl = getAppConfig().siteUrl;
  const filters = { election: election.slug, office: office.slug };

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: 'Elections', url: `${siteUrl}${ELECTIONS_PATH}` },
          { name: election.name, url: `${siteUrl}${electionPath(election.slug)}` },
          { name: office.name, url: `${siteUrl}${electionOfficePath(election.slug, office.slug)}` },
        ])}
      />
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href={ELECTIONS_PATH} className="link">
          Elections
        </Link>{' '}
        /{' '}
        <Link href={electionPath(election.slug)} className="link">
          {election.name}
        </Link>
      </nav>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{office.name}</h1>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="font-semibold">Election</dt>
        <dd>
          <Link href={electionPath(election.slug)} className="link">
            {election.name}
          </Link>
          <span className="block text-muted">
            <ElectionDateStatus election={election} today={today} />
          </span>
        </dd>
        <dt className="font-semibold">Office level</dt>
        <dd>{OFFICE_LEVEL_LABELS[office.level]}</dd>
      </dl>

      <Section id="participants" title="Participants">
        <p className="border-l-4 border-ink bg-surface p-2">{CANDIDACY_NOTE}</p>
        {participantCount === 0 ? (
          <MissingRecords />
        ) : (
          <>
            <p className="text-sm text-muted">
              Grouped by the exact status of each person’s most recent record, then in alphabetical
              order. Order does not imply ranking. Every record links to its sources.
            </p>
            <ParticipantGroups groups={groups} />
          </>
        )}
      </Section>

      <Section id="directory" title="Find these records in the directory">
        <p className="text-sm text-muted">
          A directory status filter lists people with any record of that exact status for this
          office, including earlier records.
        </p>
        <ul className="flex flex-col gap-1">
          <li>
            <Link href={directoryHref({ filters })} className="link inline-flex min-h-11 items-center">
              View all participants
            </Link>
          </li>
          <li>
            <Link
              href={directoryHref({ filters: { ...filters, participationStatus: 'OFFICIAL_CANDIDATE' } })}
              className="link inline-flex min-h-11 items-center"
            >
              View official candidates
            </Link>
          </li>
          <li>
            <Link
              href={directoryHref({ filters: { ...filters, participationStatus: 'FILED_COC' } })}
              className="link inline-flex min-h-11 items-center"
            >
              View people who filed a certificate of candidacy
            </Link>
          </li>
        </ul>
      </Section>

      <Section id="about" title="About these records">
        <ParticipationStatusGuide />
      </Section>
    </>
  );
}
