/**
 * "Report an error" from the public site through the editorial correction queue
 * (docs/VERIFICATION_CHECKLIST.md, step 5, "Correction request"). Accepting a request records a
 * decision only; the public record must not change.
 */
import { expect, requireMutations, test } from '../support/fixtures';
import { uniqueSuffix } from '../support/names';
import { directoryProfilePaths, waitForReportFormMinimumFillTime } from '../support/public';

test.describe('correction requests', { tag: ['@editorial', '@correction'] }, () => {
  test.beforeEach(() => requireMutations());

  test('a voter report is reviewed by staff and never changes the public record by itself', async ({ as }) => {
    test.setTimeout(6 * 60_000);
    const voter = await as('anonymous');
    const admin = await as('admin');
    const suffix = uniqueSuffix();
    const description = `E2E fictional correction request ${suffix}: the office dates on this fictional profile look wrong.`;
    const sourceUrl = `https://example.org/e2e-fictional/correction/${suffix}`;

    const [profile] = await directoryProfilePaths(voter);
    expect(profile, 'a published fictional profile to report on').toBeTruthy();
    await voter.goto(profile!);
    const before = await voter.getByRole('main').innerText();

    await test.step('invalid reports are refused before anything is stored', async () => {
      await voter.getByRole('link', { name: 'Report an error' }).click();
      await expect(voter.getByRole('heading', { level: 1, name: 'Report an error' })).toBeVisible();
      test.skip((await voter.getByRole('button', { name: 'Send report' }).count()) === 0, 'reports are unavailable with DATA_SOURCE=mock');

      await voter.getByLabel('What appears incorrect?').fill('short');
      await waitForReportFormMinimumFillTime(voter);
      await voter.getByRole('button', { name: 'Send report' }).click();
      await expect(voter.locator('#description-error')).toBeVisible();

      await voter.getByLabel('What appears incorrect?').fill(description);
      await voter.getByLabel('Source link (optional but encouraged)').fill('javascript:alert(1)');
      await waitForReportFormMinimumFillTime(voter);
      await voter.getByRole('button', { name: 'Send report' }).click();
      await expect(voter.locator('#sourceUrl-error')).toBeVisible();
      await expect(voter.getByText('Your report was received')).toHaveCount(0);
    });

    await test.step('a valid report is received', async () => {
      await voter.getByLabel('What appears incorrect?').fill(description);
      await voter.getByLabel('Source link (optional but encouraged)').fill(sourceUrl);
      await waitForReportFormMinimumFillTime(voter);
      await voter.getByRole('button', { name: 'Send report' }).click();
      await expect(voter.getByRole('status')).toContainText('Thank you. Your report was received.');
    });

    await test.step('staff see it in the queue, with the submitted link marked untrusted', async () => {
      await admin.goto('/admin/corrections?status=SUBMITTED');
      await admin.getByRole('table', { name: 'Correction requests' }).getByRole('link', { name: description.slice(0, 90) }).click();
      await expect(admin.getByRole('heading', { level: 1, name: 'Correction request' })).toBeVisible();
      await expect(admin.getByText('Status: Submitted')).toBeVisible();
      const report = admin.getByRole('region', { name: 'Report' });
      await expect(report).toContainText(description);
      await expect(report.getByRole('link', { name: sourceUrl })).toHaveAttribute('rel', /nofollow/);
      await expect(report).toContainText('untrusted link');
      await expect(report).toContainText('(Published)');
    });

    await test.step('start review; accepting needs a note; accepting changes nothing public', async () => {
      const decision = admin.getByRole('region', { name: 'Decision' });
      await decision.getByRole('button', { name: 'Start review' }).click();
      await expect(admin.getByText('Status: Under review')).toBeVisible();
      await decision.getByRole('button', { name: 'Accept' }).click();
      await expect(decision.getByRole('alert')).toContainText('A resolution note is required for this decision.');
      await decision.getByLabel(/^Resolution note/).fill('E2E: accepted for review of the fictional record.');
      await decision.getByRole('button', { name: 'Accept' }).click();
      await expect(admin.getByText('Status: Accepted')).toBeVisible();

      await voter.goto(profile!);
      expect(await voter.getByRole('main').innerText(), 'accepting a request must not change the public record').toBe(before);
    });

    await test.step('resolve the request; it is closed', async () => {
      const decision = admin.getByRole('region', { name: 'Decision' });
      await decision.getByLabel(/^Resolution note/).fill('E2E: no change needed to the fictional record.');
      await decision.getByRole('button', { name: 'Mark resolved' }).click();
      await expect(admin.getByText('Status: Resolved')).toBeVisible();
      await expect(admin.getByText('This request is closed.')).toBeVisible();
      await voter.goto(profile!);
      expect(await voter.getByRole('main').innerText()).toBe(before);
    });
  });
});
