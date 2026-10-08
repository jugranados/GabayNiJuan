export class EditorialError extends Error {
  constructor(
    message: string,
    /** True when the row changed since the editor loaded it (optimistic concurrency). */
    readonly stale = false,
  ) {
    super(message);
    this.name = 'EditorialError';
  }
}

type PostgrestLike = { message?: string; code?: string };

export function toEditorialError(error: PostgrestLike): EditorialError {
  const message = error.message ?? 'Request failed';
  const stale = error.code === '40001' || message.includes('STALE_RECORD');
  return new EditorialError(stale ? message.replace(/^STALE_RECORD:\s*/, '') : message, stale);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
