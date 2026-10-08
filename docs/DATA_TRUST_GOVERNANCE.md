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

## Display rules (Milestone 0)

- Each claim shows its own verification badge. Pressing the badge explains the state in evidence terms.
- All states share one neutral visual style, so no state is colored as "good" or "bad".
- Contradicting sources are shown beside supporting ones, labeled "Conflicting source".
- A record with no attached claim is shown as `UNVERIFIED` with "No source attached."
- An empty profile section reads "No records have been added for this section yet." This states that records are missing, not anything about the person.
- Records that fail validation are not displayed. The screen shows an explicit validation-failure state instead.

## Database enforcement (Milestone 1)

The Supabase schema enforces the workflow below directly, so no client can bypass it. See `supabase/README.md`.

- Only `PUBLISHED` rows are readable by voters (Row Level Security).
- Only APPROVERs can move a row to `APPROVED` or `PUBLISHED`. The approver is recorded in `approved_by`.
- A row can be published only when everything it references (person, election, office, organization, claim subject) is published.
- A claim can be published only with at least one source attached (unless `UNVERIFIED`), and only when every cited source is published.
- Changing a published or retracted row, or the evidence of a published claim, requires an APPROVER and a stated reason (`gnj.change_reason`).
- Published or retracted rows cannot be deleted. Retract instead.
- A row cannot be unpublished while published rows depend on it.
- Every change is appended to `revisions` (before/after snapshot, editor, approver, reason). `revisions` is append-only.

For a solo-maintained prototype, one person may hold both the editor and approver role. The fields are still recorded, as required by the two-person rule above. A database-level two-person check (editor ≠ approver for sensitive tables) is a Milestone 3 candidate.

The verification consistency checks above (for example, "PRIMARY_SOURCE needs a tier-1 source") are not yet enforced in the database. They run in the app's tests and will run in CI against seed data.

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
