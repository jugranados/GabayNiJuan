/**
 * REVIEWER acceptance (docs/VERIFICATION_CHECKLIST.md, step 5, "As REVIEWER"). Runs in the
 * `reviewer` project with the reviewer's saved session. Every record is fictional and is
 * rejected at the end, so nothing this file creates is ever published.
 */
import { enumLabel } from '@/domain/enums';

import {
  attachEvidence,
  createClaim,
  createRecord,
  createSource,
  expectState,
  field,
  openRecord,
  readiness,
  recordForm,
  saveRecord,
  saveRecordRefused,
  submitForApproval,
  transitionWithReason,
  workflowBar,
} from '../support/admin';
import { expect, requireMutations, test } from '../support/fixtures';
import { fictionalNames, manilaDate, uniqueSuffix } from '../support/names';
import { expectNoHorizontalOverflow } from '../support/public';

test.describe('reviewer', { tag: '@editorial' }, () => {
  test('sees the editorial area without role management', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Editorial' });
    for (const link of ['Dashboard', 'Work queue', 'Corrections', 'Revisions']) {
      await expect(nav.getByRole('link', { name: link })).toBeVisible();
    }
    await expect(nav.getByRole('link', { name: 'Users / roles' })).toHaveCount(0);
    await page.goto('/admin/roles');
    await expect(page.getByText('Your role does not include this area.')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Staff' })).toHaveCount(0);
  });

  test('drafts, attaches evidence and submits for approval, but cannot approve or publish', async ({ page }) => {
    requireMutations();
    test.setTimeout(6 * 60_000);
    const names = fictionalNames(uniqueSuffix());
    const editedSourceTitle = names.sourceTitle.replace(/ \(fictional\)$/, ' edited (fictional)');
    const ids: Record<string, string> = {};

    await test.step('create a source, a person and an office term', async () => {
      ids.source = await createSource(page, {
        title: names.sourceTitle,
        publisher: names.publisher,
        type: enumLabel('OFFICIAL_GOVERNMENT'),
        url: names.sourceUrl,
        retrieved: manilaDate(),
      });
      ids.person = await createRecord(page, 'people', {
        'First name': names.person.first,
        'Last name': names.person.last,
      });
      // The slug was left empty and generated from the name.
      await expect(field(recordForm(page, 'people'), 'Public URL slug')).toHaveValue(names.personSlug);
      ids.term = await createRecord(
        page,
        'office-terms',
        { Office: { first: true }, 'Term status': enumLabel('HELD'), 'Start date': manilaDate(-365) },
        `?person=${ids.person}`,
      );
    });

    await test.step('a draft source can be edited, including its own publication date; the save sticks', async () => {
      await openRecord(page, 'sources', ids.source);
      await saveRecord(page, 'sources', { Title: editedSourceTitle, 'Source published on': manilaDate(-30) });
      await openRecord(page, 'sources', ids.source);
      const form = recordForm(page, 'sources');
      await expect(field(form, 'Title')).toHaveValue(editedSourceTitle);
      await expect(field(form, 'Source published on')).toHaveValue(manilaDate(-30));
      // A fresh visit is not a save: no stale confirmation.
      await expect(form.getByRole('status')).toHaveText('');
    });

    await test.step('a judgment in a claim statement is refused', async () => {
      await page.goto(`/admin/records/claims/new?person=${ids.person}`);
      await saveRecordRefused(
        page,
        'claims',
        {
          'Claim type': enumLabel('OFFICE_TERM'),
          Statement: `${names.personLabel} is a corrupt official (fictional).`,
          'Verification status': enumLabel('PRIMARY_SOURCE'),
        },
        /is a judgment/,
      );
    });

    await test.step('a claim is not ready until a supporting source is attached', async () => {
      ids.claim = await createClaim(page, {
        personId: ids.person,
        subjectType: enumLabel('OFFICE_TERM'),
        subjectId: ids.term,
        claimType: enumLabel('OFFICE_TERM'),
        statement: names.statement('held a fictional test office'),
        verification: enumLabel('PRIMARY_SOURCE'),
      });
      await expect(readiness(page)).toContainText('Not ready');
      await attachEvidence(page, ids.source, editedSourceTitle);
      await expect(readiness(page)).toContainText('Ready for review.');
    });

    await test.step('submit every record for approval', async () => {
      for (const [type, id] of [
        ['sources', ids.source],
        ['people', ids.person],
        ['office-terms', ids.term],
        ['claims', ids.claim],
      ] as const) {
        await page.goto(`/admin/records/${type}/${id}`);
        await submitForApproval(page);
      }
    });

    await test.step('a record under review is locked and cannot be approved, published or retracted', async () => {
      await expect(page.getByText('This record is under review and is locked. Return it to draft to edit.')).toBeVisible();
      await expect(field(recordForm(page, 'claims'), 'Statement')).toBeDisabled();
      const bar = workflowBar(page);
      await expect(bar.getByRole('button', { name: 'Approve' })).toHaveCount(0);
      await expect(bar.getByRole('button', { name: 'Publish' })).toHaveCount(0);
      await expect(bar.getByText('Retract…')).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Evidence' })).toContainText(
        'Evidence cannot be changed in this state or with your role.',
      );
    });

    await test.step('clean up: reject every record (nothing was published)', async () => {
      for (const [type, id] of [
        ['claims', ids.claim],
        ['office-terms', ids.term],
        ['people', ids.person],
        ['sources', ids.source],
      ] as const) {
        await page.goto(`/admin/records/${type}/${id}`);
        await transitionWithReason(page, 'Reject', 'E2E cleanup: fictional test record', 'REJECTED');
      }
      await expectState(page, 'REJECTED');
    });
  });

  test('a record form is usable with the keyboard', { tag: '@accessibility' }, async ({ page }) => {
    await page.goto('/admin/records/sources/new');
    const form = recordForm(page, 'sources');
    const title = field(form, 'Title');
    await title.focus();
    await page.keyboard.type('E2E Fictional keyboard check');
    await page.keyboard.press('Tab');
    await expect(field(form, 'Publisher')).toBeFocused();
    await page.keyboard.press('Tab');
    const type = field(form, 'Source type');
    await expect(type).toBeFocused();
    await page.keyboard.type('News');
    await expect(type).toHaveValue('NEWS');
    expect(await type.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(field(form, 'Publisher')).toBeFocused();
    // Nothing was submitted: leaving the page discards the draft.
  });

  test('the work queue is usable on a phone: its table scrolls inside its card', { tag: '@responsive' }, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto('/admin/queue');
    await expect(page.getByRole('heading', { level: 1, name: 'Work queue' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByLabel('Publication status').selectOption({ label: enumLabel('PUBLISHED') });
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/[?&]status=PUBLISHED/);
    await expectNoHorizontalOverflow(page);
  });
});
