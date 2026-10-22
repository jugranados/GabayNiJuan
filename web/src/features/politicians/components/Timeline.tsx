import type { ReactNode } from 'react';

export type TimelineEntry = {
  key: string;
  /** Years the record covers, e.g. "2019 – 2022". Omitted when no date is known. */
  period?: string;
  title: string;
  /** Neutral descriptor, e.g. "Elected". */
  detail?: string;
  /** Clarification such as "No end date recorded". */
  note?: string;
  children?: ReactNode;
};

/**
 * Vertical history, most recent first. Presentation only: it implies nothing
 * about whether moving between offices or organizations is good or bad.
 */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="space-y-4 border-l-2 border-line pl-4">
      {entries.map((entry) => (
        <li key={entry.key}>
          <p className="text-sm font-bold text-muted">{entry.period ?? 'Dates not recorded'}</p>
          <h3 className="text-lg font-semibold">{entry.title}</h3>
          {entry.detail ? <p className="text-sm text-muted">{entry.detail}</p> : null}
          {entry.note ? <p className="text-sm text-muted">{entry.note}</p> : null}
          {entry.children}
        </li>
      ))}
    </ol>
  );
}
