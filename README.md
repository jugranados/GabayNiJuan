# Gabay ni Juan

Gabay ni Juan is a neutral, evidence-first voter information platform for the Philippines.

Its purpose is to help voters understand the documented public record of political figures and election participants without endorsing, ranking, or telling users who to vote for.

## Product principles

1. Every material political claim must be traceable to evidence.
2. Primary sources are preferred over secondary reporting.
3. Allegations, charges, pending cases, dismissals, acquittals, convictions, and final judgments must never be collapsed into one label.
4. The app must separate facts, self-declared positions, reporting, analysis, and unresolved claims.
5. Candidate/election status must be time-aware.
6. Corrections must be visible and auditable.
7. The product must remain politically neutral.
8. No politician score, trust score, endorsement, ranking, or "best candidate" feature.

## Recommended stack

- React Native + TypeScript
- Expo
- Expo Router
- TanStack Query
- Zustand for lightweight local UI state
- Supabase
  - Postgres database
  - Auth for reviewers/admins
  - Storage for public documents/images where legally appropriate
  - Edge Functions only when server-side logic is needed
- Zod for runtime validation
- Jest + React Native Testing Library

See `docs/` and `AGENTS.md` before implementing features.
