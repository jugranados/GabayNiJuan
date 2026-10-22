import { expect, test, type Page } from '@playwright/test';

import { ELECTION_PARTICIPATION_STATUSES } from '@/domain/enums';
import { PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';

import { expectNoRankingLanguage } from '../support/public';

const listedNames = (page: Page) =>
  page.getByRole('main').getByRole('list').first().getByRole('heading', { level: 2 }).allInnerTexts();

test.describe('politician directory', { tag: '@public' }, () => {
  test('lists people alphabetically and says order is not ranking', { tag: '@production-smoke' }, async ({ page }) => {
    await page.goto('/politicians');
    await expect(page.getByRole('heading', { level: 1, name: 'Politicians' })).toBeVisible();
    await expect(page.getByText('Order does not imply ranking.')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'alphabetical by name' })).toBeVisible();
    expect((await listedNames(page)).length).toBeGreaterThan(0);
    await expectNoRankingLanguage(page);
  });

  test('offers no sort control, and a sort parameter changes nothing', async ({ page }) => {
    await page.goto('/politicians');
    const plain = await listedNames(page);
    await expect(page.locator('[name="sort"], [name="order"], [name="orderBy"]')).toHaveCount(0);
    await expect(page.getByText(/sort by|most popular|trending/i)).toHaveCount(0);
    for (const sort of ['popular', 'views', 'trust', 'score']) {
      await page.goto(`/politicians?sort=${sort}`);
      expect(await listedNames(page), `?sort=${sort} must not reorder people`).toEqual(plain);
    }
  });

  test('name search narrows the list and keeps the query in the URL', async ({ page }) => {
    await page.goto('/politicians');
    const [first] = await listedNames(page);
    expect(first).toBeTruthy();
    const word = first!.split(/\s+/).find((part) => part.length >= 3) ?? first!;
    await page.getByLabel('Search by name').fill(word);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(word)}`));
    await expect(page.getByRole('status').filter({ hasText: `for “${word}”` })).toBeVisible();
    for (const name of await listedNames(page)) expect(name.toLowerCase()).toContain(word.toLowerCase());
  });

  test('a search with no match explains itself neutrally', async ({ page }) => {
    await page.goto('/politicians?q=zzzzqqqq');
    await expect(page.getByText('No politicians match this search')).toBeVisible();
    await expect(page.getByText('a missing name does not mean a person has no public record')).toBeVisible();
  });

  test('filters combine, show as removable chips, and clear', async ({ page }) => {
    await page.goto('/politicians');
    await page.getByLabel('Office level').selectOption({ label: 'National' });
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/[?&]level=national/);
    const chips = page.getByRole('list', { name: 'Active filters' });
    await expect(chips.getByRole('link', { name: /Office level: National/ })).toBeVisible();

    await page.getByLabel('Election').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/[?&]election=[a-z0-9-]+/);
    await expect(chips.getByRole('link')).toHaveCount(2);

    // Removing one chip keeps the other.
    await chips.getByRole('link', { name: /Office level: National/ }).click();
    await expect(page).not.toHaveURL(/level=/);
    await expect(chips.getByRole('link')).toHaveCount(1);

    await page.getByRole('link', { name: 'Clear search and filters' }).click();
    await expect(page).toHaveURL(/\/politicians$/);
  });

  test('the status filter offers the eight participation states, exactly', async ({ page }) => {
    await page.goto('/politicians');
    const labels = await page.getByLabel('Participation status').locator('option').allInnerTexts();
    expect(labels.slice(1)).toEqual(
      ELECTION_PARTICIPATION_STATUSES.map((status) => PARTICIPATION_STATUS_INFO[status].label),
    );
    // Only one of them is an official candidacy.
    expect(labels.filter((label) => /official candidate/i.test(label))).toEqual(['Official candidate']);
  });

  test('pagination: a page past the end returns to page 1; page links work when there are several', async ({ page }) => {
    await page.goto('/politicians?page=999');
    await expect(page).toHaveURL(/\/politicians$/);
    await page.goto('/politicians');
    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    if ((await pagination.count()) === 0) {
      test.info().annotations.push({ type: 'note', description: 'One page of people in this data set; page links not shown.' });
      return;
    }
    await pagination.getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(pagination).toContainText('Page 2 of');
  });

  test('profile links use readable slugs', async ({ page }) => {
    await page.goto('/politicians');
    const hrefs = await page.getByRole('main').getByRole('heading', { level: 2 }).getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/^\/politicians\/[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
