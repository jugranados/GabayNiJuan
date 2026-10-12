import type { AppConfig } from '@/lib/config';

const config: AppConfig = { dataSource: 'mock', siteUrl: 'https://example.org', indexable: false };
vi.mock('@/server/config', () => ({ getAppConfig: () => config }));

import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { getRepositories } from '@/server/repositories';

describe('robots.txt and sitemap.xml', () => {
  it('block everything and list nothing while the site is not indexable', async () => {
    config.indexable = false;
    expect(robots()).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] });
    expect(await sitemap()).toEqual([]);
  });

  it('when indexable, never expose /admin and list only publicly readable people and standing claims', async () => {
    config.indexable = true;
    const rules = robots();
    expect(rules.sitemap).toBe('https://example.org/sitemap.xml');
    expect(JSON.stringify(rules.rules)).toContain('/admin');

    const urls = (await sitemap()).map((entry) => entry.url);
    const slugs = await getRepositories().people.listPersonSlugs();
    const repositories = getRepositories();
    const claimIds = await repositories.claims.listIndexableClaimIds();
    expect(urls).toEqual([
      'https://example.org',
      'https://example.org/politicians',
      'https://example.org/verification',
      'https://example.org/methodology',
      ...slugs.map((slug) => `https://example.org/politicians/${slug}`),
      ...claimIds.map((id) => `https://example.org/claims/${id}`),
    ]);
    expect(urls.some((url) => /admin|corrections/.test(url))).toBe(false);

    // Unverified, disputed and outdated claims are public pages but are not submitted for indexing.
    expect(claimIds.length).toBeGreaterThan(0);
    for (const id of claimIds) {
      const detail = await repositories.claims.getClaimDetail(id);
      expect(['PRIMARY_SOURCE', 'CORROBORATED', 'SELF_DECLARED', 'REPORTED']).toContain(
        detail?.claim.verificationStatus,
      );
    }
    const all = (devFixtureTables.claims ?? []) as { id: string; verification_status: string }[];
    const excluded = all.filter((row) => ['UNVERIFIED', 'DISPUTED', 'OUTDATED'].includes(row.verification_status));
    expect(excluded.length).toBeGreaterThan(0);
    for (const row of excluded) expect(urls).not.toContain(`https://example.org/claims/${row.id}`);
    config.indexable = false;
  });
});
