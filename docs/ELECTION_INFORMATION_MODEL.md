# Election information model (Milestone 5)

Elections are a primary way to find people in Gabay ni Juan. A voter can go from an election to an
office, then to the people with documented participation for it, then to each person's claims and
evidence:

```text
Election  ──<  Election office  >──  Office
                    │
                    └──<  Election participation  >── Person
                                    │
                                    └──<  Claim  >──<  Evidence  >── Source
```

This document covers the URL model, the slug policy, participation terminology, the source
hierarchy for election records, the 2028 structure and how old UUID links keep working.

## Records

| Record | Table | What it asserts |
|---|---|---|
| Election | `elections` | An election with this name takes place on this date. Its status (`UPCOMING`, `ONGOING`, `COMPLETED`) is recorded, never inferred |
| Office | `offices` | A public office (name, level, opaque jurisdiction id) |
| Election office | `election_offices` | This office is contested in this election. Added in Milestone 5 |
| Election participation | `election_participations` | One person's documented relationship to one election office, in one exact status, from a date |

Every one of these is a publishable record under the same workflow, Row Level Security, audit log
and two-person rule as everything else (`docs/EDITORIAL_WORKFLOW.md`).

### Election offices

An election page lists its **published election offices**. It does not derive offices from
participations, so an office can be shown before anyone has a documented participation in it.
In that case the office shows the one neutral missing-records sentence. `sort_order` is the
presentation order on the election page (ballot order: lower first, ties by office name). It
orders offices, never people.

Integrity, enforced by PostgreSQL (`20261016090100_election_foundation.sql`):

- every participation belongs to an election office (composite foreign key on
  `(election_id, office_id)`); the trigger explains a missing one in plain language;
- a participation can be published only after its election office is published;
- an election office cannot be unpublished while published participations belong to it, and an
  election cannot be unpublished while published election offices remain;
- an office can be added to an election once (`unique (election_id, office_id)`);
- once published, an election office's election and office cannot change.

### Election date and status

- An election can never be `COMPLETED` before its date.
- An editor cannot record an election as `UPCOMING` after its date (Philippine calendar date).
- A system write (seed, migration) may leave an `UPCOMING` election in place after its date. Time
  makes it stale; it was not wrong when it was recorded. The public pages then say "The election
  date has passed. This status has not been updated yet." instead of silently changing it.

The rule lives in `web/src/domain/elections.ts` (`electionDateStatusProblem`) and in
`private.check_election_date_status()`.

## Participation terminology

The eight statuses are kept exactly. None is ever collapsed into "candidate".

| Status | Voter label | Meaning | Usually documented by |
|---|---|---|---|
| `POTENTIAL_ASPIRANT` | Potential aspirant | Reported as possibly running. Not a candidacy | News reporting |
| `PUBLICLY_DECLARED_ASPIRANT` | Publicly declared aspirant | Has said publicly that they intend to run. Not a candidate | The person's own statement |
| `FILED_COC` | Filed certificate of candidacy | A certificate was filed. Not yet confirmed as an official candidate | COMELEC / filing-office record |
| `OFFICIAL_CANDIDATE` | Official candidate | Listed as a candidate in official election records | Official COMELEC list |
| `WITHDRAWN` | Withdrawn | Withdrew from this election for this office | Withdrawal record or statement |
| `DISQUALIFIED` | Disqualified | Listed as disqualified in an official record | COMELEC or court resolution |
| `ELECTED` | Elected | Recorded as having won | Proclamation / canvass |
| `NOT_ELECTED` | Not elected | Recorded as not having won | Canvass results |

Wording lives in `web/src/features/elections/participationLabels.ts`. Only `OFFICIAL_CANDIDATE` has
`isOfficialCandidate: true`. Every office page and election page shows the same note:

> Saying you will run, or filing a certificate of candidacy, does not make someone an official
> candidate. Only people listed in official election records are shown as official candidates.

### Each status is its own claim

"X publicly declared intent to run for Y", "X filed a certificate of candidacy for Y" and "COMELEC
listed X as an official candidate for Y" are three different claims with different evidence. One
is never inferred from another. So:

- **A later status is a new, dated participation record**, with its own claim and sources. The
  earlier record stays, because it remains true that it happened (governance rule 9).
- **Once published, a participation's status, person, election and office are frozen**
  (`private.guard_participation`). A wrong record is retracted, not rewritten. Dates and the
  ballot number can still be corrected by an approver with a reason.
- **Succession is checked** when an editor creates or saves a participation
  (`participationSuccessionProblem`). The record must be a valid successor of the person's record
  dated just before it, and the record dated just after it must be a valid successor of this one.
  Retracted and rejected records are ignored. Steps can be skipped; going backwards cannot, and
  `ELECTED` / `NOT_ELECTED` are final. A disqualification can be followed by `OFFICIAL_CANDIDATE`
  (reversal), `ELECTED` or `NOT_ELECTED`.

| From | May be followed by |
|---|---|
| Potential aspirant | Publicly declared aspirant, Filed COC, Official candidate, Withdrawn |
| Publicly declared aspirant | Filed COC, Official candidate, Withdrawn |
| Filed COC | Official candidate, Withdrawn, Disqualified |
| Official candidate | Withdrawn, Disqualified, Elected, Not elected |
| Disqualified | Official candidate, Elected, Not elected |
| Withdrawn, Elected, Not elected | nothing |

### On an office page

Participants are grouped by the **exact status of their most recent record** (effective date,
then id), in the lifecycle order above, then alphabetically. A person with several records
appears once; their earlier records are listed under "Earlier record", each with its own evidence.
Every record links to its claim (`/claims/<id>`), and from there to its sources. A record without a
claim shows "Unverified · No source attached".

Counts on the election page ("Publicly declared aspirants: 1") count people by their most recent
record for each office. They are counts of records, not a measure of support, and the page says so.

## URL model

| URL | Page |
|---|---|
| `/elections` | Upcoming, Ongoing, Completed. Upcoming and ongoing are listed soonest first, completed most recent first; ties by name, then id |
| `/elections/<election-slug>` | Header (name, date, status, country), offices in ballot order with per-status counts, participation summary with directory links, source note |
| `/elections/<election-slug>/<office-slug>` | Office, election, participants grouped by exact status, directory links, status guide |
| `/politicians?election=<slug>&office=<slug>&organization=<slug>&level=<level>&status=<status>` | Directory filtered by readable values |

- An election or office page whose address uses a database UUID redirects permanently (308) to the
  slug address.
- An office that exists but is not contested in that election is a 404.
- Election pages link into the directory with filters that keep the exact status, for example
  `View official candidates` → `?election=…&office=…&status=official-candidate`. A directory
  status filter lists people with **any** record of that exact status for the election/office,
  including earlier records; the office page says so.

### SEO and structured data

- Titles: `<Election name> | Gabay ni Juan` and `<Office> — <Election> | Gabay ni Juan`.
  Descriptions say what the page lists. No persuasive or sensational wording.
- Canonical URLs always use slugs.
- Published elections and published election offices are in `sitemap.xml` (only while indexing is
  on). They are read through the anonymous repositories, so a draft never appears.
- Structured data: election pages emit schema.org `Event` (name, `startDate`, URL,
  `location: Country Philippines`) and a `BreadcrumbList`; office pages emit a `BreadcrumbList`.
  Nothing else is emitted. `Person` is still not emitted, because it would restate claims without
  their verification status. `GovernmentOrganization` is not used, because an office is a position,
  not an organization.

## Slug policy

Elections, offices and political organizations have a `slug`, with the same rule as people:

1. Lowercase ASCII words joined by single hyphens, at most 120 characters, unique per table.
2. Generated in the database on insert from the **name** when the editor leaves it empty; a
   collision gets `-2`, `-3`, …. The rule is mirrored in `web/src/domain/slug.ts`
   (`recordSlugBase`).
3. **Not** regenerated when the name changes.
4. Editors may correct it until the record is first published; after that the database refuses
   any change. Changing a published slug needs a new migration that also keeps the old address
   working with a redirect table (none exists yet).
5. The UUID remains the identity. A slug is never a foreign key.

Preferred forms (set them before publishing; the generated form is only a fallback):

| Record | Form | Examples |
|---|---|---|
| Election | `<year>-<scope>-election` | `2028-philippine-general-election` |
| National office | `<office>` | `president`, `vice-president`, `senator` |
| Local office | `<office>-<place>` | `governor-bataan`, `mayor-quezon-city`, `representative-bataan-1st-district` |
| Organization | short name | `sample-party` |

**Fictional records keep `fictional` in their slug** (for example
`national-and-district-election-2028-fictional`), so development data never occupies an address a
real record will need. Their slugs equal what the database generates from their names, so a
database upgraded by the migration backfill and a freshly seeded one agree.

### Organizations

Organizations have no public page. They got a slug anyway, because the directory's
`?organization=` filter is a public, shareable URL and a readable one is materially better than a
UUID. The cost is one column and the shared slug trigger.

## Readable filters and UUID compatibility

`web/src/features/politicians/directoryParams.ts`:

1. `parseDirectoryState` reads `election`, `office` and `organization` as references (a slug, or
   an id from an old link). Anything not slug- or id-shaped is dropped.
2. `resolveDirectoryState` matches each reference against the public filter options: slug first,
   then id. It returns the ids for the query and the canonical state written with slugs.
3. If an id was used, the page **redirects permanently** to the readable URL, and the canonical
   URL in its metadata is the readable one, so the two never exist as separate indexable pages.
4. A reference that matches no public record is kept and shown as "Not found", and the result is
   empty. It is never silently dropped, which would widen a stale link into an unfiltered list.
5. `search_directory` still takes ids. Slugs are resolved by the app on the server.

The lookup uses the full filter option lists. That is fine for the current data size. With a
national set of offices, resolve each reference with a single `eq('slug', …)` query instead (and
the office filter becomes a typeahead; see `docs/ROADMAP.md`).

## 2028 structure

The fictional fixtures model the 2028 cycle with a small representative subset, not the whole
office hierarchy:

```text
National and District Election 2028 (fictional)        2028-05-08, UPCOMING
├── President (fictional seat)                          no participants (empty state)
├── Vice President (fictional seat)                     no participants (empty state)
├── Senator (fictional seat)                            potential aspirant, publicly declared aspirant, withdrawn
├── District Representative, Halimbawa 1st District     filed certificate of candidacy
├── Governor, Province of Kathang-Isip                  no participants
└── Municipal Mayor, Bayan ng Ejemplo                   no participants
```

The 2027 fictional city election shows every distinction on one office page (potential
aspirant, filed COC, official candidate, disqualified).

No real 2028 data is loaded. When the real-data pilot starts, an editor creates the real election
(`2028-philippine-general-election`), its offices and election offices from COMELEC records, each
with a source, before any participation. The fictional seed must be removed from that database
first (`supabase/seed.sql` refuses to run against non-fixture published people).

## Source hierarchy for election records

See `docs/SOURCE_POLICY.md`, "Election records". In short: COMELEC first, then other official
election records, then official government publications, then the candidate's or party's own
statement (only for what they say about themselves, labelled self-declared), then reputable
reporting for corroboration and context. An official-candidate status needs an official list.

## Editorial area

- Elections, offices and organizations have a "Public URL slug" field (editable until published).
- **Election offices** are a record type (`/admin/records/election-offices/…`) with election,
  office and display order.
- An election's editorial page lists its offices and links to "Add an office to this election" and
  "New election participation in this election" (both prefilled).
- The participation form explains that each later status is a new record, and the server action
  refuses records that break the succession rules, with the reason on the status field.
- The election form refuses a date/status pair that disagrees.
- Duplicate slugs and duplicate election offices are explained in plain language.

## Hosted status

Both Milestone 5 migrations were applied to the hosted development project on 2026-10-16
(`supabase db push`). The backfill created five published election offices from existing
participations, each audited; the fictional seed was then re-run, adding the new offices and
aligning display order, so hosted data equals a fresh seed. The hosted integration test (election
pages, office pages and exact statuses equal to the fixtures) passes, and the election routes were
checked against a production build reading hosted. Editorial acceptance of election records with
real accounts is still open (`docs/VERIFICATION_CHECKLIST.md`, step 5, "Election records").
