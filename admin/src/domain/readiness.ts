import type { VerificationStatus } from './enums';

/** Shape returned by public.claim_readiness(). */
export type Readiness = {
  verification_status: VerificationStatus;
  total: number;
  supporting: number;
  contradicting: number;
  tier1_supporting: number;
  distinct_publishers: number;
  unpublished_sources: number;
  /** The database's own verdict (same function the publish trigger uses); null = consistent. */
  error: string | null;
};

export type ChecklistItem = { label: string; met: boolean };

/**
 * Display-only checklist. The verdict that gates workflow is `readiness.error`, computed by
 * the database; this list only explains it to the editor. It is a workflow assistant, not a
 * score of the person.
 */
export function buildChecklist(r: Readiness): ChecklistItem[] {
  const s = r.verification_status;
  if (s === 'UNVERIFIED') return [{ label: 'No evidence required for UNVERIFIED', met: true }];
  const items: ChecklistItem[] = [
    { label: `At least 1 attached source (${r.total} attached)`, met: r.total >= 1 },
    { label: `At least 1 supporting source (${r.supporting} supporting)`, met: r.supporting >= 1 },
  ];
  if (s === 'PRIMARY_SOURCE') {
    items.push({ label: `A supporting official, court or legislative source (${r.tier1_supporting})`, met: r.tier1_supporting >= 1 });
  }
  if (s === 'CORROBORATED') {
    items.push({ label: `Supporting sources from 2 distinct publishers (${r.distinct_publishers})`, met: r.distinct_publishers >= 2 });
  }
  if (s === 'DISPUTED') {
    items.push({ label: `A contradicting source is present (${r.contradicting})`, met: r.contradicting >= 1 });
  } else if (s !== 'OUTDATED') {
    items.push({ label: 'No contradicting source (otherwise mark DISPUTED)', met: r.contradicting === 0 });
  }
  return items;
}

export function isReadyForReview(r: Readiness): boolean {
  return r.error === null;
}
