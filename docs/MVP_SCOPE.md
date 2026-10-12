# MVP Scope

## MVP objective

Allow a voter to find a political figure connected to the 2028 Philippine election cycle and inspect a neutral, source-backed profile.

## Phase 0 — Foundation

Must be completed before mass data entry.

- product neutrality rules
- data schema
- source hierarchy
- verification statuses
- editorial workflow
- correction/audit model
- database RLS rules
- contributor/admin roles

## Status after the web migration

The voter MVP is delivered by the web app (`web/`). Screens below are web pages.

| MVP screen | Web route | State |
|---|---|---|
| 1. Home | `/` | done |
| 2. Search / browse people | `/politicians` | done (search, page-based pagination) |
| 3. Filter by election / office / location | `/politicians?…` | done for election, office, level, status, organization. **Location is deferred** until jurisdictions have names |
| 4. Person profile | `/politicians/<slug>` | done |
| 5. Election participation | profile section | done |
| 6. Political / office history | profile sections | done (timeline) |
| 7. Sources / evidence viewer | `/claims/<id>` | done |
| 8. About verification | `/verification`, `/methodology` | done |
| 9. Report an error | `/corrections/report` | done (needs the `corrections_and_staff` migration on the database) |

In scope for the web MVP and done: stable slugs, SEO metadata, `robots.txt`, `sitemap.xml`, and the `/admin` authentication boundary. Not in scope yet: `/elections` pages (Milestone 5), photos, readable filter URLs for elections/offices/organizations.

## Status after Milestone 2 (mobile, historical)

| MVP screen | State |
|---|---|
| 1. Home | done |
| 2. Search / browse people | done (cards, search, pagination) |
| 3. Filter by election / office / location | done for election, office, level, status, organization. **Location is deferred** until jurisdictions have names |
| 4. Person profile | done |
| 5. Election participation | done |
| 6. Political / office history | done (timeline) |
| 7. Sources / evidence viewer | done (`/claims/[id]`) |
| 8. About verification | done |
| 9. Report an error | done in Milestone 3 (person profile and claim detail; reviewed in the editorial area) |

## Phase 1 — Voter MVP

### Screens

1. Home
2. Search / browse people
3. Filter by election/office/location
4. Person profile
5. Election participation
6. Political/office history
7. Sources/evidence viewer
8. About verification
9. Report an error

### Profile content

- name/photo
- current public role where applicable
- 2028 election status
- office sought (when documented)
- party/affiliation timeline
- office history
- education
- attributed policy/platform records
- selected public disclosures where legally available
- structured legal proceeding records where reliably documented
- source/evidence links
- last reviewed date

## Not MVP

- political-family/dynasty graph
- comments
- social feed
- user political profiles
- candidate scores
- vote recommendations
- election prediction
- polling aggregation
- crowdsourced direct publishing
- AI chatbot making candidate recommendations

## Admin MVP (`web/`, under `/admin`)

Built in Milestone 3 as a separate Vite tool and moved into the web app during consolidation; see `docs/EDITORIAL_WORKFLOW.md`.

Minimum capabilities:
- create draft person
- create source
- create claim
- attach evidence
- review
- publish
- revise
- view audit history
