import { expect, test, type Page } from '@playwright/test';

import { MISSING_RECORDS_MESSAGE } from '@/components/ui';

import { directoryProfilePaths, expectNoRankingLanguage, servesDatabaseIds } from '../support/public';

const SECTIONS = [
  'Election Participation',
  'Public Office History',
  'Political Affiliations',
  'Education',
  'Policy Positions',
  'Sources',
];

/** The first profile in the directory that links a record to its evidence. */
async function profileWithClaim(page: Page): Promise<{ profile: string; claim: string }> {
  for (const profile of await directoryProfilePaths(page)) {
    await page.goto(profile);
    const claim = await page.locator('main a[href^="/claims/"]').first().getAttribute('href').catch(() => null);
    if (claim) return { profile, claim };
  }
  throw new Error('No published profile links to a claim');
}

test.describe('profiles and evidence', { tag: '@public' }, () => {
  test('a profile has every section, a slug canonical URL and a report link', { tag: '@production-smoke' }, async ({ page }) => {
    const [profile] = await directoryProfilePaths(page);
    expect(profile, 'the directory lists at least one person').toBeTruthy();
    const response = await page.goto(profile!);
    expect(response?.status()).toBe(200);
    for (const section of SECTIONS) {
      await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible();
    }
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${profile}$`));
    await expect(page.getByRole('link', { name: 'Report an error' })).toHaveAttribute(
      'href',
      /^\/corrections\/report\?type=person&id=/,
    );
    await expectNoRankingLanguage(page);
  });

  test('empty sections use the one neutral missing-records sentence', async ({ page }) => {
    for (const profile of await directoryProfilePaths(page)) {
      await page.goto(profile);
      const missing = page.getByText(MISSING_RECORDS_MESSAGE, { exact: true });
      if ((await missing.count()) > 0) {
        await expect(missing.first()).toBeVisible();
        // Never rewritten as a finding about the person.
        await expect(page.getByText(/no cases|clean record|no criminal|spotless/i)).toHaveCount(0);
        return;
      }
    }
    test.info().annotations.push({ type: 'note', description: 'No profile with an empty section in this data set.' });
  });

  test('record → claim → evidence → original source', { tag: '@production-smoke' }, async ({ page }) => {
    const { profile, claim } = await profileWithClaim(page);
    await page.goto(profile);
    await page.locator(`main a[href="${claim}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${claim}$`));
    await expect(page.getByRole('heading', { level: 2, name: 'Verification status' })).toBeVisible();
    await expect(page.getByText('It is not a judgement of any')).toBeVisible();

    const sources = page.locator('main a[href^="http"]');
    expect(await sources.count(), 'a claim lists at least one source link').toBeGreaterThan(0);
    for (const link of await sources.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAttribute('rel', /noreferrer/);
    }
    await expect(page.getByRole('link', { name: 'Report an error' })).toHaveAttribute(
      'href',
      /^\/corrections\/report\?type=claim&id=/,
    );
    await expectNoRankingLanguage(page);
  });

  test('a person is never given a verified badge; verification belongs to claims', async ({ page }) => {
    const { profile } = await profileWithClaim(page);
    await page.goto(profile);
    // The name heading carries no badge, and the header labels evidence, not the person.
    const name = page.getByRole('heading', { level: 1 });
    await expect(name.locator('*')).toHaveCount(0);
    const header = (await page.getByRole('main').locator('header').first().innerText()).replace(
      'They are not a rating of this person.',
      '',
    );
    expect(header).not.toMatch(/\b(verified|trusted|trustworthy|score|rating|rank(ed|ing)?)\b/i);
  });

  test('a profile UUID URL redirects to the slug URL', async ({ page, request }) => {
    test.skip(!(await servesDatabaseIds(page)), 'mock fixtures have no UUIDs (DATA_SOURCE=mock)');
    const [profile] = await directoryProfilePaths(page);
    await page.goto(profile!);
    const report = await page.getByRole('link', { name: 'Report an error' }).getAttribute('href');
    const id = /id=([0-9a-f-]{36})/.exec(report ?? '')?.[1];
    expect(id).toBeTruthy();
    const response = await request.get(`/politicians/${id}`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(new RegExp(`${profile}$`));
  });
});
