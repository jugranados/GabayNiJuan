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
