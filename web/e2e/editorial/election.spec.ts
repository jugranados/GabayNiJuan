/**
 * Election records (docs/VERIFICATION_CHECKLIST.md, step 5, "Election records";
 * docs/ELECTION_INFORMATION_MODEL.md). A fictional election, office, election office, person and
 * participations go from draft to public and are then retracted.
 */
import { ELECTION_PARTICIPATION_STATUSES, enumLabel } from '@/domain/enums';
import { PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';

import {
  attachEvidence,
  createClaim,
  createRecord,
  createSource,
  field,
  openRecord,
  recordForm,
  retract,
  saveRecord,
  saveRecordRefused,
  submitForApproval,
  transition,
  transitionRefused,
  transitionWithReason,
} from '../support/admin';
import { expect, requireMutations, test } from '../support/fixtures';
import { fictionalNames, manilaDate, uniqueSuffix } from '../support/names';
import { pollPublicText } from '../support/public';

const info = PARTICIPATION_STATUS_INFO;

test.describe('election editorial workflow', { tag: ['@editorial', '@election'] }, () => {
  test.beforeEach(() => requireMutations());

  test('election → office → election office → participations, then public pages, then retraction', async ({ as }) => {
    test.setTimeout(15 * 60_000);
    const reviewer = await as('reviewer');
    const approver = await as('approver');
    const voter = await as('anonymous');
    const names = fictionalNames(uniqueSuffix());
    const electionSlug = `${names.electionSlug}-halalan`;
    const electionDate = manilaDate(200);
    const ids = {} as Record<
      'election' | 'office' | 'electionOffice' | 'person' | 'source' | 'filed' | 'official' | 'filedClaim' | 'officialClaim',
      string
    >;

    await test.step('new election: the slug is generated from the name', async () => {
      ids.election = await createRecord(reviewer, 'elections', {
        Name: names.election,
        'Election date': electionDate,
        Status: enumLabel('UPCOMING'),
      });
      await expect(field(recordForm(reviewer, 'elections'), 'Public URL slug')).toHaveValue(names.electionSlug);
    });

    await test.step('date and status must agree', async () => {
      await saveRecordRefused(reviewer, 'elections', { Status: enumLabel('COMPLETED') }, 'An election cannot be completed before its date.');
      await openRecord(reviewer, 'elections', ids.election);
      await saveRecordRefused(
        reviewer,
        'elections',
        { 'Election date': manilaDate(-30), Status: enumLabel('UPCOMING') },
        'This election date has passed.',
      );
    });

    await test.step('an unpublished slug can be corrected', async () => {
      await openRecord(reviewer, 'elections', ids.election);
      await saveRecord(reviewer, 'elections', { 'Public URL slug': electionSlug });
      await expect(field(recordForm(reviewer, 'elections'), 'Public URL slug')).toHaveValue(electionSlug);
    });

    await test.step('new office with a generated slug, added to the election once', async () => {
      ids.office = await createRecord(reviewer, 'offices', { Name: names.office, Level: enumLabel('CITY') });
      await expect(field(recordForm(reviewer, 'offices'), 'Public URL slug')).toHaveValue(names.officeSlug);

      await openRecord(reviewer, 'elections', ids.election);
      await reviewer.getByRole('link', { name: 'Add an office to this election' }).click();
      await expect(field(recordForm(reviewer, 'election-offices'), 'Election')).toHaveValue(ids.election);
      ids.electionOffice = await createRecord(
        reviewer,
        'election-offices',
        { Office: { value: ids.office }, 'Display order': '50' },
        `?election=${ids.election}`,
      );
      await reviewer.goto(`/admin/records/election-offices/new?election=${ids.election}`);
      await saveRecordRefused(
        reviewer,
        'election-offices',
        { Office: { value: ids.office }, 'Display order': '60' },
        'This office is already part of this election.',
      );
    });

    await test.step('a participation offers the eight statuses exactly, and must use an office of the election', async () => {
      ids.person = await createRecord(reviewer, 'people', {
        'First name': names.person.first,
        'Last name': names.person.last,
      });
      await reviewer.goto(`/admin/records/participations/new?person=${ids.person}&election=${ids.election}`);
      const form = recordForm(reviewer, 'participations');
      const statuses = await field(form, 'Participation status').locator('option').evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      );
      expect(statuses).toEqual([...ELECTION_PARTICIPATION_STATUSES]);

      // Any office other than ours is not contested in this fictional election.
      const otherOffice = await field(form, 'Office').evaluate(
        (select, own) => [...(select as HTMLSelectElement).options].find((option) => option.value && option.value !== own)?.value,
        ids.office,
      );
      expect(otherOffice).toBeTruthy();
      await saveRecordRefused(
        reviewer,
        'participations',
        { Office: { value: otherOffice! }, 'Participation status': enumLabel('FILED_COC'), 'Effective from': manilaDate(-60) },
        /not recorded as contested in this election/,
      );
    });

    await test.step('succession: a filing, then "potential aspirant" is refused, then "official candidate" is a new record', async () => {
      ids.filed = await createRecord(
        reviewer,
        'participations',
        { Office: { value: ids.office }, 'Participation status': enumLabel('FILED_COC'), 'Effective from': manilaDate(-60) },
        `?person=${ids.person}&election=${ids.election}`,
      );
      await reviewer.goto(`/admin/records/participations/new?person=${ids.person}&election=${ids.election}`);
      await saveRecordRefused(
        reviewer,
        'participations',
        { Office: { value: ids.office }, 'Participation status': enumLabel('POTENTIAL_ASPIRANT'), 'Effective from': manilaDate(-30) },
        /cannot follow/,
      );
      ids.official = await createRecord(
        reviewer,
        'participations',
        { Office: { value: ids.office }, 'Participation status': enumLabel('OFFICIAL_CANDIDATE'), 'Effective from': manilaDate(-15) },
        `?person=${ids.person}&election=${ids.election}`,
      );
    });

    await test.step('each participation gets its own claim and source', async () => {
      ids.source = await createSource(reviewer, {
        title: names.sourceTitle,
        publisher: names.publisher,
        type: enumLabel('OFFICIAL_GOVERNMENT'),
        url: names.sourceUrl,
        retrieved: manilaDate(),
      });
      for (const [key, participation, what] of [
        ['filedClaim', ids.filed, 'filed a fictional certificate of candidacy'],
        ['officialClaim', ids.official, 'appeared on a fictional official list of candidates'],
      ] as const) {
        ids[key] = await createClaim(reviewer, {
          personId: ids.person,
          subjectType: enumLabel('ELECTION_PARTICIPATION'),
          subjectId: participation,
          claimType: enumLabel('CANDIDACY_STATUS'),
          statement: names.statement(what),
          verification: enumLabel('PRIMARY_SOURCE'),
        });
        await attachEvidence(reviewer, ids.source, names.sourceTitle);
      }
    });

    const order = () =>
      [
        ['sources', ids.source],
        ['people', ids.person],
        ['elections', ids.election],
        ['offices', ids.office],
        ['election-offices', ids.electionOffice],
        ['participations', ids.filed],
        ['participations', ids.official],
        ['claims', ids.filedClaim],
        ['claims', ids.officialClaim],
      ] as const;

    await test.step('REVIEWER submits everything; APPROVER approves', async () => {
      for (const [type, id] of order()) {
        await openRecord(reviewer, type, id);
        await submitForApproval(reviewer);
      }
      for (const [type, id] of order()) {
        await openRecord(approver, type, id);
        await transition(approver, 'Approve', 'APPROVED');
      }
    });

    await test.step('a participation cannot be published before its election office', async () => {
      for (const [type, id] of order().slice(0, 4)) {
        await openRecord(approver, type, id);
        await transition(approver, 'Publish', 'PUBLISHED');
      }
      await openRecord(approver, 'participations', ids.filed);
      await transitionRefused(approver, 'Publish', /election office/);
      for (const [type, id] of order().slice(4)) {
        await openRecord(approver, type, id);
        await transition(approver, 'Publish', 'PUBLISHED');
      }
    });

    await test.step('public pages: the election, its office, and the person under the exact status', async () => {
      await pollPublicText(voter, '/elections', names.election);
      await pollPublicText(voter, `/elections/${electionSlug}`, names.office);
      await voter.goto(`/elections/${electionSlug}/${names.officeSlug}`);
      const official = voter.getByRole('region', { name: `${info.OFFICIAL_CANDIDATE.groupHeading} (1)` });
      await expect(official.getByRole('link', { name: names.personLabel })).toBeVisible();
      await expect(official).toContainText(`Earlier record: ${info.FILED_COC.label}.`);
      await expect(voter.getByRole('region', { name: new RegExp(`^${info.FILED_COC.groupHeading}`) })).toHaveCount(0);
    });

    await test.step('a published slug is permanent, and stays the address when the name changes', async () => {
      await openRecord(approver, 'elections', ids.election);
      await saveRecordRefused(
        approver,
        'elections',
        { 'Public URL slug': `${electionSlug}-changed` },
        /cannot be changed/,
        { reason: 'E2E: published slug change check' },
      );
      await openRecord(approver, 'elections', ids.election);
      await saveRecord(approver, 'elections', { Name: `${names.election} (renamed)` }, { reason: 'E2E: fictional rename' });
      await expect(field(recordForm(approver, 'elections'), 'Public URL slug')).toHaveValue(electionSlug);
      await pollPublicText(voter, `/elections/${electionSlug}`, `${names.election} (renamed)`);
    });

    await test.step('a published participation status cannot be rewritten', async () => {
      await openRecord(approver, 'participations', ids.official);
      await saveRecordRefused(
        approver,
        'participations',
        { 'Participation status': enumLabel('WITHDRAWN') },
        /cannot be changed/,
        { reason: 'E2E: published status change check' },
      );
    });

    await test.step('retracting the official-candidate record regroups the person under the earlier filing', async () => {
      await retract(approver, 'claims', ids.officialClaim, 'E2E: retracting a fictional claim');
      await retract(approver, 'participations', ids.official, 'E2E: retracting a fictional participation');
      await pollPublicText(voter, `/elections/${electionSlug}/${names.officeSlug}`, `${info.FILED_COC.groupHeading} (1)`);
      await expect(voter.getByRole('region', { name: new RegExp(`^${info.OFFICIAL_CANDIDATE.groupHeading}`) })).toHaveCount(0);
    });

    await test.step('an election office with a published participation cannot be retracted', async () => {
      await openRecord(approver, 'election-offices', ids.electionOffice);
      const details = await transitionWithReason(approver, 'Retract', 'E2E: out-of-order retraction check');
      await expect(details.getByRole('alert')).toContainText('published election participations still belong to it');
    });

    await test.step('clean up: retract the rest in dependency order', async () => {
      for (const [type, id] of [
        ['claims', ids.filedClaim],
        ['participations', ids.filed],
        ['election-offices', ids.electionOffice],
        ['people', ids.person],
        ['elections', ids.election],
        ['offices', ids.office],
        ['sources', ids.source],
      ] as const) {
        await retract(approver, type, id, 'E2E cleanup: fictional election test record');
      }
      await pollPublicText(voter, '/elections', names.election, false);
    });
  });
});
