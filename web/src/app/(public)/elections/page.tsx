import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, Section } from '@/components/ui';
import { groupElectionsByStatus, philippineDate } from '@/domain/elections';
import { ElectionDateStatus } from '@/features/elections/components/ElectionParts';
import { ELECTION_STATUS_LABELS, electionPath } from '@/features/elections/paths';
import { pageMetadata } from '@/lib/site';
import { getRepositories } from '@/server/repositories';

export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: 'Elections',
  description:
    'Philippine elections with the offices contested in each and the documented participation records, each linked to its sources.',
  path: '/elections',
});

/**
 * Election index: upcoming, ongoing and completed elections, each by date. Never ordered by
 * popularity or interest.
 */
export default async function ElectionsPage() {
  const sections = groupElectionsByStatus(await getRepositories().elections.listElections());
  const today = philippineDate(new Date());
  return (
    <>
      <h1 className="text-3xl font-bold sm:text-4xl">Elections</h1>
      <p className="mt-3">
        Each election lists the offices contested in it and the people with documented
        participation records for each office.
      </p>
      <p className="text-sm text-muted">
        Upcoming and ongoing elections are listed soonest first, completed elections most recent
        first. Order does not imply importance or ranking.
      </p>

      {sections.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No elections have been added yet">
            <p>Elections will appear here once their records have been added and reviewed.</p>
          </EmptyState>
        </div>
      ) : (
        sections.map((section) => (
          <Section
            key={section.status}
            id={`elections-${section.status.toLowerCase()}`}
            title={ELECTION_STATUS_LABELS[section.status]}
          >
            <ul className="space-y-3">
              {section.items.map(({ election, officeCount }) => (
                <li key={election.id} className="card">
                  <h3 className="text-lg font-semibold">
                    <Link href={electionPath(election.slug)} className="link">
                      {election.name}
                    </Link>
                  </h3>
                  <p className="text-muted">
                    <ElectionDateStatus election={election} today={today} />
                  </p>
                  <p className="text-sm">
                    {officeCount === 0
                      ? 'No offices have been added for this election yet.'
                      : `${officeCount} ${officeCount === 1 ? 'office' : 'offices'} documented`}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        ))
      )}
    </>
  );
}
