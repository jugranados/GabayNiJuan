/**
 * Layout safety at phone (375px), tablet (768px) and desktop widths: the projects
 * anonymous-mobile, anonymous-tablet and anonymous-desktop run this file. Practical checks, not
 * pixel snapshots: no sideways scrolling, controls inside the viewport, content readable.
 */
import { expect, test, type Page } from '@playwright/test';

import { directoryProfilePaths, expectNoHorizontalOverflow } from '../support/public';

async function expectInsideViewport(page: Page, selector: string): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  for (const element of await page.locator(selector).all()) {
    if (!(await element.isVisible())) continue;
    const box = await element.boundingBox();
    if (!box) continue;
    expect(box.x, `${selector} starts inside the viewport`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${selector} ends inside the ${width}px viewport`).toBeLessThanOrEqual(width + 1);
  }
}

test.describe('responsive layout', { tag: ['@public', '@responsive', '@production-smoke'] }, () => {
  for (const path of ['/', '/politicians', '/elections', '/verification', '/methodology', '/corrections/report']) {
    test(`${path} has no horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
      await expectInsideViewport(page, 'main h1');
    });
  }

  test('directory filters stay usable', async ({ page }) => {
    await page.goto('/politicians');
    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, 'main select, main input[type="search"], main button');
    await page.getByLabel('Office level').selectOption({ label: 'National' });
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/level=national/);
    await expectNoHorizontalOverflow(page);
  });

  test('a profile and its evidence stay readable', async ({ page }) => {
    const [profile] = await directoryProfilePaths(page);
    await page.goto(profile!);
    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, 'main .card');
    const claim = await page.locator('main a[href^="/claims/"]').first().getAttribute('href');
    if (claim) {
      await page.goto(claim);
      await expectNoHorizontalOverflow(page);
      await expectInsideViewport(page, 'main h1, main li, main a[href^="http"]');
    }
  });

  test('election and office pages', async ({ page }) => {
    await page.goto('/elections');
    const election = await page.locator('main h3 a[href^="/elections/"]').first().getAttribute('href');
    await page.goto(election!);
    await expectNoHorizontalOverflow(page);
    const office = await page.locator(`main a[href^="${election}/"]`).first().getAttribute('href');
    if (office) {
      await page.goto(office);
      await expectNoHorizontalOverflow(page);
      await expectInsideViewport(page, 'main section');
    }
  });
});
