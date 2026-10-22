import type { Metadata } from 'next';
import Link from 'next/link';

import { Section } from '@/components/ui';
import { NEUTRALITY_STATEMENT, pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Methodology',
  description:
    'How Gabay ni Juan chooses sources, records dates, reviews and publishes information, handles corrections, and stays politically neutral.',
  path: '/methodology',
});

export default function MethodologyPage() {
  return (
    <>
      <h1 className="text-3xl font-bold sm:text-4xl">Methodology</h1>
      <p className="mt-4">
        {NEUTRALITY_STATEMENT} It does not predict election results. This page explains how
        information gets here and how it is kept accurate.
      </p>

      <Section id="sources" title="Sources">
        <p>The strongest available evidence is used, and you can always open it.</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Primary official records</strong>: election office documents, court and tribunal
            records, legislative records and other government publications. Preferred whenever they
            exist.
          </li>
          <li>
            <strong>Direct attributed material</strong>: what a person, campaign or party says
            about itself. Labelled self-declared.
          </li>
          <li>
            <strong>Established secondary reporting</strong>: used to identify events, add context
            and locate primary records, not to replace them.
          </li>
          <li>
            <strong>Other sources</strong>: academic or specialist sources, depending on how
            transparent their methods are.
          </li>
        </ol>
        <p>
          A source type describes where a document comes from. It does not by itself prove every
          reading of that document.
        </p>
      </Section>

      <Section id="dates" title="Dates">
        <p>
          Four dates are kept apart: when something happened or applies, when a source was
          published, when it was retrieved, and when the statement was last reviewed. A record with
          a start date and no end date is shown as “no end date recorded”, never as still ongoing.
        </p>
      </Section>

      <Section id="candidacy" title="Candidacy wording">
        <p>
          Being discussed as a possible contender, declaring an intention to run, filing a
          certificate of candidacy and being an official candidate are different things. Each is
          shown by its own name and none is shortened to “candidate”.
        </p>
      </Section>

      <Section id="review" title="Review and publication">
        <p>
          Nothing is published automatically. A record is drafted, sources are attached, it is
          reviewed, and it is approved by a different person before it becomes public. Every change
          to published information requires a stated reason and is kept in a permanent revision
          history.
        </p>
      </Section>

      <Section id="corrections" title="Corrections">
        <p>
          Every profile and every claim has a “Report an error” link. A report is a request for
          review: it never changes the public record by itself. If a correction is made, the
          earlier version stays in the revision history. Information that is withdrawn is retracted,
          not deleted.
        </p>
      </Section>

      <Section id="missing" title="What is not here">
        <p>
          The directory only covers figures that have been added so far. A missing name, section or
          record means it has not been added yet, and nothing more.
        </p>
        <p>
          <Link href="/verification" className="link">
            How verification works
          </Link>
        </p>
      </Section>
    </>
  );
}
