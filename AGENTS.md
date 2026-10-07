# AI Agent Rules — Gabay ni Juan

These rules apply to Claude Code, Copilot, OpenCode, ChatGPT, and other coding agents working on this repository.

## Non-negotiable product rules

1. Gabay ni Juan is politically neutral.
2. Never create, invent, infer, or autocomplete factual information about a political figure.
3. Never convert an allegation into a statement of guilt.
4. Never create politician rankings, scores, endorsements, or recommendations.
5. Every material political fact displayed to a voter must be traceable to one or more sources.
6. Prefer primary government or official documentary sources.
7. Self-declared information must be labeled as self-declared.
8. Conflicting credible sources must be preserved and marked as disputed instead of silently selecting one.
9. Historical records must not be overwritten when a dated replacement record is more appropriate.
10. Every correction that changes published political data should leave an audit trail.

## Coding rules

- Use TypeScript in strict mode.
- Do not use `any` for domain records.
- Validate external/backend data with Zod before it enters the domain layer.
- Keep domain models independent from Supabase response types.
- UI must consume domain/view models, not raw database rows.
- Prefer feature-based folders.
- Keep server-side credentials out of the mobile app.
- Never place a Supabase service-role key in client code.
- Prefer Row Level Security in the backend.
- Use stable identifiers instead of names as relationships.

## Required documentation updates

When changing:
- data entities -> update `docs/DATA_MODEL.md`
- verification logic -> update `docs/DATA_TRUST_GOVERNANCE.md`
- source rules -> update `docs/SOURCE_POLICY.md`
- major libraries/architecture -> update `docs/ARCHITECTURE.md`
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
