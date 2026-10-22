/**
 * One fictional record set from draft to retraction, with two people (docs/VERIFICATION_CHECKLIST.md,
 * step 5: "As APPROVER", "Published-change test", "Retraction workflow"):
 *
 *   REVIEWER  drafts a source, a person, an office term and a claim, attaches evidence, submits
 *   APPROVER  approves (second person), is refused publishing out of dependency order, publishes
 *   voter     sees it on the public site
 *   APPROVER  corrects the published claim with a reason; voter sees the new value; history keeps both
 *   APPROVER  is refused retracting the person first, then retracts claim, term, person, source
 *   voter     gets 404s; the records remain, read-only, with their history in /admin
 *
 * Published rows cannot be deleted, by design, so the run ends with everything RETRACTED.
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
  recordForm,
  retract,
  saveRecord,
  submitForApproval,
  transition,
  transitionRefused,
  transitionWithReason,
  workflowBar,
} from '../support/admin';
import { expect, requireMutations, test } from '../support/fixtures';
import { fictionalNames, manilaDate, uniqueSuffix } from '../support/names';
import { pollPublicStatus, pollPublicText } from '../support/public';

test.describe('publication lifecycle', { tag: '@editorial' }, () => {
  test.beforeEach(() => requireMutations());

  test('draft → published → corrected with a reason → retracted, by two people', async ({ as }) => {
    test.setTimeout(12 * 60_000);
    const reviewer = await as('reviewer');
    const approver = await as('approver');
    const voter = await as('anonymous');
    const names = fictionalNames(uniqueSuffix());
    const statement = names.statement('held a fictional test office');
    const corrected = names.statement('held a fictional test office, as corrected');
    const ids: Record<'source' | 'person' | 'term' | 'claim', string> = { source: '', person: '', term: '', claim: '' };
    const records = () =>
      [
        ['sources', ids.source],
        ['people', ids.person],
        ['office-terms', ids.term],
        ['claims', ids.claim],
      ] as const;

    await test.step('REVIEWER drafts the records and attaches evidence', async () => {
      ids.source = await createSource(reviewer, {
        title: names.sourceTitle,
        publisher: names.publisher,
        type: enumLabel('OFFICIAL_GOVERNMENT'),
        url: names.sourceUrl,
        retrieved: manilaDate(),
      });
      ids.person = await createRecord(reviewer, 'people', {
        'First name': names.person.first,
        'Last name': names.person.last,
      });
      ids.term = await createRecord(
        reviewer,
        'office-terms',
        { Office: { first: true }, 'Term status': enumLabel('HELD'), 'Start date': manilaDate(-365) },
        `?person=${ids.person}`,
      );
      ids.claim = await createClaim(reviewer, {
        personId: ids.person,
        subjectType: enumLabel('OFFICE_TERM'),
        subjectId: ids.term,
        claimType: enumLabel('OFFICE_TERM'),
        statement,
        verification: enumLabel('PRIMARY_SOURCE'),
      });
      await attachEvidence(reviewer, ids.source, names.sourceTitle);
    });

    await test.step('REVIEWER submits everything for approval', async () => {
      for (const [type, id] of records()) {
        await openRecord(reviewer, type, id);
        await submitForApproval(reviewer);
      }
    });

    await test.step('APPROVER finds them in the queue filtered to Reviewed', async () => {
      await approver.goto('/admin/queue?status=REVIEWED');
      const queue = approver.getByRole('table', { name: 'Work queue' });
      await expect(queue.getByRole('link', { name: names.sourceTitle })).toBeVisible();
      await expect(queue.getByRole('link', { name: names.personLabel, exact: true })).toBeVisible();
    });

    await test.step('APPROVER approves; publishing the claim before its source and person is refused', async () => {
      for (const [type, id] of records()) {
        await openRecord(approver, type, id);
        await transition(approver, 'Approve', 'APPROVED');
      }
      await openRecord(approver, 'claims', ids.claim);
      await transitionRefused(approver, 'Publish', /cannot be published/);
      await expectState(approver, 'APPROVED');
    });

    await test.step('APPROVER publishes in dependency order', async () => {
      for (const [type, id] of records()) {
        await openRecord(approver, type, id);
        await transition(approver, 'Publish', 'PUBLISHED');
      }
    });

    await test.step('the voter sees the person and the claim straight away', async () => {
      await pollPublicText(voter, `/politicians/${names.personSlug}`, names.personLabel);
      await pollPublicText(voter, `/politicians?q=${encodeURIComponent(names.person.last)}`, names.personLabel);
      await pollPublicText(voter, `/claims/${ids.claim}`, statement);
      await expect(voter.getByRole('main').locator('a[href^="http"]').first()).toHaveAttribute('href', names.sourceUrl);
    });

    await test.step('REVIEWER cannot change or retract published records', async () => {
      await openRecord(reviewer, 'claims', ids.claim);
      await expect(
        reviewer.getByText('Published records can be changed only by an approver, with a reason.', { exact: false }),
      ).toBeVisible();
      await expect(workflowBar(reviewer)).toContainText('No transitions are available to your role from Published.');
      await expect(field(recordForm(reviewer, 'claims'), 'Statement')).toBeDisabled();
    });

    await test.step('APPROVER corrects the published claim; a reason is required', async () => {
      await openRecord(approver, 'claims', ids.claim);
      const reason = field(recordForm(approver, 'claims'), 'Reason for change');
      await expect(reason).toHaveAttribute('required', '');
      await saveRecord(approver, 'claims', { Statement: corrected }, { reason: 'E2E: corrected wording of a fictional claim' });
    });

    await test.step('the voter sees the corrected value; the history keeps both values and the reason', async () => {
      await pollPublicText(voter, `/claims/${ids.claim}`, corrected);
      await openRecord(approver, 'claims', ids.claim);
      const history = approver.getByRole('region', { name: 'Revision history' });
      const change = history.getByRole('table', { name: 'Changed fields' }).filter({ hasText: corrected }).first();
      await expect(change.getByRole('row', { name: /statement/ })).toContainText(statement);
      await expect(change.getByRole('row', { name: /statement/ })).toContainText(corrected);
      await expect(history.getByText('Reason: E2E: corrected wording of a fictional claim')).toBeVisible();
    });

    await test.step('retracting the person while the term and claim are published is refused', async () => {
      await openRecord(approver, 'people', ids.person);
      const details = await transitionWithReason(approver, 'Retract', 'E2E: out-of-order retraction check');
      await expect(details.getByRole('alert')).toContainText('cannot be unpublished');
      await expectState(approver, 'PUBLISHED');
    });

    await test.step('retraction needs a reason, then removes the claim from the public site', async () => {
      await openRecord(approver, 'claims', ids.claim);
      const bar = workflowBar(approver);
      await bar.getByText('Retract…', { exact: true }).click();
      await expect(bar.getByLabel('Reason for change (required)')).toHaveAttribute('required', '');
      await retract(approver, 'claims', ids.claim, 'E2E: retracting a fictional claim');
      await pollPublicStatus(voter, `/claims/${ids.claim}`, 404);
    });

    await test.step('retract the term, the person and the source; the profile is gone', async () => {
      await retract(approver, 'office-terms', ids.term, 'E2E: retracting a fictional office term');
      await retract(approver, 'people', ids.person, 'E2E: retracting a fictional person');
      await retract(approver, 'sources', ids.source, 'E2E: retracting a fictional source');
      await pollPublicStatus(voter, `/politicians/${names.personSlug}`, 404);
      await pollPublicText(voter, `/politicians?q=${encodeURIComponent(names.person.last)}`, names.personLabel, false);
    });

    await test.step('the retracted records stay in /admin, read-only, with their history', async () => {
      await openRecord(approver, 'claims', ids.claim);
      await expectState(approver, 'RETRACTED');
      await expect(approver.getByText('Retracted records are kept for the audit trail and cannot be edited.')).toBeVisible();
      await expect(workflowBar(approver)).toContainText('No transitions are available to your role from Retracted.');
      await expect(field(recordForm(approver, 'claims'), 'Statement')).toBeDisabled();
      const history = approver.getByRole('region', { name: 'Revision history' });
      await expect(history.getByText('Reason: E2E: retracting a fictional claim')).toBeVisible();
      await expect(history.getByText(`Publication state: ${enumLabel('RETRACTED')}`).first()).toBeVisible();
    });
  });
});
