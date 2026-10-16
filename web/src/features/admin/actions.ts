'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { correctionNoteRequired } from '@/domain/editorial/correctionReview';
import type { RefOption } from '@/domain/editorial/models';
import {
  buildFormSchema,
  EDITORIAL_RECORD_TYPES,
  recordTypeBySlug,
  type RecordTypeDef,
} from '@/domain/editorial/records';
import { reasonRequired } from '@/domain/editorial/workflow';
import { participationSuccessionProblem } from '@/domain/elections';
import {
  CORRECTION_STATUSES,
  EDITORIAL_ROLES,
  ELECTION_PARTICIPATION_STATUSES,
  PUBLICATION_STATUSES,
} from '@/domain/enums';
import type { ActionState } from '@/features/admin/actionState';
import { adminPaths } from '@/features/admin/paths';
import {
  EditorialAccessError,
  EditorialError,
  getEditorial,
  type Editorial,
  signInEditor,
  signOutEditor,
} from '@/server/editorial';

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};
const uuid = z.uuid();
const version = z.coerce.number().int().positive();

/**
 * Public pages are cached. When published content changes (publish, retract, or an
 * approver's edit to a published record) every public route is revalidated at once, from
 * inside the authenticated action that made the change. There is no purge endpoint.
 */
function revalidatePublicSite(): void {
  revalidatePath('/', 'layout');
}

function failure(error: unknown, values?: Record<string, string>): ActionState {
  if (error instanceof EditorialAccessError) {
    return { error: 'Your session has ended or your role has changed. Sign in again.', values };
  }
  if (error instanceof EditorialError) return { error: error.message, stale: error.stale, values };
  if (error instanceof z.ZodError) return { error: 'The form was incomplete. Reload and try again.', values };
  console.error('Editorial action failed', error);
  return { error: 'Something went wrong. Nothing was changed.', values };
}

function readFields(def: RecordTypeDef, data: FormData) {
  const raw: Record<string, string> = {};
  for (const field of def.fields) raw[field.name] = text(data, field.name);
  const parsed = buildFormSchema(def).safeParse(raw);
  if (parsed.success) return { raw, values: parsed.data as Record<string, string | null> };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? '');
    fieldErrors[key] ??= issue.message;
  }
  return { raw, fieldErrors };
}

/**
 * A participation record must fit the person's other records for the same election and office
 * (domain/elections.ts). Returns a field error for the status, or undefined. The database also
 * freezes the status of a published record; this check covers drafts and new records.
 */
async function participationFieldErrors(
  editorial: Editorial,
  values: Record<string, string | null>,
  ownId?: string,
): Promise<Record<string, string> | undefined> {
  const { person_id: personId, election_id: electionId, office_id: officeId } = values;
  if (!personId || !electionId || !officeId || !values.status || !values.effective_from) return undefined;
  const others = (await editorial.contestParticipations({ personId, electionId, officeId })).filter(
    (record) =>
      record.id !== ownId &&
      record.publicationStatus !== 'RETRACTED' &&
      record.publicationStatus !== 'REJECTED',
  );
  const problem = participationSuccessionProblem(others, {
    status: z.enum(ELECTION_PARTICIPATION_STATUSES).parse(values.status),
    effectiveFrom: values.effective_from,
  });
  return problem ? { status: problem } : undefined;
}

// ---- Session -------------------------------------------------------------------------------

/** There is no sign-up path anywhere in this app: accounts are created by an administrator. */
export async function signIn(_previous: ActionState, data: FormData): Promise<ActionState> {
  const email = text(data, 'email');
  const password = data.get('password');
  if (!email || typeof password !== 'string' || !password) {
    return { error: 'Enter your email and password.' };
  }
  const result = await signInEditor(email, password);
  if (result === 'not-configured') {
    return { error: 'Editorial sign-in is not configured for this deployment.' };
  }
  // One message for every failure, so the form does not reveal which accounts exist.
  if (!result) return { error: 'Sign-in failed. Check your email and password.' };
  redirect(adminPaths.home);
}

export async function signOut(): Promise<void> {
  await signOutEditor();
  redirect(adminPaths.login);
}

// ---- Records -------------------------------------------------------------------------------

export async function createRecordAction(
  slug: string,
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const def = recordTypeBySlug(slug);
  if (!def) return { error: 'Unknown record type.' };
  const fields = readFields(def, data);
  if (!fields.values) return { fieldErrors: fields.fieldErrors, values: fields.raw };
  let id: string;
  try {
    const editorial = await getEditorial();
    if (def.recordType === 'ELECTION_PARTICIPATION') {
      const fieldErrors = await participationFieldErrors(editorial, fields.values);
      if (fieldErrors) return { fieldErrors, values: fields.raw };
    }
    id = (await editorial.createRecord(def, fields.values)).id;
  } catch (error) {
    return failure(error, fields.raw);
  }
  redirect(adminPaths.record(def.slug, id));
}

export async function saveRecordAction(
  slug: string,
  id: string,
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const def = recordTypeBySlug(slug);
  if (!def) return { error: 'Unknown record type.' };
  const fields = readFields(def, data);
  if (!fields.values) return { fieldErrors: fields.fieldErrors, values: fields.raw };
  try {
    const editorial = await getEditorial();
    if (def.recordType === 'ELECTION_PARTICIPATION') {
      const fieldErrors = await participationFieldErrors(editorial, fields.values, id);
      if (fieldErrors) return { fieldErrors, values: fields.raw };
    }
    const saved = await editorial.updateRecord(def, {
      id: uuid.parse(id),
      expectedVersion: version.parse(data.get('version')),
      changes: fields.values,
      reason: text(data, 'reason') || undefined,
    });
    if (saved.status === 'PUBLISHED') revalidatePublicSite();
  } catch (error) {
    return failure(error, fields.raw);
  }
  revalidatePath(adminPaths.record(def.slug, id));
  return { ok: true };
}

export async function transitionAction(
  slug: string,
  id: string,
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const def = recordTypeBySlug(slug);
  if (!def) return { error: 'Unknown record type.' };
  try {
    const to = z.enum(PUBLICATION_STATUSES).parse(data.get('to'));
    const from = z.enum(PUBLICATION_STATUSES).parse(data.get('from'));
    const reason = text(data, 'reason') || undefined;
    if (reasonRequired(from, to) && !reason) return { error: 'A reason is required for this change.' };
    const editorial = await getEditorial();
    await editorial.transitionRecord(def, {
      id: uuid.parse(id),
      to,
      expectedVersion: version.parse(data.get('version')),
      reason,
    });
    if (to === 'PUBLISHED' || to === 'RETRACTED') revalidatePublicSite();
  } catch (error) {
    return failure(error);
  }
  revalidatePath(adminPaths.record(def.slug, id));
  return { ok: true };
}

// ---- Evidence ------------------------------------------------------------------------------

export async function setEvidenceAction(
  claimId: string,
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    const reason = text(data, 'reason') || undefined;
    const editorial = await getEditorial();
    await editorial.setEvidence({
      claimId: uuid.parse(claimId),
      sourceId: uuid.parse(data.get('sourceId')),
      supports: text(data, 'supports') !== 'no',
      note: text(data, 'note') || undefined,
      reason,
    });
    // A reason is only given when the claim is already published.
    if (reason) revalidatePublicSite();
  } catch (error) {
    return failure(error);
  }
  revalidatePath(adminPaths.record('claims', claimId));
  return { ok: true };
}

export async function removeEvidenceAction(
  claimId: string,
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    const reason = text(data, 'reason') || undefined;
    const editorial = await getEditorial();
    await editorial.removeEvidence({
      claimId: uuid.parse(claimId),
      sourceId: uuid.parse(data.get('sourceId')),
      reason,
    });
    if (reason) revalidatePublicSite();
  } catch (error) {
    return failure(error);
  }
  revalidatePath(adminPaths.record('claims', claimId));
  return { ok: true };
}

// ---- Corrections ---------------------------------------------------------------------------

export async function reviewCorrectionAction(
  id: string,
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    const to = z.enum(CORRECTION_STATUSES).parse(data.get('to'));
    const note = text(data, 'note') || undefined;
    if (correctionNoteRequired(to) && !note) {
      return { error: 'A resolution note is required for this decision.' };
    }
    const editorial = await getEditorial();
    await editorial.reviewCorrection({
      id: uuid.parse(id),
      status: to,
      expectedVersion: version.parse(data.get('version')),
      note,
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(adminPaths.corrections);
  revalidatePath(adminPaths.correction(id));
  return { ok: true };
}

// ---- Staff ---------------------------------------------------------------------------------

export async function setStaffRoleAction(_previous: ActionState, data: FormData): Promise<ActionState> {
  try {
    const email = z.email().parse(text(data, 'email'));
    const roleText = text(data, 'role');
    const role = roleText === '' ? null : z.enum(EDITORIAL_ROLES).parse(roleText);
    const editorial = await getEditorial('ADMIN');
    await editorial.setStaffRole(email, role);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(adminPaths.roles);
  return { ok: true };
}

// ---- Reference choices ---------------------------------------------------------------------

/** Choices for a "subject record" select, loaded when the editor picks a subject record type. */
export async function loadRefOptions(recordType: string, personId?: string): Promise<RefOption[]> {
  const type = z.enum(EDITORIAL_RECORD_TYPES).safeParse(recordType);
  if (!type.success) return [];
  const person = personId ? uuid.safeParse(personId) : undefined;
  const editorial = await getEditorial();
  const items = await editorial.queue(
    { recordType: type.data, personId: person?.success ? person.data : undefined },
    500,
  );
  return items.map(({ id, label }) => ({ id, label }));
}
