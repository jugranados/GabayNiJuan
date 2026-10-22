import { expect, test } from '@playwright/test';

import { NEUTRALITY_STATEMENT } from '@/lib/site';

import { expectNoRankingLanguage } from '../support/public';

test.describe('static public pages', { tag: ['@public', '@production-smoke'] }, () => {
  test('home states neutrality and links into the record', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Gabay ni Juan' })).toBeVisible();
    await expect(page.getByText(NEUTRALITY_STATEMENT).first()).toBeVisible();
    // Fictional data is labelled on every page while indexing is off.
    await expect(page.getByText('Every person, office, organization and source shown here is fictional.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse all politicians' })).toHaveAttribute('href', '/politicians');
    await expectNoRankingLanguage(page);
  });

  test('home search goes to the directory with the query in the URL', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('main').getByRole('searchbox').fill('zzzzqqqq');
    await page.getByRole('main').getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/politicians\?q=zzzzqqqq/);
    await expect(page.getByText('No politicians match this search')).toBeVisible();
  });

  for (const [path, heading] of [
    ['/verification', /verification/i],
    ['/methodology', /methodology/i],
  ] as const) {
    test(`${path} loads`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expectNoRankingLanguage(page);
    });
  }

  test('main navigation reaches every section', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const [name, path] of [
      ['Politicians', '/politicians'],
      ['Elections', '/elections'],
      ['How verification works', '/verification'],
      ['Methodology', '/methodology'],
    ] as const) {
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
});
