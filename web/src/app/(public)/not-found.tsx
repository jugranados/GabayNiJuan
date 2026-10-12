import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-4">
        There is no published page at this address. It may have been moved or withdrawn, or the
        link may be incomplete. This says nothing about any person.
      </p>
      <p className="mt-4">
        <Link href="/politicians" className="btn">
          Browse all politicians
        </Link>
      </p>
    </>
  );
}
