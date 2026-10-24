import { expect, test } from '@playwright/test';

test.describe('not found', { tag: ['@public', '@production-smoke'] }, () => {
  // Every 404 keeps the site's shell and its neutral wording: an address that matches no route
  // (not Next.js' bare 404) as well as a missing record inside a public route.
  for (const path of [
    '/this-page-does-not-exist',
    '/politicians/nobody-here-at-all/extra/segments',
    '/politicians/nobody-here-at-all',
    '/claims/not-a-claim',
    '/claims/00000000-0000-4000-8000-000000000000',
    '/elections/no-such-election',
  ]) {
    test(`${path} is a 404 page`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
      await expect(page.getByText("The page you're looking for could not be found.", { exact: false })).toBeVisible();
      await expect(page.getByText('This says nothing about any person.', { exact: false })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Browse all politicians' })).toBeVisible();
    });
  }

  test('the report page without a target does not offer a form', async ({ page }) => {
    await page.goto('/corrections/report');
    await expect(page.getByText('This report could not be started')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send report' })).toHaveCount(0);
  });
});

/**
 * Fictional data must not be indexed. These hold until SITE_INDEXABLE is deliberately turned on
 * (docs/WEB_MIGRATION.md, "SEO and indexing"); set E2E_EXPECT_INDEXABLE=true only then.
 */
test.describe('indexing is off', { tag: ['@public', '@production-smoke'] }, () => {
  test.skip(process.env.E2E_EXPECT_INDEXABLE === 'true', 'indexing is intended on this target');

  test('X-Robots-Tag, robots metadata, robots.txt and an empty sitemap', async ({ page, request }) => {
    const home = await page.goto('/');
    expect(home?.headers()['x-robots-tag']).toMatch(/noindex/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toMatch(/Disallow: \/\s*$/m);
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).not.toContain('<loc>');
  });

  test('no privileged key reaches the browser', async ({ page }) => {
    const bodies: string[] = [];
    page.on('response', async (response) => {
      if (/\.(js|css)(\?|$)/.test(response.url()) || response.request().resourceType() === 'document') {
        bodies.push(await response.text().catch(() => ''));
      }
    });
    await page.goto('/');
    await page.goto('/politicians');
    await page.waitForLoadState('networkidle');
    for (const body of bodies) expect(body).not.toMatch(/service_role|sb_secret_/);
  });
});

test.describe('editorial boundary, signed out', { tag: ['@public', '@production-smoke', '@editorial'] }, () => {
  for (const path of ['/admin', '/admin/queue', '/admin/roles', '/admin/revisions', '/admin/corrections', '/admin/records/people/new']) {
    test(`${path} sends a signed-out visitor to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('heading', { name: 'Editorial sign-in' })).toBeVisible();
    });
  }

  test('sign-in is uncached, unindexed and offers no sign-up', async ({ page }) => {
    const response = await page.goto('/admin/login');
    expect(response?.headers()['x-robots-tag']).toMatch(/noindex/);
    expect(response?.headers()['cache-control']).toMatch(/no-store/);
    await expect(page.getByText(/sign up|create account|register/i)).toHaveCount(0);
    await expect(
      page.getByText('there is no public sign-up').or(page.getByText('Editorial sign-in is not configured')),
    ).toBeVisible();
  });
});

test.describe('editorial boundary, failed sign-in', { tag: ['@public', '@editorial'] }, () => {
  test('a wrong password gets one generic message', async ({ page }) => {
    await page.goto('/admin/login');
    test.skip(
      (await page.getByText('Editorial sign-in is not configured').count()) > 0,
      'no Supabase project configured for this build',
    );
    await page.getByLabel('Email').fill('e2e-nobody@example.invalid');
    await page.getByLabel('Password').fill('not-a-real-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Sign-in failed' })).toHaveText(
      'Sign-in failed. Check your email and password.',
    );
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
