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

export function toEditorialError(error: PostgrestLike): EditorialError {
  const message = error.message ?? 'Request failed';
  const stale = error.code === '40001' || message.includes('STALE_RECORD');
  return new EditorialError(stale ? message.replace(/^STALE_RECORD:\s*/, '') : message, stale);
}
