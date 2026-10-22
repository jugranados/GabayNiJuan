import { SOURCE_TIER_BY_TYPE, type SourceType } from '@/domain/enums';

export const SOURCE_TYPE_LABELS: Readonly<Record<SourceType, string>> = {
  OFFICIAL_GOVERNMENT: 'Official government record',
  COURT_OR_TRIBUNAL: 'Court or tribunal record',
  LEGISLATIVE_RECORD: 'Legislative record',
  OFFICIAL_CANDIDATE: 'Official candidate or party material',
  NEWS: 'News report',
  ACADEMIC: 'Academic source',
  OTHER: 'Other source',
};

/** The kind of source and its tier in docs/SOURCE_POLICY.md. A type describes origin; it proves nothing by itself. */
export function describeSourceType(type: SourceType): string {
  return `${SOURCE_TYPE_LABELS[type]} · Tier ${SOURCE_TIER_BY_TYPE[type]}`;
}

/** Host name shown beside an external link so the destination is clear before following it. */
export function linkHost(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}
