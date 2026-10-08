# Data Trust & Governance

## Goal

Trust should come from transparent evidence and correction processes, not from asking users to trust the Gabay ni Juan brand blindly.

## Verification model

Verification applies to individual claims, not to an entire politician.

Recommended statuses:

### `PRIMARY_SOURCE`
Direct documentary evidence from an authoritative primary source.

### `CORROBORATED`
Supported by multiple credible independent sources.

### `SELF_DECLARED`
The political figure, campaign, party, or official representative stated it.

### `REPORTED`
Reported by a credible secondary source, but a stronger primary record has not been located.

### `DISPUTED`
Credible sources materially disagree.

### `UNVERIFIED`
Insufficient evidence.

### `OUTDATED`
Previously supported but no longer sufficiently current for the context.

## Verification consistency checks

Implemented in `mobile/src/domain/validation/verification.ts`. These checks flag a claim for human review. They never change a status automatically.

| Status | Requirement |
|---|---|
| any except `UNVERIFIED` | at least one attached source |
| `PRIMARY_SOURCE` | at least one *supporting* tier-1 source (official government, court/tribunal, legislative record) |
| `CORROBORATED` | supporting sources from at least two distinct publishers |
| `DISPUTED` | at least one supporting and one contradicting source |
| any except `DISPUTED`/`OUTDATED` | no contradicting source attached (a conflict must be marked `DISPUTED`) |

Development fixtures are tested against these checks.

## Display rules (Milestones 0–1)

- Each claim shows its own verification badge. Pressing the badge explains the state in evidence terms.
- All states share one neutral visual style, so no state is colored as "good" or "bad".
- Contradicting sources are shown beside supporting ones, labeled "Conflicting source".
- A record with no attached claim is shown as `UNVERIFIED` with "No source attached."
- An empty profile section reads "No records have been added for this section yet." This states that records are missing, not anything about the person.
- Records that fail validation are not displayed. The screen shows an explicit validation-failure state instead.
- Tapping "View evidence and sources" opens the claim's source viewer: status and its meaning, dates, and every source with publisher, type, published and retrieved dates, whether it supports or conflicts, and a link to the original. Supporting and conflicting sources are listed separately.
- If evidence loaded for a claim is inconsistent with its status, the viewer says the record is under review rather than hiding the problem.
- No score, rating or aggregate "trust" figure is shown anywhere.

## Database enforcement (Milestone 1)

The Supabase schema enforces the workflow below directly, so no client can bypass it. See `supabase/README.md`.

- Only `PUBLISHED` rows are readable by voters (Row Level Security), and only their non-identity columns (column-level grants).
- Only APPROVERs can move a row to `APPROVED` or `PUBLISHED`. Creator, reviewer, approver and publisher are recorded by triggers; users cannot set or alter those columns.
- A row can be published only when everything it references (person, election, office, organization, claim subject) is published.
- A claim can be published only when its evidence is consistent with its verification status (table below), and only when every cited source is published. Evidence changes to a published claim are re-validated at commit.
- Changing a published or retracted row, or the evidence of a published claim, requires an APPROVER and a stated reason (`gnj.change_reason`).
- Published or retracted rows cannot be deleted. Retract instead.
- A row cannot be unpublished while published rows depend on it.
- Every change is appended to `revisions` (JSONB before/after snapshots, editor, approver, reason). `revisions` is append-only and unreadable by voters.

For a solo-maintained prototype, one person may hold both the editor and approver role. The fields are still recorded, as required by the two-person rule above. A database-level two-person check (editor ≠ approver for sensitive tables) and an ordered state machine are Milestone 3 candidates.

### Verification rules (database and app)

Enforced before publishing by `private.claim_consistency_error` and mirrored in `mobile/src/domain/validation/verification.ts`. Nothing is corrected automatically; a violation fails with an explanation.

| Status | Rule |
|---|---|
| `UNVERIFIED` | none: "not enough evidence" is a valid published state |
| `PRIMARY_SOURCE` | at least one supporting source of type official government, court or tribunal, or legislative record |
| `CORROBORATED` | supporting sources from at least two distinct publishers |
| `SELF_DECLARED` | at least one supporting source. Typically campaign or party material, but interviews and speeches reported elsewhere are allowed, so no source-type rule |
| `REPORTED` | at least one supporting source. No source-type rule; if a primary record is later attached, a reviewer moves the claim to `PRIMARY_SOURCE` |
| `DISPUTED` | at least one supporting and one contradicting source; both are always shown |
| `OUTDATED` | at least one supporting source; contradicting sources are allowed |
| all except `DISPUTED` and `OUTDATED` | no contradicting source attached; mark the claim `DISPUTED` instead |

CI runs these rules over the fictional fixtures (`npm run test:consistency`) and the database job rebuilds the schema and runs `supabase/tests/rls_and_publication.test.sql`.

## Publication workflow

```text
DRAFT
  ↓
SOURCE_ATTACHED
  ↓
REVIEWED
  ↓
APPROVED
  ↓
PUBLISHED
```

Corrections:

```text
PUBLISHED
  ↓
CORRECTION_DRAFT
  ↓
REVIEWED
  ↓
APPROVED
  ↓
NEW_REVISION_PUBLISHED
```

Do not silently overwrite controversial or material records.

## Two-person rule

For sensitive records such as:
- legal cases
- asset disclosures
- candidacy status
- election results
- family relationships used for political-family visualizations

prefer separate editor and approver accounts before publication.

For an early solo-maintained prototype, preserve the same workflow fields even if one person performs both roles.

## Dates

Store separately:
- event date
- source publication date
- retrieval date
- verification/review date

"Last updated" alone is not enough.

## Corrections

Every published profile should eventually offer:

- Report an error
- Submit a source
- View correction history

A correction record should capture:
- challenged claim
- requester input
- supplied source
- reviewer decision
- explanation
- resulting revision

## Neutral language

Use procedural/factual language.

Prefer:
- "A complaint was filed..."
- "The case was dismissed on..."
- "The court convicted..."
- "The decision was appealed..."

Avoid:
- "corrupt"
- "criminal"
- "clean"
- "trustworthy"
- "best"
- "worst"

unless quoting or clearly attributing such wording to a source where legally and editorially appropriate.

## AI usage

AI may assist with:
- document extraction
- normalization
- duplicate detection
- translation drafts
- neutral wording checks
- source discovery

AI must not autonomously publish political facts.

Human review is required before publication.
