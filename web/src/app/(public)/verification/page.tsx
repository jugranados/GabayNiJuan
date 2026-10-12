import type { Metadata } from 'next';
import Link from 'next/link';

import { Section } from '@/components/ui';
import { VERIFICATION_STATUSES } from '@/domain/enums';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';
import { VERIFICATION_STATE_INFO } from '@/features/sources/verificationStates';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'How verification works',
  description:
    'What each verification state means. A state describes the evidence for one statement; it is never a rating of a person.',
  path: '/verification',
});

export default function VerificationPage() {
  return (
    <>
      <h1 className="text-3xl font-bold sm:text-4xl">How verification works</h1>
      <p className="mt-4">
        Each statement in a profile carries its own verification state. A state describes the
        evidence for that one statement, not the person. There is no overall score, rating or
        “verified” label for anyone.
      </p>

      <Section id="states" title="Verification states">
        <dl className="space-y-3">
          {VERIFICATION_STATUSES.map((status) => (
            <div key={status} className="card">
              <dt>
                <VerificationBadge status={status} />
              </dt>
              <dd className="mt-2">{VERIFICATION_STATE_INFO[status].description}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="reading" title="Reading a record">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Every record links to its claim, and every claim links to its sources. Open “View
            evidence and sources” to read the original document yourself.
          </li>
          <li>
            When credible sources disagree, the statement is marked disputed and every source is
            shown, supporting and conflicting.
          </li>
          <li>A record with no source attached is shown as unverified, never as established fact.</li>
          <li>
            An empty section means records have not been added yet. It never means there is nothing
            to find.
          </li>
        </ul>
        <p>
          <Link href="/methodology" className="link">
            Read the methodology
          </Link>
        </p>
      </Section>
    </>
  );
}
