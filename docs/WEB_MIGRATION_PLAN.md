You are migrating **Gabay ni Juan** from a React Native-first product to a **web-first civic information platform**.

The decision is intentional.

The product mission remains unchanged:

> Help Filipino voters inspect documented public information about political figures and elections using transparent sources, evidence, verification states, and correction history.

The new primary platform is the web.

The existing React Native app should be treated as a previous frontend implementation and source of reusable TypeScript/domain logic, not as the main product going forward.

---

# Primary goal

Migrate the current repository to this target architecture:

```text
GabayNiJuan/
├── web/
│   ├── public voter experience
│   └── authenticated editorial/admin area
│
├── supabase/
├── docs/
├── archive/ or mobile/
└── shared code only where justified
```

Preferred technology:

```text
Next.js
TypeScript
React
Tailwind CSS
shadcn/ui where useful
Zod
React Hook Form
Supabase
```

Use Next.js App Router.

Prefer server rendering/server components for public read-heavy pages where appropriate.

Do not force TanStack Query everywhere. Use it only where client-side server state genuinely benefits from it.

---

# Critical rule

Do NOT rewrite or discard the backend/data-trust architecture.

The following existing work should be preserved and reused:

- Supabase schema
- migrations
- RLS
- publication workflow
- claims
- evidence
- sources
- audit/revisions
- verification rules
- fictional seed data
- generated Supabase types where useful
- Zod validation
- domain concepts
- directory query logic where portable
- source/claim verification terminology
- neutral missing-data language
- political neutrality rules

The frontend platform is changing.

The trust architecture is not.

---

# Before making changes

Read completely:

```text
AGENTS.md
README.md

docs/PRODUCT_VISION.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/DATA_TRUST_GOVERNANCE.md
docs/SOURCE_POLICY.md
docs/MVP_SCOPE.md
docs/ROADMAP.md

supabase/README.md
```

Inspect the entire existing:

```text
mobile/
supabase/
.github/
```

Specifically identify reusable code from:

```text
mobile/src/domain/
mobile/src/data/schemas/
mobile/src/data/mappers/
mobile/src/features/sources/
mobile/src/features/elections/
mobile/src/features/offices/
mobile/src/features/affiliations/
```

Before implementation, output a migration audit:

## Existing assets to preserve
List files/modules that remain authoritative.

## Logic reusable as-is
List pure TypeScript code that can move with minimal changes.

## Logic reusable with adaptation
List React Native-specific modules whose business logic can be extracted.

## React Native-only code
List screens/components that should not be ported directly.

## Proposed repository structure
Show the target structure.

## Risks
Call out:
- schema/frontend drift
- duplicated domain types
- routing changes
- SEO concerns
- auth separation
- React Native code retirement

Then proceed.

---

# 1. Repository strategy

Do not delete the React Native application immediately.

Choose one of these approaches:

### Preferred

Move or retain it as:

```text
archive/mobile-react-native/
```

only after the new web baseline is confirmed working.

OR temporarily keep:

```text
mobile/
```

with clear documentation that it is no longer the primary product.

Do not maintain two active voter frontends during the migration.

The new web app becomes the authoritative frontend.

---

# 2. Create Next.js application

Create:

```text
web/
```

Use:

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- ESLint
- Prettier if repository conventions require it
- Zod
- Supabase JS / SSR helpers
- React Hook Form when forms are needed

Use the existing package manager strategy unless there is a strong reason to change it.

Do not add unnecessary libraries.

---

# 3. Target web structure

Use a clean structure similar to:

```text
web/
├── app/
│   ├── (public)/
│   │   ├── page.tsx
│   │   ├── politicians/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   ├── elections/
│   │   ├── claims/
│   │   │   └── [id]/
│   │   ├── sources/
│   │   ├── methodology/
│   │   ├── verification/
│   │   └── corrections/
│   │
│   └── admin/
│       ├── layout.tsx
│       └── ...
│
├── components/
├── features/
├── domain/
├── data/
├── lib/
└── styles/
```

Adapt if needed, but preserve clear separation between:

```text
public voter experience
editorial/admin experience
domain/data logic
Supabase boundary
```

---

# 4. Reuse domain models

Reuse/adapt the existing TypeScript domain concepts.

At minimum preserve:

```text
Person
Election
Office
ElectionParticipation
OfficeTerm
PoliticalOrganization
AffiliationRecord
EducationRecord
PolicyPositionRecord
LegalCaseRecord
AssetDisclosureRecord
Source
Claim
ClaimEvidence
Revision
```

Do not change domain semantics just because the frontend changed.

Do not reintroduce:

```text
hasCriminalRecord
trustScore
candidateScore
politicalRating
```

---

# 5. Shared code decision

Evaluate whether the existing pure TypeScript domain/data logic should live in:

```text
packages/domain/
```

or simply under:

```text
web/src/domain/
```

Choose based on actual reuse needs.

Because React Native is no longer an active primary frontend, do NOT create a monorepo/package abstraction only for hypothetical future reuse.

Prefer simplicity.

If mobile is archived, moving authoritative domain code into `web/` may be acceptable.

Document the decision.

---

# 6. Supabase integration

Preserve the existing Supabase database and migrations.

Do NOT recreate schema from scratch.

The web app must use the existing:

```text
supabase/
```

as the database source of truth.

Maintain:

```text
Supabase
  ↓
runtime validation where appropriate
  ↓
mapper/domain
  ↓
server/data access layer
  ↓
page/component
```

Do not expose raw database rows deep into presentation code.

Generated Supabase types belong to the data layer.

Zod runtime validation should remain for critical political data.

---

# 7. Server-side public reads

Public politician/election/claim pages should generally favor server-side data fetching.

Use:

- Server Components
- server-only repository functions
- caching/revalidation where appropriate

Do not convert every page into `"use client"`.

Client Components should be introduced only for interactive features such as:

```text
search input
filters
forms
modal/dialog interactions
admin editing
```

The public political profile itself should largely be renderable server-side.

---

# 8. SEO and metadata

SEO is now a first-class requirement.

Implement proper metadata for public pages.

At minimum:

```text
title
description
canonical URL strategy
Open Graph metadata
Twitter/social card metadata where appropriate
```

Politician pages should have meaningful metadata.

Do not put unsupported political conclusions in SEO copy.

Example:

```text
Juan Halimbawa — Political Record | Gabay ni Juan
```

not:

```text
Juan Halimbawa — Best Candidate for 2028
```

---

# 9. Stable public URLs

Introduce readable URLs for people.

Add a stable `slug` concept if not already present.

Example:

```text
/politicians/juan-halimbawa
```

Keep UUID as the database identity.

Do not use name alone as relational identity.

Slug requirements:

- unique
- stable
- lowercase
- URL-safe
- collision-safe

If adding `slug` requires a database migration, create a new migration.

Do not modify applied migrations.

Document slug-change policy.

Prefer slugs that remain stable even if display names change.

---

# 10. Public routes

Implement the first web MVP routes:

```text
/
 /politicians
 /politicians/[slug]
 /claims/[id]
 /verification
 /methodology
```

Optional if straightforward:

```text
/elections
/elections/[id-or-slug]
```

Do not add unrelated features.

---

# 11. Home page

Recreate the mission-focused landing page for web.

Suggested content:

```text
Gabay ni Juan

Know the record.
Check the sources.
Decide for yourself.

[ Search politicians ]

Browse the public record

How verification works

Political neutrality statement
```

Do not add:

```text
Trending politicians
Top candidates
Most viewed
Most trusted
Recommended for you
```

---

# 12. Politician directory

Port the proven Milestone 2 behavior to web.

Preserve:

- alphabetical ordering
- neutral search
- election filters
- office filters
- office level
- participation status
- political organization
- pagination
- neutral empty-state wording

Desktop and mobile web layouts should both work well.

Do not mechanically recreate React Native cards.

Design appropriately for web.

---

# 13. Search and filters

Use URL search parameters for public directory state where practical.

Example:

```text
/politicians?q=juan&election=2028&office=senator
```

Benefits:

- shareable search/filter states
- back/forward navigation
- bookmarkable pages
- server rendering

Prefer URL state over hidden client-only Zustand state for public directory filters.

Keep URLs readable.

---

# 14. Directory pagination

Reuse the existing Supabase directory search function where appropriate.

The existing deterministic alphabetical search logic is valuable.

Do not change ordering to relevance/popularity unless explicitly justified later.

Default must remain:

```text
NAME_ASC
```

For web, simple page-based pagination is acceptable.

Example:

```text
?page=2
```

You do not need infinite scrolling.

Prefer crawlable, shareable pagination.

---

# 15. Politician profile page

Rebuild the profile for web using the existing hierarchy:

```text
Header

Election Participation

Public Office History

Political Affiliations

Education

Policy Positions

Sources
```

Do not add legal cases or asset disclosures yet unless already explicitly scheduled for a later milestone.

Use semantic HTML.

Consider:

```text
article
section
nav
time
dl
```

where appropriate.

---

# 16. Evidence-first UX

Preserve and improve:

```text
Record
   ↓
Claim
   ↓
Evidence
   ↓
Source
```

Web makes this especially important.

Claims should be linkable.

Example:

```text
/claims/<id>
```

The claim page should show:

```text
claim statement
verification status
effective dates
last reviewed
supporting evidence
contradicting evidence
source publisher
source type
publication date
retrieval date
original source URL
```

Do not collapse evidence into a politician-level badge.

---

# 17. Source links

External source links should:

- clearly identify destination
- open safely
- use appropriate `rel` attributes
- avoid misleading anchor text

Where relevant, indicate:

```text
Official government record
News report
Candidate statement
Court/tribunal record
```

Do not imply that a source type automatically proves every interpretation.

---

# 18. Web accessibility

At minimum:

- semantic headings
- keyboard navigation
- visible focus states
- accessible form labels
- proper landmarks
- sufficient contrast
- no color-only verification states
- responsive text
- skip-link if appropriate

---

# 19. Responsive design

The site must work well on:

```text
mobile browser
tablet
desktop
```

This web-first pivot should not mean desktop-only.

Aim for excellent mobile web UX.

Do not overdesign.

---

# 20. Admin area foundation

Create the authenticated route boundary now, but do not implement the full editorial workflow unless needed to support migration.

Set up:

```text
/admin
```

with:

- Supabase Auth
- authenticated layout
- role loading
- unauthorized state

The existing database roles remain:

```text
REVIEWER
APPROVER
ADMIN
```

Do not allow public sign-up.

Do not put service-role credentials in Next.js client code.

Server-side privileged operations must still obey the intended security model.

Do not bypass RLS simply because server code exists.

---

# 21. Admin and public separation

Use route groups/layouts to keep public and admin concerns separate.

Example:

```text
app/
├── (public)/
└── admin/
```

Public pages must never depend on authenticated editorial state.

Admin UI may use richer client-side interaction.

---

# 22. Correction entry point

Preserve the planned:

```text
Report an error
```

concept.

For this migration milestone, at minimum establish the route/component architecture.

Example:

```text
/corrections/report
```

or contextual modal/page from:

```text
politician profile
claim page
```

Do not let public users directly modify political records.

If the correction backend from Milestone 3 is not yet implemented, make the UI clearly unavailable/deferred rather than creating an insecure placeholder.

---

# 23. Metadata / robots / sitemap

Add:

```text
robots.txt
sitemap.xml
```

through Next.js conventions.

Only public published pages should be indexable.

Admin routes must not be indexable.

Unpublished political records must never appear in sitemap output.

Do not index fictional development data in production.

---

# 24. Environment configuration

Use:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

for public browser-safe configuration.

Server-only variables must not use `NEXT_PUBLIC_`.

Do not expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

to client bundles.

Prefer not to use service-role at all unless a future secure server workflow explicitly requires it.

---

# 25. Free hosting

Prepare for free-tier deployment.

Preferred:

```text
Vercel
+
Supabase Free
```

Do not add paid dependencies.

Keep Cloudflare Pages as a documented alternative if compatible with the architecture.

---

# 26. Testing

Port or recreate meaningful tests.

At minimum:

## Domain/data

- validation
- mapping
- verification consistency
- directory query normalization
- neutral ordering

## Public web

- directory search
- filters
- pagination
- politician profile
- evidence navigation
- neutral missing data

## Server

- unpublished rows not exposed
- slug lookup
- claim lookup
- error handling

## Admin boundary

- unauthenticated users cannot enter `/admin`
- authenticated users without editorial role are denied
- authorized roles can enter

Do not spend time snapshot-testing pure styling.

---

# 27. CI

Update CI for the new primary application.

Required checks:

```text
web install
web typecheck
web lint
web tests
web build
Supabase migration/reset tests
RLS tests
```

React Native CI may be removed from required checks only after the mobile frontend is formally archived.

Do not silently delete historical CI without documenting why.

---

# 28. Mobile retirement strategy

Once the public web MVP reaches functional parity with the important Milestone 2 behavior:

- directory
- search
- filters
- profile
- claims
- sources

then archive the React Native app.

Preferred destination:

```text
archive/mobile-react-native/
```

or retain branch/history and remove it from the active default branch if that is cleaner.

Do not archive it before web parity is verified.

Document:

- why the mobile-first approach was retired
- what logic was migrated
- what remains reusable for a future mobile companion

Do not frame this as project failure.

It is an intentional product-platform pivot.

---

# 29. Update product documentation

Update:

```text
README.md
docs/ARCHITECTURE.md
docs/MVP_SCOPE.md
docs/ROADMAP.md
docs/PRODUCT_VISION.md
```

Create:

```text
docs/WEB_MIGRATION.md
```

Document:

- rationale for web-first
- new stack
- architecture
- reuse strategy
- mobile retirement strategy
- URL strategy
- SEO strategy
- deployment strategy

---

# 30. Update AGENTS.md

Update agent instructions so future AI coding agents understand:

```text
Web is now the primary product.
Next.js is the primary frontend.
Supabase remains authoritative.
Political neutrality remains mandatory.
Claims/evidence/sources remain mandatory.
No real political claim may be invented.
```

Remove obsolete instructions that assume React Native is the primary frontend.

Do not remove useful political safety/governance rules.

---

# 31. Preserve neutrality

The platform must never implement:

```text
candidate recommendations
best candidate
worst candidate
politician trust score
politician credibility score
popularity ranking
political persuasion engine
personalized voting recommendation
```

Directory ordering remains neutral.

Search should find records, not persuade voters.

---

# 32. No real-data expansion yet

This migration milestone is about platform migration.

Do not use the migration as an excuse to start bulk importing real politicians.

Use fictional development data until the web foundation is validated.

---

# Definition of Done

The web migration milestone is complete when:

1. `web/` Next.js app exists.
2. TypeScript strict mode works.
3. Existing Supabase backend is reused.
4. Existing migrations remain authoritative.
5. Directory works on web.
6. Search works.
7. Filters work.
8. Pagination works.
9. Politician profile works.
10. Claims can be opened.
11. Evidence and sources are visible.
12. Public pages use server rendering where appropriate.
13. Public URLs are shareable.
14. Stable politician slugs exist.
15. SEO metadata exists.
16. Sitemap exists.
17. Admin routes are protected.
18. Admin routes are excluded from indexing.
19. RLS still prevents unpublished records from public access.
20. No service-role key reaches the browser.
21. Mobile and desktop browser layouts work.
22. Tests pass.
23. Web build passes.
24. Supabase tests still pass.
25. CI is updated.
26. Documentation reflects web-first architecture.
27. React Native is not archived until web feature parity is confirmed.
28. No real political data was added during migration.

---

# Final response format

When finished, provide:

## Migration summary
What changed from mobile-first to web-first.

## Reused architecture
What was preserved from the React Native/Supabase implementation.

## New web structure
Important routes, directories, components, and server/data boundaries.

## SEO
Explain slugs, metadata, sitemap, and indexability rules.

## Supabase
Confirm what schema/RLS logic remained unchanged and list any new migrations.

## Admin foundation
Explain authentication/role protection implemented.

## Mobile status
Explain whether React Native remains active, frozen, or ready to archive.

## Tests and CI
List checks completed.

## Manual verification
List exact browser/device/deployment checks I should perform.

## Remaining work
List migration items not yet complete.

## Next milestone
Recommend the next milestone after web parity, but do not implement it.