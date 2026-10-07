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
