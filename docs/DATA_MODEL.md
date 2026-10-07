# Data Model

## Core rule

Do not store a political profile as one giant candidate object.

Separate identity from time-dependent and source-dependent records.

## Core entities

### `Person`

Stable identity of a political/public figure.

```ts
type Person = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  preferredName?: string;
  birthDate?: string;
  photoAssetId?: string;
};
```

Age should normally be calculated from `birthDate`, not stored.

### `Election`

```ts
type Election = {
  id: string;
  name: string;
  electionDate: string;
  countryCode: "PH";
  status: "UPCOMING" | "ONGOING" | "COMPLETED";
};
```

### `Office`

```ts
type Office = {
  id: string;
  name: string;
  level: "NATIONAL" | "PROVINCIAL" | "CITY" | "MUNICIPAL" | "DISTRICT" | "BARANGAY";
  jurisdictionId?: string;
};
```

### `ElectionParticipation`

Connects a person to an election and office.

```ts
type ElectionParticipation = {
  id: string;
  personId: string;
  electionId: string;
  officeId: string;
  ballotNumber?: string;
  status:
    | "POTENTIAL_ASPIRANT"
    | "PUBLICLY_DECLARED_ASPIRANT"
    | "FILED_COC"
    | "OFFICIAL_CANDIDATE"
    | "WITHDRAWN"
    | "DISQUALIFIED"
    | "ELECTED"
    | "NOT_ELECTED";
  effectiveFrom: string;
  effectiveTo?: string;
};
```

Status must be supported by evidence.

### `OfficeTerm`

```ts
type OfficeTerm = {
  id: string;
  personId: string;
  officeId: string;
  startDate?: string;
  endDate?: string;
  status: "HELD" | "ACTING" | "APPOINTED" | "ELECTED";
};
```

### `PoliticalOrganization`

Represents parties, party-list organizations, coalitions, and similar organizations.

### `AffiliationRecord`

```ts
type AffiliationRecord = {
  id: string;
  personId: string;
  organizationId: string;
  affiliationType: "MEMBER" | "CANDIDATE" | "LEADER" | "ENDORSED_BY" | "COALITION";
  startDate?: string;
  endDate?: string;
};
```

### `EducationRecord`

Structured institution/program/credential/date fields.

### `AwardRecord`

Must include issuer and source.

### `PolicyPositionRecord`

```ts
type PolicyPositionRecord = {
  id: string;
  personId: string;
  topic: string;
  positionText: string;
  attributionType:
    | "SELF_DECLARED"
    | "OFFICIAL_PLATFORM"
    | "LEGISLATIVE_ACTION"
    | "INTERVIEW"
    | "SPEECH";
  statedAt?: string;
};
```

Do not have AI summarize a position into a stronger claim than the evidence supports.

### `LegalCaseRecord`

```ts
type LegalCaseRecord = {
  id: string;
  personId: string;
  authority: string;
  caseNumber?: string;
  title?: string;
  proceedingType?: string;
  status:
    | "COMPLAINT"
    | "UNDER_INVESTIGATION"
    | "CASE_FILED"
    | "CHARGED"
    | "PENDING"
    | "DISMISSED"
    | "ACQUITTED"
    | "CONVICTED"
    | "ON_APPEAL"
    | "FINAL_JUDGMENT"
    | "OTHER";
  filingDate?: string;
  statusDate?: string;
  neutralSummary?: string;
};
```

Never derive `hasCriminalRecord`.

### `AssetDisclosureRecord`

```ts
type AssetDisclosureRecord = {
  id: string;
  personId: string;
  disclosureType: string;
  reportingDate?: string;
  netWorthAmount?: number;
  currency?: "PHP";
};
```

Values require source evidence.

## Evidence system

### `Source`

```ts
type Source = {
  id: string;
  title: string;
  publisher: string;
  url?: string;
  sourceType:
    | "OFFICIAL_GOVERNMENT"
    | "COURT_OR_TRIBUNAL"
    | "OFFICIAL_CANDIDATE"
    | "LEGISLATIVE_RECORD"
    | "NEWS"
    | "ACADEMIC"
    | "OTHER";
  publishedAt?: string;
  retrievedAt: string;
  archivedUrl?: string;
};
```

### `Claim`

A claim is a precise proposition displayed or used by the application.

```ts
type Claim = {
  id: string;
  subjectPersonId?: string;
  claimType: string;
  statement: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  verificationStatus:
    | "PRIMARY_SOURCE"
    | "CORROBORATED"
    | "SELF_DECLARED"
    | "REPORTED"
    | "DISPUTED"
    | "UNVERIFIED"
    | "OUTDATED";
  lastReviewedAt?: string;
};
```

### `ClaimEvidence`

Many-to-many relationship between claims and sources.

```ts
type ClaimEvidence = {
  claimId: string;
  sourceId: string;
  supports: boolean;
  note?: string;
};
```

## Audit

### `Revision`

Track:
- entity/claim changed
- old value
- new value
- editor
- reason
- timestamp
- approval state

Published political data should not change without traceability.

## Phase 2 relationship graph

Add:

```ts
type PersonRelationship = {
  id: string;
  personAId: string;
  personBId: string;
  relationship:
    | "PARENT"
    | "CHILD"
    | "SIBLING"
    | "SPOUSE"
    | "OTHER";
  startDate?: string;
  endDate?: string;
};
```

The UI may show documented relationships and offices held by related people.

Avoid automatically labeling a family as a "dynasty" unless a clearly defined, published methodology is adopted.
