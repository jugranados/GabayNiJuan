import fs from 'node:fs';

import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { authFile, baseURL, mutationsAllowed, type Role } from './env';

export { expect };

export type Actor = Role | 'anonymous';

/** A page signed in as `role` (from the storage state written by auth.setup.ts), or signed out. */
export async function openAs(browser: Browser, actor: Actor): Promise<{ context: BrowserContext; page: Page }> {
  let storageState: string | undefined;
  if (actor !== 'anonymous') {
    storageState = authFile(actor);
    if (!fs.existsSync(storageState)) {
      throw new Error(
        `No saved ${actor} session (${storageState}). Run the "setup" project with E2E_${actor.toUpperCase()}_EMAIL and E2E_${actor.toUpperCase()}_PASSWORD set.`,
      );
    }
  }
  const context = await browser.newContext({ baseURL, storageState });
  return { context, page: await context.newPage() };
}

type Fixtures = {
  /**
   * Opens a separate browser context per actor, so one test can be a REVIEWER, an APPROVER and
   * an anonymous voter at once, each with their own session. Contexts close after the test.
   */
  as: (actor: Actor) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  // Playwright's fixture callback is conventionally `use`; renamed so the React hooks lint rule ignores it.
  as: async ({ browser }, provide) => {
    const contexts: BrowserContext[] = [];
    const pages = new Map<Actor, Page>();
    await provide(async (actor) => {
      const existing = pages.get(actor);
      if (existing) return existing;
      const { context, page } = await openAs(browser, actor);
      contexts.push(context);
      pages.set(actor, page);
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

/**
 * Call at the top of every spec that creates, publishes, retracts or reports anything. The
 * config already leaves those projects out of a read-only production run; this is the second
 * lock, so a spec run directly by file name still cannot write to production.
 */
export function requireMutations(): void {
  test.skip(
    !mutationsAllowed,
    'Read-only target: E2E_TARGET_ENV=production without E2E_ALLOW_PRODUCTION_MUTATIONS=true.',
  );
}
