# Roadmap

## Milestone 0 — Reset architecture

- preserve native Android prototype branch
- bootstrap React Native + Expo + TypeScript project
- configure lint/format/test
- configure environment variables
- add Supabase client
- create feature folder structure
- establish CI

Exit criteria:
- Android and iOS projects run
- automated type-check/test command exists
- no political data is hard-coded in UI

## Milestone 1 — Data trust foundation

- create Supabase project
- implement schema
- implement RLS
- seed non-controversial development fixtures
- implement Source/Claim/Evidence models
- implement verification status UI

Exit criteria:
- every displayed fixture claim can open evidence metadata
- UI never consumes raw database rows directly

## Milestone 2 — Politician directory MVP

- person list
- search
- filters
- profile
- election participation
- office history
- affiliations
- source viewer

## Milestone 3 — Editorial workflow

- reviewer authentication
- draft/publish workflow
- revision history
- correction submissions
- admin/reviewer tooling

## Milestone 4 — Sensitive public records

Only after workflow is stable:

- legal proceeding timelines
- asset/public disclosure history
- richer legislative records

## Milestone 5 — 2028 election mode

- candidate status transitions
- election/office pages
- official candidate records
- ballot information where officially available
- election-result integration when appropriate

## Phase 2

- family relationship graph
- political-family visualization
- party switching timeline
- legislative vote/action history
- side-by-side neutral comparison

## Future scaling

Only when usage justifies it:
- ingestion workers
- source archiving
- full-text search service
- public web version
- analytics
- CDN/read caching
