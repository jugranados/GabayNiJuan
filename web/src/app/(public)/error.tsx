'use client';

import { ERROR_COPY } from '@/lib/errors';

/**
 * Shown when a public page cannot load its data, including when a record fails
 * validation. Records that do not pass the data checks are never displayed.
 */
export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert">
      <h1 className="text-3xl font-bold">{ERROR_COPY.backend.title}</h1>
      <p className="mt-4">
        Something went wrong while loading this page. Information that does not pass our data
        checks is not displayed.
      </p>
      <p className="mt-4">
        <button type="button" onClick={reset} className="btn">
          Try again
        </button>
      </p>
    </div>
  );
}
