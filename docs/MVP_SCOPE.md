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

## Status after Milestone 2

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
| 9. Report an error | done in Milestone 3 (person profile and claim detail; reviewed in the admin app) |

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

## Admin MVP (built in Milestone 3: `admin/`)

A separate internal web tool; see `docs/EDITORIAL_WORKFLOW.md`.

Minimum capabilities:
- create draft person
- create source
- create claim
- attach evidence
- review
- publish
- revise
- view audit history
