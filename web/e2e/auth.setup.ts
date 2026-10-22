/**
 * Signs in once per role through the real /admin/login form and saves each session to
 * playwright/.auth/<role>.json (git-ignored). Credentials come only from the environment and
 * are never logged; this project records no trace, screenshot or video.
 *
 * Each account must hold exactly the role it is used for: the header shows the role, and a
 * mismatch fails here rather than producing misleading results later.
 */
import fs from 'node:fs';

import { expect, test as setup } from '@playwright/test';

import { ROLE_LABELS } from '@/domain/editorial/roles';

import { AUTH_DIR, authFile, credentialsFor, missingCredentialVariables, REQUIRED_ROLES, ROLES } from './support/env';

const EXPECTED_ROLE = { reviewer: 'REVIEWER', approver: 'APPROVER', admin: 'ADMIN' } as const;

setup.beforeAll(() => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const missing = missingCredentialVariables(REQUIRED_ROLES);
  if (missing.length > 0) {
    throw new Error(
      `Editorial E2E tests need one account per role. Not set: ${missing.join(', ')}. ` +
        'See README.md, "Browser acceptance tests (Playwright)". Public tests do not need them: npm run e2e:public.',
    );
  }
});

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const credentials = credentialsFor(role);
    // The role-less account is optional; without it the no-role checks are skipped.
    setup.skip(!credentials, `E2E_${role.toUpperCase()}_EMAIL / _PASSWORD not set`);
    if (!credentials) return;

    fs.rmSync(authFile(role), { force: true });
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Editorial sign-in' })).toBeVisible();
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Password').fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Either the dashboard (or the no-role page) at /admin, or the form's one generic error.
    const failed = page.getByRole('alert').filter({ hasText: 'Sign-in failed' });
    await Promise.race([page.waitForURL(/\/admin$/), failed.waitFor()]);
    if (await failed.isVisible()) {
      throw new Error(`Sign-in as ${role} failed: ${await failed.innerText()} (check the E2E_${role.toUpperCase()}_* values)`);
    }

    if (role === 'norole') {
      await expect(page.getByRole('heading', { name: 'No editorial access' })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(
        page.getByText(ROLE_LABELS[EXPECTED_ROLE[role]], { exact: true }),
        `the ${role} account must hold exactly the ${EXPECTED_ROLE[role]} role`,
      ).toBeVisible();
    }
    await page.context().storageState({ path: authFile(role) });
  });
}
