# Claude Code Bootstrap Prompt

Use the following prompt when beginning the React Native migration.

---

You are working on Gabay ni Juan, a politically neutral, evidence-first voter information application for the Philippines.

Read these files before changing code:

1. `AGENTS.md`
2. `docs/PRODUCT_VISION.md`
3. `docs/CURRENT_REPO_AUDIT.md`
4. `docs/ARCHITECTURE.md`
5. `docs/DATA_MODEL.md`
6. `docs/DATA_TRUST_GOVERNANCE.md`
7. `docs/SOURCE_POLICY.md`
8. `docs/MVP_SCOPE.md`
9. `docs/ROADMAP.md`
10. `docs/MIGRATION_FROM_ANDROID.md`

Task:

1. Inspect the existing repository before editing.
2. Preserve the Android prototype until the React Native bootstrap is validated.
3. Create a new React Native + Expo + TypeScript baseline using the architecture in the docs.
4. Use strict TypeScript.
5. Add the proposed feature-first folder structure.
6. Add linting, formatting, typecheck, and unit-test scripts.
7. Create domain model definitions only; do not invent real politician data.
8. Add Zod schemas for external/backend payload validation.
9. Add repository interfaces, but keep backend implementation minimal until Supabase configuration is available.
10. Add placeholder development fixtures using clearly fictional names only.
11. Do not implement candidate ratings, trust scores, endorsements, or recommendations.
12. Do not implement `hasCriminalRecord`.
13. Do not represent potential 2028 aspirants as official candidates.
14. Update documentation if implementation decisions differ from the current docs.

Before coding, output:
- repository findings
- files you intend to add/change
- assumptions
- risks

Then implement in small reviewable steps.
