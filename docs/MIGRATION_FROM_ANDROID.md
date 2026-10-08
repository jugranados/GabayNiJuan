# Migration from Current Android Prototype

## Strategy

Do not translate Kotlin files line-by-line.

Treat the Android project as:
1. a record of the initial idea
2. a source of domain concepts
3. a reference for naming

Rebuild the production client in React Native.

## Concept mapping

| Android prototype | React Native target |
|---|---|
| `CandidateEntity` | `Person` + related historical/source-backed records |
| `Candidate` | domain `PersonProfile` read model |
| `PositionEntity` | `Office` + `ElectionParticipation` |
| `PartyListEntity` | `PoliticalOrganization` + organization/election-specific records |
| Repository interface | TypeScript repository interfaces/hooks |
| Hilt | module composition + explicit dependency boundaries |
| StateFlow | TanStack Query / React state / Zustand where appropriate |
| Firebase DatabaseReference | Supabase repository implementation |
| Compose | React Native components |

## Data fields to transform

### Safe-ish identity concepts
Reuse conceptually:
- `id`
- first/middle/last name
- birthday
- photo URL

### Derive, don't store
- age

### Normalize
- party
- previous positions
- education
- awards

### Replace completely
- `hasCriminalRecord`
- `criminalRecord`
- `criminalRecordLink`
- `netWorth`
- `platformTitle`
- `platformDetails`
- `platformLink`
- `politicalColor`

## Proposed TypeScript read model

The UI may consume a composed read model:

```ts
export type PersonProfile = {
  person: Person;
  electionParticipations: ElectionParticipation[];
  officeTerms: OfficeTerm[];
  affiliations: AffiliationRecord[];
  education: EducationRecord[];
  policyPositions: PolicyPositionRecord[];
  legalCases: LegalCaseRecord[];
  disclosures: AssetDisclosureRecord[];
  evidenceSummary: EvidenceSummary;
};
```

This is a view/read model, not the database table design.

## Repository preservation

> **Status (2026-10-07):** The RN baseline was bootstrapped on `development` in `mobile/`, not on an `rn/bootstrap` branch. `develop` is unchanged and still holds the Android prototype. `PersonProfile` is implemented without `legalCases`/`disclosures` until Milestone 4 (see `docs/DATA_MODEL.md`). Still to decide: archive `develop` as `archive/android-native`.

Recommended branch strategy:

- keep existing `develop` as Android prototype until migration starts
- create `rn/bootstrap` from an agreed base
- once RN baseline is stable, decide whether:
  - `develop` becomes RN development branch, or
  - archive native Android in `archive/android-native`

Avoid mixing native prototype and new RN implementation in the same folder structure during the bootstrap.
