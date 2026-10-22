import { expect, test } from '@playwright/test';

import { MISSING_RECORDS_MESSAGE } from '@/components/ui';
import { ELECTION_PARTICIPATION_STATUSES } from '@/domain/enums';
import { CANDIDACY_NOTE, PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';

import { expectNoRankingLanguage, servesDatabaseIds } from '../support/public';

/** The fictional 2028 structure from the seed (docs/ELECTION_INFORMATION_MODEL.md). */
const FICTIONAL_2028 = {
  id: '834551e9-b01b-aaad-629d-7ab177914203',
  slug: 'national-and-district-election-2028-fictional',
};

const officialLabel = PARTICIPATION_STATUS_INFO.OFFICIAL_CANDIDATE.label;

test.describe('elections', { tag: ['@public', '@election'] }, () => {
  test('index → election → office, with slug URLs', { tag: '@production-smoke' }, async ({ page }) => {
    await page.goto('/elections');
    await expect(page.getByRole('heading', { level: 1, name: 'Elections' })).toBeVisible();
    await expect(page.getByText('Order does not imply importance or ranking.')).toBeVisible();

    const election = page.getByRole('main').getByRole('heading', { level: 3 }).getByRole('link').first();
    const electionHref = await election.getAttribute('href');
    expect(electionHref).toMatch(/^\/elections\/[a-z0-9-]+$/);
    await election.click();
    await expect(page).toHaveURL(new RegExp(`${electionHref}$`));
    // What a crawler or a shared link sees: a fresh load.
    await page.goto(electionHref!);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${electionHref}$`));

    const office = page.locator(`main a[href^="${electionHref}/"]`).first();
    const officeHref = await office.getAttribute('href');
    expect(officeHref).toMatch(/^\/elections\/[a-z0-9-]+\/[a-z0-9-]+$/);
    await office.click();
    await expect(page).toHaveURL(new RegExp(`${officeHref}$`));
    await expect(page.getByText(CANDIDACY_NOTE).first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Elections' })).toBeVisible();
    await expectNoRankingLanguage(page);
  });

  test('each group holds exactly its status; only official candidates are grouped as such', async ({ page }) => {
    await page.goto('/elections');
    const electionHrefs = await page.locator('main h3 a[href^="/elections/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );
    let checkedGroups = 0;
    for (const electionHref of electionHrefs) {
      await page.goto(electionHref);
      const officeHrefs = await page.locator(`main a[href^="${electionHref}/"]`).evaluateAll((links) =>
        [...new Set(links.map((link) => link.getAttribute('href') ?? ''))],
      );
      for (const officeHref of officeHrefs) {
        await page.goto(officeHref);
        for (const status of ELECTION_PARTICIPATION_STATUSES) {
          const info = PARTICIPATION_STATUS_INFO[status];
          // "Official candidates (2)": the heading names the region.
          const group = page.getByRole('region', { name: new RegExp(`^${info.groupHeading} \\(\\d+\\)$`) });
          if ((await group.count()) === 0) continue;
          checkedGroups += 1;
          // Each person's most recent record (the first in their list) has this group's exact status.
          const latest = await group.locator('ul > li > ol > li:first-child > p > strong').allInnerTexts();
          expect(latest.length).toBeGreaterThan(0);
          expect(latest, `${officeHref}: "${info.groupHeading}"`).toEqual(latest.map(() => `${info.label}.`));
          if (!info.isOfficialCandidate) expect(latest).not.toContain(`${officialLabel}.`);
        }
      }
    }
    expect(checkedGroups, 'the fictional elections show at least one status group').toBeGreaterThan(0);
  });

  test('an office with no participants shows the neutral missing-records sentence', async ({ page }) => {
    const response = await page.goto(`/elections/${FICTIONAL_2028.slug}`);
    test.skip(response?.status() !== 200, 'the fictional 2028 election is not published here');
    const offices = await page.locator(`main a[href^="/elections/${FICTIONAL_2028.slug}/"]`).evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute('href') ?? ''))],
    );
    for (const office of offices) {
      await page.goto(office);
      if ((await page.getByText(MISSING_RECORDS_MESSAGE, { exact: true }).count()) > 0) return;
    }
    throw new Error('Expected one of the fictional 2028 offices to have no participants (President, Vice President)');
  });

  test('UUID and unknown election URLs', { tag: '@production-smoke' }, async ({ page, request }) => {
    const databaseIds = await servesDatabaseIds(page);
    const index = await page.goto('/elections');
    expect(index?.status()).toBe(200);
    const published = (await page.locator(`a[href="/elections/${FICTIONAL_2028.slug}"]`).count()) > 0;
    if (published && databaseIds) {
      const legacy = await request.get(`/elections/${FICTIONAL_2028.id}`, { maxRedirects: 0 });
      expect(legacy.status()).toBe(308);
      expect(legacy.headers().location).toMatch(new RegExp(`/elections/${FICTIONAL_2028.slug}$`));
    }
    if (published) {
      const office = await page.goto(`/elections/${FICTIONAL_2028.slug}/no-such-office`);
      expect(office?.status()).toBe(404);
    }
    const unknown = await page.goto('/elections/no-such-election');
    expect(unknown?.status()).toBe(404);
  });

  test('election pages link into the directory with readable filters', async ({ page }) => {
    const response = await page.goto(`/elections/${FICTIONAL_2028.slug}`);
    test.skip(response?.status() !== 200, 'the fictional 2028 election is not published here');
    await page.locator('main a[href^="/politicians?election="]').first().click();
    await expect(page).toHaveURL(/\/politicians\?election=[a-z0-9-]+/);
    await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Election:');
  });
});
