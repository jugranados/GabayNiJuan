import type { OfficeTermStatus } from '@/domain/enums';

export const OFFICE_TERM_STATUS_LABELS: Readonly<Record<OfficeTermStatus, string>> = {
  HELD: 'Held',
  ACTING: 'Acting',
  APPOINTED: 'Appointed',
  ELECTED: 'Elected',
};
