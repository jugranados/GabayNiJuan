/** Kinds of published record a voter can report as incorrect. Mirrors the database enum correction_target_type. */
export const CORRECTION_TARGET_TYPES = [
  'PERSON',
  'CLAIM',
  'SOURCE',
  'ELECTION_PARTICIPATION',
  'OFFICE_TERM',
  'AFFILIATION',
  'EDUCATION',
  'POLICY_POSITION',
] as const;
export type CorrectionTargetType = (typeof CORRECTION_TARGET_TYPES)[number];

/**
 * A voter's report that a displayed record looks wrong. It is only ever a request for
 * editorial review; it never changes published data.
 */
export type CorrectionSubmission = {
  recordType: CorrectionTargetType;
  recordId: string;
  /** The claim the report is about, when it concerns a specific claim. */
  claimId?: string;
  description: string;
  sourceUrl?: string;
  contactEmail?: string;
};
