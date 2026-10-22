/**
 * Every record an E2E run creates is obviously fictional: a fixed "E2E Fictional" prefix, a
 * "(fictional)" marker, reserved example domains, and a short run suffix so repeated runs do
 * not collide. No real person, party, office or claim is ever named.
 */
export const E2E_PREFIX = 'E2E Fictional';

/** Lowercase letters and digits, so names turn into clean slugs. */
export function uniqueSuffix(): string {
  const time = Date.now().toString(36);
  const random = Math.floor(Math.random() * 36 ** 3).toString(36).padStart(3, '0');
  return `${time}${random}`;
}

export function fictionalNames(suffix: string) {
  return {
    sourceTitle: `${E2E_PREFIX} Source ${suffix} (fictional)`,
    newsSourceTitle: `${E2E_PREFIX} News Report ${suffix} (fictional)`,
    publisher: `${E2E_PREFIX} Records Office (fictional)`,
    sourceUrl: `https://example.org/e2e-fictional/${suffix}`,
    person: { first: E2E_PREFIX, last: `Person ${suffix}` },
    /** What the database generates from the person's name. */
    personSlug: `e2e-fictional-person-${suffix}`,
    personLabel: `${E2E_PREFIX} Person ${suffix}`,
    election: `${E2E_PREFIX} Election ${suffix}`,
    electionSlug: `e2e-fictional-election-${suffix}`,
    office: `${E2E_PREFIX} Office ${suffix}`,
    officeSlug: `e2e-fictional-office-${suffix}`,
    statement: (what: string) => `${E2E_PREFIX} Person ${suffix} ${what} (fictional record for automated testing).`,
  };
}

const MANILA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** A Philippine calendar date `days` from today, as YYYY-MM-DD (the date rule the app uses). */
export function manilaDate(days = 0): string {
  return MANILA.format(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}
