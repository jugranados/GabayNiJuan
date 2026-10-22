import { defineConfig, devices, type Project } from '@playwright/test';

import { authFile, baseURL, mutationsAllowed, startsLocalServer, targetEnv } from './e2e/support/env';

/**
 * Browser acceptance tests (docs/VERIFICATION_CHECKLIST.md). `npm run smoke` stays the fast,
 * HTTP-only check; this drives real pages and real editorial sessions.
 *
 * Projects
 *   anonymous-desktop|tablet|mobile  public site, read-only, parallel
 *   setup                            signs in through /admin/login and saves one session per role
 *   reviewer | approver | admin      one role each, one worker (they write)
 *   workflow                         multi-actor flows (reviewer → approver, voter → admin), one worker
 *   production-smoke                 @production-smoke tests only; read-only; defined only when
 *                                    E2E_TARGET_ENV=production
 *
 * A production target never gets `setup` or the writing projects unless
 * E2E_ALLOW_PRODUCTION_MUTATIONS=true, so a production run signs in nowhere and writes nothing.
 * Set E2E_BROWSER_CHANNEL=chrome to use an installed Google Chrome (e.g. on macOS 13, which the
 * bundled Chromium no longer supports).
 */
const CI = Boolean(process.env.CI);
// Traces record network requests, which carry session cookies. Hosted and production CI runs
// set E2E_TRACE=off so no session can end up in an uploaded artifact.
const trace = process.env.E2E_TRACE === 'off' ? 'off' : 'on-first-retry';
const channel = process.env.E2E_BROWSER_CHANNEL || undefined;
const desktop = { ...devices['Desktop Chrome'], channel };

const editorial = (name: string, testMatch: RegExp, role?: 'reviewer' | 'approver' | 'admin'): Project => ({
  name,
  testMatch,
  dependencies: ['setup'],
  // Stateful: records move through the workflow one step at a time.
  fullyParallel: false,
  workers: 1,
  use: { ...desktop, ...(role ? { storageState: authFile(role) } : {}) },
});

const writingProjects: Project[] = [
  {
    name: 'setup',
    testMatch: /auth\.setup\.ts/,
    // Never record what is typed into the sign-in form.
    use: { ...desktop, trace: 'off', screenshot: 'off', video: 'off' },
  },
  editorial('reviewer', /editorial\/reviewer\.spec\.ts/, 'reviewer'),
  editorial('approver', /editorial\/approver\.spec\.ts/, 'approver'),
  editorial('admin', /editorial\/admin\.spec\.ts/, 'admin'),
  editorial('workflow', /editorial\/(lifecycle|election|correction)\.spec\.ts/),
];

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['github']]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace,
    screenshot: 'only-on-failure',
    // Video helps diagnose CI failures; locally a trace is enough.
    video: CI ? 'retain-on-failure' : 'off',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  metadata: { targetEnv, mutationsAllowed },
  projects: [
    {
      name: 'anonymous-desktop',
      testMatch: /public\/.*\.spec\.ts/,
      use: desktop,
    },
    {
      name: 'anonymous-tablet',
      testMatch: /public\/(responsive|navigation)\.spec\.ts/,
      use: { ...devices['Galaxy Tab S4'], viewport: { width: 768, height: 1024 }, channel },
    },
    {
      name: 'anonymous-mobile',
      testMatch: /public\/(responsive|navigation)\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 740 }, channel },
    },
    ...(mutationsAllowed ? writingProjects : []),
    // Only for a production target, so an ordinary run does not repeat the public tests.
    ...(targetEnv === 'production'
      ? [{ name: 'production-smoke', testMatch: /public\/.*\.spec\.ts/, grep: /@production-smoke/, use: desktop }]
      : []),
  ],
  webServer: startsLocalServer
    ? {
        // Locally an already running `npm run dev` on :3000 is reused. CI builds first and
        // sets E2E_WEB_SERVER_COMMAND="npm run start".
        command: process.env.E2E_WEB_SERVER_COMMAND ?? 'npm run dev',
        url: baseURL,
        reuseExistingServer: !CI,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
      }
    : undefined,
});
