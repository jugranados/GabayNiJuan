/**
 * APPROVER checks that need no second person (docs/VERIFICATION_CHECKLIST.md, step 5, "As
 * APPROVER"): the two-person rule refuses self-approval, and evidence that does not meet the
 * verification status blocks a claim. Second-person approval, dependency order, published edits
 * and retraction run with a REVIEWER in lifecycle.spec.ts. Records here are rejected, never published.
 */
import { enumLabel } from '@/domain/enums';

import {
  attachEvidence,
  createRecord,
  createSource,
  readiness,
  submitForApproval,
  transition,
  transitionRefused,
  transitionWithReason,
} from '../support/admin';
import { expect, requireMutations, test } from '../support/fixtures';
import { fictionalNames, manilaDate, uniqueSuffix } from '../support/names';

test.describe('approver', { tag: '@editorial' }, () => {
  test('cannot manage roles', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('navigation', { name: 'Editorial' }).getByRole('link', { name: 'Users / roles' })).toHaveCount(0);
    await page.goto('/admin/roles');
    await expect(page.getByText('Your role does not include this area.')).toBeVisible();
  });

  test('two-person rule: cannot approve a record they created and submitted', async ({ page }) => {
    requireMutations();
    const names = fictionalNames(uniqueSuffix());
    await createSource(page, {
      title: names.sourceTitle,
      publisher: names.publisher,
      type: enumLabel('OFFICIAL_GOVERNMENT'),
      url: names.sourceUrl,
      retrieved: manilaDate(),
    });
    await submitForApproval(page);
    // The button is offered to the role; the database refuses this approver.
    await transitionRefused(page, 'Approve', /Two-person rule/);
    await transitionWithReason(page, 'Reject', 'E2E cleanup: fictional self-approval check', 'REJECTED');
  });

  test('evidence that does not meet the status blocks a claim from review and publication', async ({ page }) => {
    requireMutations();
    const names = fictionalNames(uniqueSuffix());
    const news = await createSource(page, {
      title: names.newsSourceTitle,
      publisher: names.publisher,
      type: enumLabel('NEWS'),
      url: `${names.sourceUrl}/news`,
      retrieved: manilaDate(),
    });
    await createRecord(page, 'claims', {
      'Claim type': enumLabel('OFFICE_TERM'),
      Statement: names.statement('held a fictional test office according to a news report'),
      'Verification status': enumLabel('PRIMARY_SOURCE'),
    });
    await expect(readiness(page)).toContainText('Not ready');
    // "Primary source" needs an official, court or legislative record; a news report is not one.
    await attachEvidence(page, news, names.newsSourceTitle);
    await expect(readiness(page)).toContainText('Not ready');
    await transition(page, 'Mark sources attached', 'SOURCE_ATTACHED');
    await transitionRefused(page, 'Submit for approval', /cannot|primary|source/i);
    await transitionWithReason(page, 'Reject', 'E2E cleanup: fictional evidence check', 'REJECTED');
    await page.goto(`/admin/records/sources/${news}`);
    await transitionWithReason(page, 'Reject', 'E2E cleanup: fictional evidence check', 'REJECTED');
  });
});
