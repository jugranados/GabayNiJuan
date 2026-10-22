/**
 * Where the browser tests run and what they may do there. Read by playwright.config.ts and by
 * the specs, so the safety decision is made in one place.
 *
 * E2E_TARGET_ENV
 *   local       local Supabase stack or a dedicated test project (default). Full acceptance.
 *   hosted      an explicitly approved hosted test environment. Full acceptance.
 *   production  the deployed site. Read-only unless E2E_ALLOW_PRODUCTION_MUTATIONS=true.
 *
 * Nothing here reads or needs a Supabase key: the tests drive the app as real signed-in editors.
 */
import path from 'node:path';

export const TARGET_ENVS = ['local', 'hosted', 'production'] as const;
export type TargetEnv = (typeof TARGET_ENVS)[number];

function readTarget(): TargetEnv {
  const raw = (process.env.E2E_TARGET_ENV ?? 'local').trim().toLowerCase();
  const target = TARGET_ENVS.find((value) => value === raw);
  if (!target) {
    throw new Error(`E2E_TARGET_ENV must be one of ${TARGET_ENVS.join(', ')} (got "${raw}").`);
  }
  return target;
}

export const targetEnv: TargetEnv = readTarget();

/** Base URL of the site under test. Without E2E_BASE_URL, Playwright starts (or reuses) a local server. */
export const baseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
export const startsLocalServer = !process.env.E2E_BASE_URL;

/**
 * Whether a run may create, publish, retract or report anything. Off for production unless
 * explicitly enabled; the default is off.
 */
export const mutationsAllowed =
  targetEnv !== 'production' || process.env.E2E_ALLOW_PRODUCTION_MUTATIONS === 'true';

/**
 * Tests that could lock the only real administrator out (last-admin protection) run only
 * against a local, throwaway database.
 */
export const destructiveRoleTestsAllowed = targetEnv === 'local';

export const ROLES = ['reviewer', 'approver', 'admin', 'norole'] as const;
export type Role = (typeof ROLES)[number];
/** Roles every editorial run needs. The role-less account is optional. */
export const REQUIRED_ROLES = ['reviewer', 'approver', 'admin'] as const satisfies readonly Role[];

export type Credentials = { email: string; password: string };

/** E2E_REVIEWER_EMAIL / E2E_REVIEWER_PASSWORD, and so on. Never logged. */
export function credentialsFor(role: Role): Credentials | undefined {
  const prefix = `E2E_${role.toUpperCase()}`;
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`];
  return email && password ? { email, password } : undefined;
}

/** Names (never values) of the credential variables that are not set. */
export function missingCredentialVariables(roles: readonly Role[]): string[] {
  return roles
    .filter((role) => !credentialsFor(role))
    .flatMap((role) => [`E2E_${role.toUpperCase()}_EMAIL`, `E2E_${role.toUpperCase()}_PASSWORD`]);
}

export const AUTH_DIR = path.join(__dirname, '..', '..', 'playwright', '.auth');
export const authFile = (role: Role) => path.join(AUTH_DIR, `${role}.json`);
