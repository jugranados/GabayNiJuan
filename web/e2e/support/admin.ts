/**
 * Editorial-area helpers. They drive the real forms with accessible locators (labels, roles,
 * button names), so a test fails if an editor could not find the control either.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { recordTypeBySlug } from '@/domain/editorial/records';
import { enumLabel, type PublicationStatus } from '@/domain/enums';

import { E2E_PREFIX } from './names';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A form control by its visible label; required fields carry a trailing " *". */
export function field(scope: Page | Locator, label: string): Locator {
  return scope.getByLabel(new RegExp(`^${escape(label)}( \\*)?$`));
}

/**
 * Text for an input; for a `<select>`, an option label, an exact option value (`{ value: id }`),
 * or `{ first: true }` for its first real choice that is not an E2E record (so a seed record,
 * which is published; an E2E record left over from an interrupted run may not be).
 */
export type FieldValue = string | { value: string } | { label: string } | { first: true };

export async function fillFields(scope: Locator, values: Readonly<Record<string, FieldValue>>): Promise<void> {
  for (const [label, value] of Object.entries(values)) {
    const control = field(scope, label);
    const tag = await control.evaluate((element) => element.tagName);
    if (tag === 'SELECT') {
      if (typeof value === 'string') await control.selectOption({ label: value });
      else if ('first' in value) await control.selectOption({ value: await firstOptionValue(control, { skipE2E: true }) });
      else await control.selectOption(value);
    } else {
      if (typeof value !== 'string') throw new Error(`"${label}" is a text field`);
      await control.fill(value);
    }
  }
}

function singular(typeSlug: string): string {
  const def = recordTypeBySlug(typeSlug);
  if (!def) throw new Error(`Unknown record type "${typeSlug}"`);
  return def.singular;
}

/** The generated details form of a record type ("person form", "claim form", ...). */
export function recordForm(page: Page, typeSlug: string): Locator {
  return page.getByRole('form', { name: `${singular(typeSlug)} form` });
}

export function recordIdFromUrl(page: Page): string {
  const id = new RegExp(`/admin/records/[a-z-]+/(${UUID})`).exec(page.url())?.[1];
  if (!id) throw new Error(`Not on a record page: ${page.url()}`);
  return id;
}

/** Opens the "New …" form (optionally prefilled, e.g. `?person=<id>`), saves a draft, returns the new id. */
export async function createRecord(
  page: Page,
  typeSlug: string,
  values: Readonly<Record<string, FieldValue>>,
  query = '',
): Promise<string> {
  await page.goto(`/admin/records/${typeSlug}/new${query}`);
  await expect(page.getByRole('heading', { level: 1, name: `New ${singular(typeSlug)}` })).toBeVisible();
  const form = recordForm(page, typeSlug);
  await fillFields(form, values);
  await form.getByRole('button', { name: 'Save draft' }).click();
  await expect(page, `"${typeSlug}" draft was not saved; see the form errors in the screenshot`).toHaveURL(
    new RegExp(`/admin/records/${typeSlug}/${UUID}$`),
  );
  await expectState(page, 'DRAFT');
  return recordIdFromUrl(page);
}

/** "Version 3 · Created by …" under the record heading. */
async function recordVersion(page: Page): Promise<number> {
  const line = await page.getByText(/^Version \d+ · Created by/).innerText();
  return Number(/^Version (\d+)/.exec(line)?.[1]);
}

/**
 * Submits the form of the record currently open and waits until the saved version is shown.
 * (Every content change increments `version`; the form then reloads with the saved values.)
 */
export async function saveRecord(
  page: Page,
  typeSlug: string,
  values: Readonly<Record<string, FieldValue>>,
  options: { reason?: string } = {},
): Promise<void> {
  const before = await recordVersion(page);
  const form = recordForm(page, typeSlug);
  await fillFields(form, values);
  if (options.reason !== undefined) await field(form, 'Reason for change').fill(options.reason);
  await form.getByRole('button', { name: /^Save (draft|change)$/ }).click();
  await expect(page.getByText(new RegExp(`^Version ${before + 1} · Created by`))).toBeVisible();
  await expect(form.getByRole('alert')).toHaveCount(0);
}

/** Submits the form and expects it to be refused with `message` (a field error or the form error). */
export async function saveRecordRefused(
  page: Page,
  typeSlug: string,
  values: Readonly<Record<string, FieldValue>>,
  message: string | RegExp,
  options: { reason?: string } = {},
): Promise<void> {
  const form = recordForm(page, typeSlug);
  await fillFields(form, values);
  if (options.reason !== undefined) await field(form, 'Reason for change').fill(options.reason);
  await form.getByRole('button', { name: /^Save (draft|change)$/ }).click();
  await expect(form.getByRole('alert').filter({ hasText: message }).first()).toBeVisible();
}

export async function openRecord(page: Page, typeSlug: string, id: string): Promise<void> {
  await page.goto(`/admin/records/${typeSlug}/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export function workflowBar(page: Page): Locator {
  return page.getByRole('region', { name: 'Publication workflow' });
}

/** The publication state shown in the record's heading. */
export async function expectState(page: Page, status: PublicationStatus): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Publication state: ${enumLabel(status)}`);
}

/** Presses a workflow button that needs no reason ("Mark sources attached", "Approve", ...). */
export async function transition(page: Page, button: string, expected: PublicationStatus): Promise<void> {
  await workflowBar(page).getByRole('button', { name: button, exact: true }).click();
  await expectState(page, expected);
}

/** Presses a workflow button and expects the database (or the server action) to refuse it. */
export async function transitionRefused(page: Page, button: string, message: string | RegExp): Promise<void> {
  const bar = workflowBar(page);
  await bar.getByRole('button', { name: button, exact: true }).click();
  await expect(bar.getByRole('alert').filter({ hasText: message })).toBeVisible();
}

/** Opens "Retract…" / "Reject…", gives the reason and confirms. */
export async function transitionWithReason(
  page: Page,
  action: 'Retract' | 'Reject',
  reason: string,
  expected?: PublicationStatus,
): Promise<Locator> {
  const bar = workflowBar(page);
  const details = bar.locator('details').filter({ has: page.getByText(`${action}…`, { exact: true }) });
  await details.getByText(`${action}…`, { exact: true }).click();
  await details.getByLabel(/^Reason/).fill(reason);
  await details.getByRole('button', { name: `Confirm: ${action}` }).click();
  if (expected) await expectState(page, expected);
  return details;
}

/** DRAFT → SOURCE_ATTACHED → REVIEWED: what a reviewer does before handing a record to an approver. */
export async function submitForApproval(page: Page): Promise<void> {
  await transition(page, 'Mark sources attached', 'SOURCE_ATTACHED');
  await transition(page, 'Submit for approval', 'REVIEWED');
}

export async function retract(page: Page, typeSlug: string, id: string, reason: string): Promise<void> {
  await openRecord(page, typeSlug, id);
  await transitionWithReason(page, 'Retract', reason, 'RETRACTED');
}

/** Attaches a source to the open claim and waits for it to be listed. */
export async function attachEvidence(
  page: Page,
  sourceId: string,
  sourceTitle: string,
  relationship: 'Supports the claim' | 'Contradicts the claim' = 'Supports the claim',
): Promise<void> {
  const evidence = page.getByRole('region', { name: 'Evidence' });
  const attach = evidence.getByRole('form', { name: 'Attach evidence' });
  await attach.getByLabel('Source', { exact: true }).selectOption({ value: sourceId });
  await attach.getByLabel('Relationship').selectOption({ label: relationship });
  await attach.getByRole('button', { name: 'Attach evidence' }).click();
  await expect(evidence.getByRole('link', { name: sourceTitle })).toBeVisible();
}

export function readiness(page: Page): Locator {
  return page.getByRole('region', { name: 'Verification requirements' });
}

/** The first real choice of a select (skipping the "Select…" placeholder and, optionally, E2E records). */
export async function firstOptionValue(select: Locator, options: { skipE2E?: boolean } = {}): Promise<string> {
  const value = await select.evaluate(
    (element, skipPrefix) =>
      [...(element as HTMLSelectElement).options].find(
        (option) => option.value !== '' && !(skipPrefix && option.text.startsWith(skipPrefix)),
      )?.value,
    options.skipE2E ? E2E_PREFIX : '',
  );
  if (!value) throw new Error('The select has no choices');
  return value;
}

/** A source with a URL and a retrieval date, saved as a draft. */
export async function createSource(
  page: Page,
  source: { title: string; publisher: string; type: string; url: string; retrieved: string },
): Promise<string> {
  return createRecord(page, 'sources', {
    Title: source.title,
    Publisher: source.publisher,
    'Source type': source.type,
    URL: source.url,
    'Retrieved on': source.retrieved,
  });
}

/** A claim about one of a person's records, with its evidence attached; left as a draft. */
export async function createClaim(
  page: Page,
  claim: {
    personId: string;
    subjectType: string;
    subjectId: string;
    claimType: string;
    statement: string;
    verification: string;
  },
): Promise<string> {
  return createRecord(
    page,
    'claims',
    {
      'Subject person': { value: claim.personId },
      'Subject record type': claim.subjectType,
      'Subject record': { value: claim.subjectId },
      'Claim type': claim.claimType,
      Statement: claim.statement,
      'Verification status': claim.verification,
    },
  );
}
