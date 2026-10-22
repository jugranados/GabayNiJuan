/**
 * Keyboard-only smoke paths with real key presses (Tab, Shift+Tab, Enter, Space, Escape).
 * This is not a screen-reader pass; that stays manual (docs/VERIFICATION_CHECKLIST.md).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { directoryProfilePaths, waitForReportFormMinimumFillTime } from '../support/public';

/** The focused element shows a visible focus indicator (globals.css `:focus-visible`). */
async function expectVisibleFocus(page: Page): Promise<void> {
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(':focus-visible'),
      outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
      shadow: style.boxShadow !== 'none',
    };
  });
  expect(focus, 'something has keyboard focus').not.toBeNull();
  expect(focus!.focusVisible, 'focus is keyboard-visible').toBe(true);
  expect(focus!.outline || focus!.shadow, 'the focused control draws an outline').toBe(true);
}

/** Tabs forward until `target` has focus (bounded number of presses, no sleeps). */
async function tabTo(page: Page, target: Locator, max = 60): Promise<void> {
  await expect(target).toBeVisible();
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Could not reach ${target} with Tab`);
}

test.describe('keyboard navigation', { tag: ['@public', '@accessibility'] }, () => {
  test('the first Tab reaches "Skip to main content", and Enter moves focus to the content', async ({ page }) => {
    await page.goto('/politicians');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await expect(page.locator('#main')).toBeFocused();
  });

  test('primary navigation works with Tab, Shift+Tab and Enter', async ({ page }) => {
    await page.goto('/');
    await tabTo(page, page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Elections' }));
    await expectVisibleFocus(page);
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Politicians' })).toBeFocused();
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/politicians$/);
  });

  test('directory search and filters work without a mouse', async ({ page }) => {
    await page.goto('/politicians');
    await tabTo(page, page.getByLabel('Search by name'));
    await expectVisibleFocus(page);
    await page.keyboard.type('zz');
    // Escape clears a search field.
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Search by name')).toHaveValue('');

    await tabTo(page, page.getByLabel('Office level'));
    await expectVisibleFocus(page);
    // Type-ahead selection works on a focused select on every platform.
    await page.keyboard.type('National');
    await expect(page.getByLabel('Office level')).toHaveValue('national');
    await tabTo(page, page.getByRole('button', { name: 'Apply filters' }));
    await expectVisibleFocus(page);
    await page.keyboard.press('Space');
    await expect(page).toHaveURL(/[?&]level=national/);
  });

  test('pagination links are reachable by keyboard when there are several pages', async ({ page }) => {
    await page.goto('/politicians');
    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    test.skip((await pagination.count()) === 0, 'one page of people in this data set');
    await tabTo(page, pagination.getByRole('link', { name: 'Next' }));
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/[?&]page=2/);
  });

  test('the correction form can be filled and sent with the keyboard (rejected input, nothing stored)', async ({ page }) => {
    const [profile] = await directoryProfilePaths(page);
    await page.goto(profile!);
    await tabTo(page, page.getByRole('link', { name: 'Report an error' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Report an error' })).toBeVisible();
    test.skip(
      (await page.getByRole('button', { name: 'Send report' }).count()) === 0,
      'reports are unavailable with DATA_SOURCE=mock',
    );
    await tabTo(page, page.getByLabel('What appears incorrect?'));
    await expectVisibleFocus(page);
    await page.keyboard.type('short');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Source link (optional but encouraged)')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email (optional)')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Send report' })).toBeFocused();
    await expectVisibleFocus(page);
    await waitForReportFormMinimumFillTime(page);
    // A 5-character description fails validation before anything reaches the database.
    await page.keyboard.press('Space');
    await expect(page.getByText(/^Error: /).first()).toBeVisible();
    await expect(page.getByText('Your report was received')).toHaveCount(0);
  });
});
