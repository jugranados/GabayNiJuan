import type { MetadataRoute } from 'next';

import { claimPath, politicianPath } from '@/features/politicians/paths';
import { getAppConfig } from '@/server/config';
import { getRepositories } from '@/server/repositories';

export const revalidate = 3600;

/**
 * /sitemap.xml. People and claims are listed through the public (anonymous)
 * repositories, so only PUBLISHED records can ever appear: no draft, reviewed,
 * approved-but-unpublished or retracted record, and nothing editorial. Claims are
 * listed only while their evidence stands (not unverified, disputed or outdated). Empty unless indexing is on, which
 * keeps fictional development data out of search engines.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = getAppConfig();
  if (!config.indexable) return [];
  const repositories = getRepositories();
  const [slugs, claimIds] = await Promise.all([
    repositories.people.listPersonSlugs(),
    repositories.claims.listIndexableClaimIds(),
  ]);
  return [
    ...['/', '/politicians', '/verification', '/methodology'].map((path) => ({
      url: `${config.siteUrl}${path === '/' ? '' : path}`,
    })),
    ...slugs.map((slug) => ({ url: `${config.siteUrl}${politicianPath(slug)}` })),
    ...claimIds.map((id) => ({ url: `${config.siteUrl}${claimPath(id)}` })),
  ];
}
