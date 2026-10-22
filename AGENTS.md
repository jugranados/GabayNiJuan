# AI Agent Rules — Gabay ni Juan

These rules apply to Claude Code, Copilot, OpenCode, ChatGPT, and other coding agents working on this repository.

## Where things are

- **Web is the product, and the only active frontend.** `web/` (Next.js App Router, TypeScript, Tailwind) holds the public voter site, the editorial area under `/admin`, and the single authoritative copy of the domain rules (`web/src/domain`).
- **Supabase is authoritative for data.** `supabase/migrations` is the schema source of truth. Never edit an applied migration; add a new one. Never recreate the schema.
- The editorial area is `web/src/app/admin`. It runs as the signed-in editor (anon key + their session) through `@/server/editorial`; PostgreSQL enforces roles, the state machine, reasons and the audit trail.
- `mobile/` is a frozen React Native implementation awaiting archival. Do not add features to it, and do not add a second copy of any enum or rule anywhere.
- Read `docs/WEB_MIGRATION.md` and `docs/ARCHITECTURE.md` before changing structure.

## Non-negotiable product rules

1. Gabay ni Juan is politically neutral.
2. Never create, invent, infer, or autocomplete factual information about a political figure. No real political claim may be invented; development data is fictional and labelled so.
3. Never convert an allegation into a statement of guilt.
4. Never create politician rankings, scores, endorsements, or recommendations. This includes "best", "worst", "trending", "most viewed", "most trusted", popularity or relevance ordering, credibility scores, and personalised voting suggestions.
5. Every material political fact displayed to a voter must be traceable to one or more sources. Record → claim → evidence → source must stay inspectable.
6. Prefer primary government or official documentary sources.
7. Self-declared information must be labeled as self-declared.
8. Conflicting credible sources must be preserved and marked as disputed instead of silently selecting one.
9. Historical records must not be overwritten when a dated replacement record is more appropriate.
10. Every correction that changes published political data should leave an audit trail.
11. Verification belongs to a claim, never to a person. No person-level badge, score or "verified" label.
12. Missing data is never a finding. Use the one neutral missing-records sentence.

## Coding rules

- Use TypeScript in strict mode.
- Do not use `any` for domain records.
- Validate external/backend data with Zod before it enters the domain layer.
- Keep domain models independent from Supabase response types.
- UI must consume domain/view models, not raw database rows. In `web/`, `app/`, `components/` and `features/` read through `@/server/repositories`; ESLint enforces this.
- Prefer feature-based folders.
- Prefer Server Components for public pages. Add `"use client"` only for real interaction (forms, dialogs, editorial editing).
- Public directory state belongs in URL search parameters, not hidden client state.
- Public pages must never depend on an editorial session. Use the anonymous client for public reads.
- Keep server-side credentials out of every client bundle. Only `NEXT_PUBLIC_*` values may reach a browser.
- Never use a Supabase service-role key in this repository's apps. Server code must not bypass Row Level Security.
- Prefer Row Level Security in the backend.
- Use stable identifiers instead of names as relationships. A person's `slug` is a URL, not an identity.
- No public sign-up. Editorial accounts are created by an administrator.
- Every `/admin` page and every editorial server action must obtain its session from `getEditorial()` / `getEditorialForPage()`; a layout check alone is not enough.
- Publishing, retracting or correcting published content must revalidate public pages from inside the authenticated action. Never add an unauthenticated cache-purge or webhook endpoint.
- SEO copy (titles, descriptions, social cards) must be descriptive and carry no political conclusion.
- Do not make fictional development data indexable (`SITE_INDEXABLE`).

## Required documentation updates

When changing:
- data entities -> update `docs/DATA_MODEL.md`
- verification logic -> update `docs/DATA_TRUST_GOVERNANCE.md`
- source rules -> update `docs/SOURCE_POLICY.md`
- major libraries/architecture -> update `docs/ARCHITECTURE.md`
- routes, URLs, SEO, caching, deployment -> update `docs/WEB_MIGRATION.md`
- product scope -> update `docs/MVP_SCOPE.md`
- roadmap -> update `docs/ROADMAP.md`

## Political data checklist

Before displaying a new field, answer:

- What exactly does this field assert?
- Is it time-dependent?
- Who is the source?
- Is the source primary or secondary?
- When was it published?
- When was it retrieved?
- Does another credible source conflict with it?
- Is the wording neutral?
- Can a user open the evidence?
- What happens when the information changes?

If these cannot be answered, the field is not ready for publication.
