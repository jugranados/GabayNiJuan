/** Runs at every viewport (desktop, tablet, phone): the main navigation must stay usable. */
import { expect, test } from '@playwright/test';

test.describe('main navigation at this viewport', { tag: ['@public', '@responsive', '@production-smoke'] }, () => {
  test('every main link is visible, tappable and inside the viewport', async ({ page }) => {
    await page.goto('/');
    const width = page.viewportSize()?.width ?? 0;
    const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
    await expect(links).toHaveCount(4);
    for (const link of await links.all()) {
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      // Touch targets are at least 44px tall (min-h-11).
      expect(box!.height).toBeGreaterThanOrEqual(43);
    }
    await links.filter({ hasText: 'Elections' }).click();
    await expect(page).toHaveURL(/\/elections$/);
  });
});
