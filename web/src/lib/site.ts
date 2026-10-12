import type { Metadata } from 'next';

export const SITE_NAME = 'Gabay ni Juan';
export const SITE_TAGLINE = 'Know the record. Check the sources. Decide for yourself.';
export const SITE_DESCRIPTION =
  'A politically neutral guide to the documented public record of Philippine political figures. Every statement links to its sources and shows how it was verified.';
export const NEUTRALITY_STATEMENT =
  'Gabay ni Juan does not endorse, rank, score, or recommend any candidate.';

type PageMetadataInput = {
  title: string;
  description: string;
  /** Canonical path, starting with "/". Resolved against `metadataBase`. */
  path: string;
  /** Set for pages that should stay out of search results even on an indexable site. */
  noIndex?: boolean;
};

/**
 * Title, description, canonical URL and social cards for one page. Copy passed
 * here must be descriptive only: no conclusion about a person belongs in a
 * title or description.
 */
export function pageMetadata({ title, description, path, noIndex }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, title, description, url: path, locale: 'en_PH' },
    twitter: { card: 'summary', title, description },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
