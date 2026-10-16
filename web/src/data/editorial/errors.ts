/** A failed editorial request, with a message that is safe to show to a signed-in editor. */
export class EditorialError extends Error {
  override readonly name = 'EditorialError';

  constructor(
    message: string,
    /** True when the row changed since the editor loaded it (optimistic concurrency). */
    readonly stale = false,
  ) {
    super(message);
  }
}

type PostgrestLike = { message?: string; code?: string };

/** Unique-constraint violations an editor can cause, in plain language. */
const UNIQUE_MESSAGES: readonly [constraint: RegExp, message: string][] = [
  [/_slug_key/, 'This public URL slug is already used by another record of this type. Choose a different slug.'],
  [/election_offices_election_office_key/, 'This office is already part of this election.'],
];

export function toEditorialError(error: PostgrestLike): EditorialError {
  const message = error.message ?? 'Request failed';
  if (error.code === '23505') {
    const known = UNIQUE_MESSAGES.find(([constraint]) => constraint.test(message));
    if (known) return new EditorialError(known[1]);
  }
  const stale = error.code === '40001' || message.includes('STALE_RECORD');
  return new EditorialError(stale ? message.replace(/^STALE_RECORD:\s*/, '') : message, stale);
}
