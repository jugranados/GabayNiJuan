/**
 * Claims must be precise factual propositions. This catches the most obvious character or
 * trust judgments before an editor saves. It is a guard rail, not a substitute for review.
 */
const JUDGMENT_PATTERNS: readonly RegExp[] = [
  /\b(?:un)?trustworthy\b/i,
  /\b(?:dis)?honest\b/i,
  /\bcorrupt(?:ion)?\b/i,
  /\b(?:good|bad|great|terrible|best|worst)\s+(?:leader|candidate|politician|mayor|governor|senator)\b/i,
  /\b(?:incompetent|crook|thief|evil|hero|villain|should (?:win|lose))\b/i,
];

export function findJudgmentWording(statement: string): string | undefined {
  for (const pattern of JUDGMENT_PATTERNS) {
    const match = pattern.exec(statement);
    if (match) return match[0];
  }
  return undefined;
}
