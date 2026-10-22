import type { Metadata } from 'next';
import Link from 'next/link';

import { DateText, MissingRecords, Section } from '@/components/ui';
import { OFFICE_LEVELS } from '@/domain/enums';
import { ELECTIONS_PATH, electionPath } from '@/features/elections/paths';
import { OFFICE_LEVEL_LABELS } from '@/features/offices/officeLevelLabels';
import { DIRECTORY_PATH, directoryHref } from '@/features/politicians/directoryParams';
import { formatIsoDate } from '@/lib/dates';
import { NEUTRALITY_STATEMENT, pageMetadata, SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';
import { getRepositories } from '@/server/repositories';

export const revalidate = 300;

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${SITE_NAME} — Know the record. Check the sources.`,
    description: SITE_DESCRIPTION,
    path: '/',
  }),
  title: { absolute: `${SITE_NAME} — Know the record. Check the sources.` },
};

/**
 * Home: search, browse entry points and a plain statement of how the site
 * works. No feeds, rankings, trending lists or popularity metrics.
 */
export default async function HomePage() {
  const { elections } = await getRepositories().people.getDirectoryFilterOptions();
  // Soonest or most recent first, as on /elections; never by popularity.
  const byDate = [...elections].sort(
    (a, b) => (a.electionDate < b.electionDate ? 1 : a.electionDate > b.electionDate ? -1 : 0),
  );
  return (
    <>
      <h1 className="text-4xl font-bold sm:text-5xl">{SITE_NAME}</h1>
      <p className="mt-4 text-2xl font-semibold leading-snug">
        Know the record.
        <br />
        Check the sources.
        <br />
        Decide for yourself.
      </p>

      <form method="get" action={DIRECTORY_PATH} role="search" className="mt-8">
        <label htmlFor="home-q" className="mb-1 block font-semibold">
          Search politicians by name
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="home-q" name="q" type="search" maxLength={100} autoComplete="off" className="field flex-1" />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </div>
      </form>

      <Section id="browse" title="Browse the public record">
        <p>
          <Link href={DIRECTORY_PATH} className="btn">
            Browse all politicians
          </Link>
        </p>
        <p className="text-sm text-muted">
          The directory is always in alphabetical order. Order does not imply ranking.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="font-bold">By election</h3>
            {byDate.length === 0 ? (
              <MissingRecords message="No elections have been added yet." />
            ) : (
              <ul>
                {byDate.map((election) => (
                  <li key={election.id}>
                    <Link
                      href={electionPath(election.slug)}
                      className="link inline-flex min-h-11 items-center"
                    >
                      {election.name}
                    </Link>{' '}
                    <span className="text-sm text-muted">
                      <DateText date={election.electionDate}>
                        {formatIsoDate(election.electionDate)}
                      </DateText>
                    </span>
                  </li>
                ))}
                <li>
                  <Link href={ELECTIONS_PATH} className="link inline-flex min-h-11 items-center">
                    All elections and offices
                  </Link>
                </li>
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-bold">By office level</h3>
            <ul>
              {OFFICE_LEVELS.map((level) => (
                <li key={level}>
                  <Link
                    href={directoryHref({ filters: { officeLevel: level } })}
                    className="link inline-flex min-h-11 items-center"
                  >
                    {OFFICE_LEVEL_LABELS[level]} offices
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="verification" title="How verification works">
        <p>
          Every statement carries its own verification state, and every state links to the sources
          behind it. Verification describes the evidence for one statement. It is never a judgement
          of a person.
        </p>
        <p>
          <Link href="/verification" className="link">
            Read how verification works
          </Link>
        </p>
      </Section>

      <Section id="neutrality" title="Political neutrality">
        <p>
          {NEUTRALITY_STATEMENT} It does not predict election results. It shows documented records,
          where each one came from, and when it was last reviewed.
        </p>
      </Section>
    </>
  );
}
