import { SOURCE_TIER_BY_TYPE, type SourceType } from '@/domain/enums';

const SOURCE_TYPE_LABELS: Readonly<Record<SourceType, string>> = {
  OFFICIAL_GOVERNMENT: 'Official government record',
  COURT_OR_TRIBUNAL: 'Court or tribunal record',
  LEGISLATIVE_RECORD: 'Legislative record',
  OFFICIAL_CANDIDATE: 'Official candidate or party material',
  NEWS: 'News report',
  ACADEMIC: 'Academic source',
  OTHER: 'Other source',
};

export function describeSourceType(type: SourceType): string {
  return `${SOURCE_TYPE_LABELS[type]} · Tier ${SOURCE_TIER_BY_TYPE[type]}`;
}
