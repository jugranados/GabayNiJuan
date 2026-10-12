import Link from 'next/link';

import type { DirectoryEntry } from '@/domain/models/directory';
import { AFFILIATION_TYPE_LABELS } from '@/features/affiliations/affiliationLabels';
import { PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';
import { politicianPath } from '@/features/politicians/paths';
import { formatYearRange } from '@/lib/dates';

const MAX_PARTICIPATIONS_SHOWN = 2;

/** Describes an affiliation record by its dates only; never implies it is still true beyond them. */
export function describeAffiliation(entry: DirectoryEntry): string | undefined {
  const a = entry.affiliation;
  if (!a) return undefined;
  const since = formatYearRange(a.startDate);
  return `${a.organizationName} (${AFFILIATION_TYPE_LABELS[a.affiliationType].toLowerCase()})${since ? ` · ${since}` : ''}`;
}

/**
 * Directory entry. Shows only neutral documented fields: name, election and
 * office context with participation status, and one dated affiliation record
 * when one is current. No counts, scores or other statistics.
 */
export function PoliticianCard({ entry }: { entry: DirectoryEntry }) {
  const shown = entry.participations.slice(0, MAX_PARTICIPATIONS_SHOWN);
  const hidden = entry.participations.length - shown.length;
  const affiliation = describeAffiliation(entry);
  return (
    <li className="card">
      <h2 className="text-lg font-bold">
        <Link href={politicianPath(entry.slug)} className="link">
          {entry.displayName}
        </Link>
      </h2>
      {shown.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {shown.map((p) => (
            <li key={`${p.electionName}|${p.officeName}`}>
              <span>{p.officeName}</span>
              <span className="block text-sm text-muted">
                {p.electionName} · {PARTICIPATION_STATUS_INFO[p.status].label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {hidden > 0 ? (
        <p className="text-sm text-muted">
          +{hidden} more election {hidden === 1 ? 'participation' : 'participations'}
        </p>
      ) : null}
      {affiliation ? <p className="mt-1 text-sm text-muted">Affiliation: {affiliation}</p> : null}
    </li>
  );
}
