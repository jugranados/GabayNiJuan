import { enumLabel, type PublicationStatus } from '@/domain/enums';

/** Publication state as text. One neutral style: the word carries the meaning, not a colour. */
export function StatusBadge({ status }: { status: PublicationStatus }) {
  return (
    <span className="inline-flex items-center rounded border border-ink px-2 py-0.5 text-sm font-bold">
      <span className="sr-only">Publication state: </span>
      {enumLabel(status)}
    </span>
  );
}
