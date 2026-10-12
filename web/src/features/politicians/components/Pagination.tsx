import Link from 'next/link';

import { directoryHref, totalPages, type DirectoryState } from '@/features/politicians/directoryParams';

/** Plain, crawlable page links. Each page is a real URL (`?page=2`). */
export function Pagination({ state, total }: { state: DirectoryState; total: number }) {
  const pages = totalPages(total);
  if (pages <= 1) return null;
  const href = (page: number) => directoryHref({ ...state, page });
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      {state.page > 1 ? (
        <Link href={href(state.page - 1)} rel="prev" className="btn">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <p aria-current="page" className="text-sm text-muted">
        Page {state.page} of {pages}
      </p>
      {state.page < pages ? (
        <Link href={href(state.page + 1)} rel="next" className="btn">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
