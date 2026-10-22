import { expect, type Page } from '@playwright/test';

import { MIN_FILL_MS, STARTED_AT_FIELD } from '@/features/corrections/guard';
import { NEUTRALITY_STATEMENT } from '@/lib/site';

/**
 * Words that would mean the site ranks, rates or recommends people. Searched in the visible
 * text after removing the sentences in which the site says it does none of these things.
 */
const RANKING_WORDS =
  /\b(best|worst|top[- ]rated|trending|most (viewed|popular|trusted|experienced)|trust score|credibility score|popularity|recommended (candidate|for you)|we recommend|vote for)\b/i;

const NEUTRALITY_SENTENCES = [
  NEUTRALITY_STATEMENT,
  'Order does not imply ranking.',
  'Order does not imply importance or ranking.',
  'It is not a judgement of any person',
];

export async function expectNoRankingLanguage(page: Page): Promise<void> {
  let text = await page.locator('body').innerText();
  for (const sentence of NEUTRALITY_SENTENCES) text = text.split(sentence).join(' ');
  expect(text, 'public pages must not rank, rate or recommend people').not.toMatch(RANKING_WORDS);
  // No rating or score widgets either.
  await expect(page.locator('[role="meter"], [role="progressbar"], meter, progress')).toHaveCount(0);
}

/** The page never scrolls sideways at this viewport (a 1px rounding allowance). */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `page is ${scrollWidth}px wide in a ${clientWidth}px viewport`).toBeLessThanOrEqual(clientWidth + 1);
}

/** Reloads a public page until it shows (or stops showing) `text`: publication revalidates, caches may lag. */
export async function pollPublicText(page: Page, url: string, text: string, present = true): Promise<void> {
  await expect
    .poll(
      async () => {
        const response = await page.goto(url);
        if (!response || response.status() !== 200) return false;
        return (await page.locator('main').innerText()).includes(text);
      },
      { message: `${url} should ${present ? '' : 'no longer '}show "${text}"`, timeout: 75_000, intervals: [1_000, 2_000, 5_000] },
    )
    .toBe(present);
}

/** Reloads a public URL until it returns `status` (a retracted record becomes a 404). */
export async function pollPublicStatus(page: Page, url: string, status: number): Promise<void> {
  await expect
    .poll(async () => (await page.goto(url))?.status(), {
      message: `${url} should return ${status}`,
      timeout: 75_000,
      intervals: [1_000, 2_000, 5_000],
    })
    .toBe(status);
}

/** Paths of the people listed on the first directory page. */
export async function directoryProfilePaths(page: Page): Promise<string[]> {
  await page.goto('/politicians');
  const hrefs = await page
    .getByRole('main')
    .getByRole('heading', { level: 2 })
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  return hrefs.filter((href) => /^\/politicians\/[a-z0-9-]+$/.test(href));
}

/**
 * The report form refuses submissions made within MIN_FILL_MS of opening it (a bot guard).
 * Waits, by the browser's own clock, until that much time has passed since the form recorded it.
 */
export async function waitForReportFormMinimumFillTime(page: Page): Promise<void> {
  const startedAt = page.locator(`input[name="${STARTED_AT_FIELD}"]`);
  await expect(startedAt).not.toHaveValue('');
  await expect
    .poll(
      () => startedAt.evaluate((input) => Date.now() - Number((input as HTMLInputElement).value)),
      { message: 'minimum fill time of the report form', timeout: MIN_FILL_MS + 10_000 },
    )
    .toBeGreaterThan(MIN_FILL_MS + 500);
}

/**
 * Whether the site reads the database (UUID ids) rather than the mock fixtures (readable ids such
 * as `person-juan-dela-cruz`). UUID-to-slug redirects exist only for database ids.
 */
export async function servesDatabaseIds(page: Page): Promise<boolean> {
  const [profile] = await directoryProfilePaths(page);
  if (!profile) return false;
  await page.goto(profile);
  const href = await page.getByRole('link', { name: 'Report an error' }).getAttribute('href');
  return /[?&]id=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(href ?? '');
}
