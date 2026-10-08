# Current `develop` Branch Audit

> **Status (2026-10-07):** This audit describes the `develop` branch (`origin/develop`), which still holds the native Android prototype. The React Native app lives in `mobile/` on the `development` branch, which shares only the initial commit with `develop`. The prototype has not been modified or deleted.

## Existing implementation

The `develop` branch contains an early native Android prototype.

Observed technologies:
- Kotlin
- Jetpack Compose
- Hilt
- StateFlow/ViewModel
- repository/use-case style layering
- Firebase Realtime Database

Observed data classes include:
- `CandidateEntity`
- `PartyListEntity`
- `PositionEntity`
- domain `Candidate`
- domain `Position`

## Reusable ideas

The following concepts can be carried into React Native:

- candidate/person identifier
- structured name fields
- birth information
- photo
- education
- party/affiliation
- political experience/history
- previous offices
- public platforms/policy positions
- public wealth/disclosure information
- election positions
- party-list concepts

The Kotlin classes themselves should not be ported 1:1. Reuse the concepts, then remodel them for provenance and history.

## Fields that should NOT be copied directly

### `hasCriminalRecord: Boolean`

Remove.

It collapses many legally different situations into one unsafe flag.

Replace with a list of `LegalCaseRecord` objects with procedural status and source evidence.

### `criminalRecord: List<String>`

Replace with structured legal records.

### `criminalRecordLink`

Replace with a general evidence/source relationship, allowing more than one source.

### `netWorth: Int`

Replace with dated `AssetDisclosureRecord` entries.

### `party: String`

Replace with `AffiliationRecord[]` because affiliations can change.

### `politicalColor: String`

Do not treat political color as a political fact unless it is purely a UI field derived from an explicitly documented party/design value.

### `platformTitle`, `platformDetails`, `platformLink`

Replace with attributed `PolicyPositionRecord[]`.

### `previousPositions: List<String>`

Replace with structured office terms including jurisdiction and dates.

## Technical issues observed

The current prototype is incomplete and contains domain/data type inconsistencies. Because the codebase is early, migrating now is lower-risk than building additional Android-only features first.

## Recommendation

Keep the existing Android branch as a historical prototype/reference.

Create the production implementation in React Native rather than attempting to gradually convert the native Android project file-by-file.
