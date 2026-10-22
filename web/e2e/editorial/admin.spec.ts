/**
 * ADMIN acceptance and role boundaries (docs/VERIFICATION_CHECKLIST.md, step 5, "As ADMIN").
 *
 * Role changes only ever touch the optional role-less test account (E2E_NOROLE_EMAIL), and put
 * it back to "no role" afterwards. Last-admin protection runs only against a local, throwaway
 * database and only when the test administrator is the sole ADMIN, so it can never lock out a
 * real administrator; elsewhere it stays a manual check.
 */
import type { Page } from '@playwright/test';

import { ROLE_LABELS } from '@/domain/editorial/roles';

import { credentialsFor, destructiveRoleTestsAllowed } from '../support/env';
import { expect, requireMutations, test } from '../support/fixtures';

const staffTable = (page: Page) => page.getByRole('table', { name: 'Staff' });

test.describe('administrator', { tag: '@editorial' }, () => {
  test('every editorial area loads', async ({ page }) => {
    for (const [path, heading] of [
      ['/admin', 'Dashboard'],
      ['/admin/queue', 'Work queue'],
      ['/admin/corrections', 'Correction requests'],
      ['/admin/revisions', 'Revision history'],
      ['/admin/roles', 'Users / editorial roles'],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      expect(response?.headers()['cache-control'], path).toMatch(/no-store/);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
    await expect(page.getByRole('navigation', { name: 'Editorial' }).getByRole('link', { name: 'Users / roles' })).toBeVisible();
    await expect(staffTable(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Role change log' })).toBeVisible();
  });

  test('revisions offer the raw snapshots to administrators', async ({ page }) => {
    await page.goto('/admin/revisions');
    const raw = page.getByText('Show raw data').first();
    test.skip((await raw.count()) === 0, 'no revisions recorded yet');
    await raw.click();
    await expect(page.locator('pre').first()).toContainText('"old"');
  });

  test('signed in without a role: no editorial access anywhere', async ({ as }) => {
    test.skip(!credentialsFor('norole'), 'E2E_NOROLE_EMAIL / _PASSWORD not set');
    const nobody = await as('norole');
    for (const path of ['/admin', '/admin/queue', '/admin/roles', '/admin/records/people/new']) {
      await nobody.goto(path);
      await expect(nobody.getByRole('heading', { level: 1, name: 'No editorial access' })).toBeVisible();
      await expect(nobody.getByRole('navigation', { name: 'Editorial' })).toHaveCount(0);
    }
  });

  test('assign, change and remove a role; each change is logged and takes effect', async ({ page, as }) => {
    requireMutations();
    const target = credentialsFor('norole');
    test.skip(!target, 'needs the role-less test account (E2E_NOROLE_EMAIL / _PASSWORD)');
    const email = target!.email;
    const nobody = await as('norole');

    await page.goto('/admin/roles');
    test.skip(
      (await staffTable(page).getByRole('rowheader', { name: email, exact: true }).count()) > 0,
      'the role-less test account currently holds a role; fix that first',
    );

    const assign = page.getByRole('form', { name: 'Assign role' });
    await assign.getByLabel('Account email').fill(email);
    await assign.getByLabel('Role').selectOption('REVIEWER');
    await assign.getByRole('button', { name: 'Assign' }).click();
    await expect(assign.getByRole('status')).toHaveText('Role saved.');
    await expect(page.getByLabel(`Role for ${email}`)).toHaveValue('REVIEWER');

    // The role applies to the account's next request.
    await nobody.goto('/admin');
    await expect(nobody.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    const row = staffTable(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name: email, exact: true }) });
    await row.getByLabel(`Role for ${email}`).selectOption('APPROVER');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByLabel(`Role for ${email}`)).toHaveValue('APPROVER');

    await row.getByRole('button', { name: `Remove role from ${email}` }).click();
    await expect(staffTable(page).getByRole('rowheader', { name: email, exact: true })).toHaveCount(0);

    const log = page.getByRole('region', { name: 'Role change log' });
    await expect(log.getByText(`${email}: none → ${ROLE_LABELS.REVIEWER}`).first()).toBeVisible();
    await expect(log.getByText(`${email}: ${ROLE_LABELS.REVIEWER} → ${ROLE_LABELS.APPROVER}`).first()).toBeVisible();
    await expect(log.getByText(`${email}: ${ROLE_LABELS.APPROVER} → none`).first()).toBeVisible();

    await nobody.goto('/admin');
    await expect(nobody.getByRole('heading', { level: 1, name: 'No editorial access' })).toBeVisible();
  });

  test('last-admin protection: the only administrator cannot remove their own role', async ({ page }) => {
    test.skip(!destructiveRoleTestsAllowed, 'only against a local, throwaway database (E2E_TARGET_ENV=local); manual elsewhere');
    const email = credentialsFor('admin')!.email;
    await page.goto('/admin/roles');
    const admins = await staffTable(page)
      .getByRole('combobox')
      .evaluateAll((selects) => selects.filter((select) => (select as HTMLSelectElement).value === 'ADMIN').length);
    test.skip(admins !== 1, `needs exactly one ADMIN to test safely (found ${admins})`);
    await expect(page.getByLabel(`Role for ${email}`), 'the only ADMIN must be the test account').toHaveValue('ADMIN');

    const row = staffTable(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name: email, exact: true }) });
    await row.getByRole('button', { name: `Remove role from ${email}` }).click();
    await expect(row.getByRole('alert')).toContainText('Cannot remove the last administrator');
    await page.reload();
    await expect(page.getByLabel(`Role for ${email}`)).toHaveValue('ADMIN');
  });
});
