import { label, type PublicationStatus } from '@/domain/enums';

export function StatusBadge({ status }: { status: PublicationStatus }) {
  return <span className={`badge ${status}`}>{label(status)}</span>;
}
