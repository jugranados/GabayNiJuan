import { DateText } from '@/components/ui';
import type { Source } from '@/domain/models';
import { describeSourceType, linkHost } from '@/features/sources/sourceTypeLabels';
import { formatIsoDate } from '@/lib/dates';

function ExternalLink({ url, label, title }: { url: string; label: string; title: string }) {
  const host = linkHost(url);
  return (
    <a
      href={url}
      target="_blank"
      // noopener/noreferrer: the destination gets no handle on this page and no referrer.
      // nofollow: a citation is evidence to inspect, not an endorsement of the destination.
      rel="noopener noreferrer nofollow external"
      className="link inline-flex min-h-11 items-center"
    >
      {label}
      <span className="sr-only">: {title}</span>
      {host ? <span className="ml-1 text-muted no-underline">({host}, opens in a new tab)</span> : null}
    </a>
  );
}

/** Full citation for a source: what it is, who published it, when, and where to read it. */
export function SourceCitation({ source }: { source: Source }) {
  return (
    <div>
      <p className="font-semibold">
        <cite className="not-italic">{source.title}</cite>
      </p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm text-muted">
        <dt>Publisher</dt>
        <dd>{source.publisher}</dd>
        <dt>Source type</dt>
        <dd>{describeSourceType(source.sourceType)}</dd>
        {source.documentIdentifier ? (
          <>
            <dt>Document</dt>
            <dd>{source.documentIdentifier}</dd>
          </>
        ) : null}
        <dt>Published</dt>
        <dd>
          {source.publishedAt ? (
            <DateText date={source.publishedAt}>{formatIsoDate(source.publishedAt)}</DateText>
          ) : (
            'Date not recorded'
          )}
        </dd>
        <dt>Retrieved</dt>
        <dd>
          <DateText date={source.retrievedAt}>{formatIsoDate(source.retrievedAt)}</DateText>
        </dd>
      </dl>
      <div className="flex flex-wrap gap-x-6 text-sm">
        {source.url ? (
          <ExternalLink url={source.url} label="Open original source" title={source.title} />
        ) : (
          <p className="py-2 text-muted">No web link is recorded for this document.</p>
        )}
        {source.archivedUrl ? (
          <ExternalLink url={source.archivedUrl} label="Open archived copy" title={source.title} />
        ) : null}
      </div>
    </div>
  );
}
