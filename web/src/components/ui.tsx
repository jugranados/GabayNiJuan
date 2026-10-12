import type { ReactNode } from 'react';

/** The one message for a section that has no records. Absence is not a finding. */
export const MISSING_RECORDS_MESSAGE = 'No records have been added for this section yet.';

export function MissingRecords({ message = MISSING_RECORDS_MESSAGE }: { message?: string }) {
  return <p className="text-muted">{message}</p>;
}

/** A titled page section. The heading id lets the section be linked and labelled. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="mt-10">
      <h2 id={`${id}-heading`} className="mb-3 text-xl font-bold">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Neutral message block: no results, no records, or a hint. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card bg-surface">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 space-y-3 text-muted">{children}</div> : null}
    </div>
  );
}

/** Shown on every public page while the site serves fictional development data. */
export function FictionalDataBanner() {
  return (
    <p className="border-b border-line bg-surface px-4 py-2 text-center text-sm">
      <strong>Development preview.</strong> Every person, office, organization and source shown
      here is fictional.
    </p>
  );
}

/** ISO calendar date rendered for people, with the machine-readable value kept. */
export function DateText({ date, children }: { date: string; children: ReactNode }) {
  return <time dateTime={date}>{children}</time>;
}
