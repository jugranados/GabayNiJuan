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

```ts
type PoliticalOrganization = {
  id: string;
  name: string;
  abbreviation?: string;
  organizationType: "POLITICAL_PARTY" | "PARTY_LIST" | "COALITION" | "OTHER";
};
```

No color, ideology, or "bloc" field. Those are not facts unless documented and sourced.

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

```ts
type EducationRecord = {
  id: string;
  personId: string;
  institution: string;
  program?: string;
  credential?: string;
  startDate?: string;
  endDate?: string;
};
```

### `AwardRecord`

Must include issuer and source.

```ts
type AwardRecord = {
  id: string;
  personId: string;
  title: string;
  issuer: string; // required
  awardedAt?: string;
};
```

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
  documentIdentifier?: string; // e.g. resolution/docket number when there is no URL
  publishedAt?: string;
  retrievedAt: string;
  archivedUrl?: string;
};
```

A source must have a `url` (http/https only) or a `documentIdentifier`.

### `Claim`

A claim is a precise proposition displayed or used by the application.

```ts
type Claim = {
  id: string;
  subjectPersonId?: string;
  // The record this claim attests to, so evidence can be shown beside it.
  subjectRecord?: {
    type:
      | "PERSON"
      | "ELECTION_PARTICIPATION"
      | "OFFICE_TERM"
      | "AFFILIATION"
      | "EDUCATION"
      | "AWARD"
      | "POLICY_POSITION"
      | "LEGAL_CASE"
      | "ASSET_DISCLOSURE";
    id: string;
  };
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

`subjectRecord` (added in Milestone 0) links a claim to the record it supports. A record with no linked claim is displayed as "Unverified, no source attached", never as established fact.

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

```ts
type Revision = {
  id: string;
  entityType:
    | "PERSON" | "ELECTION" | "OFFICE" | "POLITICAL_ORGANIZATION"
    | "ELECTION_PARTICIPATION" | "OFFICE_TERM" | "AFFILIATION" | "EDUCATION" | "AWARD"
    | "POLICY_POSITION" | "LEGAL_CASE" | "ASSET_DISCLOSURE"
    | "SOURCE" | "CLAIM" | "CLAIM_EVIDENCE";
  entityId: string; // record id, or "claimId:sourceId" for evidence
  oldValue?: JsonValue; // row snapshot before
  newValue?: JsonValue; // row snapshot after
  editorId: string; // auth user id, or "system:<db role>"
  approverId?: string;
  reason: string;
  createdAt: string; // ISO timestamp with offset
  approvalState: PublicationStatus; // the record's status after the change
};
```

Revisions are written by database triggers, never by clients, and cannot be updated or deleted.

## Publication workflow fields (database)

Every publishable table (all except `claim_evidence`, `revisions`, `editorial_roles`) has:

| Column | Meaning |
|---|---|
| `publication_status` | `DRAFT` → `SOURCE_ATTACHED` → `REVIEWED` → `APPROVED` → `PUBLISHED`, or `RETRACTED` |
| `published_at` | when the row was first published (`record_published_at` on `sources`, where `published_at` is the source's own publication date) |
| `created_by`, `approved_by` | Supabase Auth user ids |
| `created_at`, `updated_at` | row timestamps |

Only `PUBLISHED` rows are visible to voters. The app's Zod schemas ignore these workflow columns. `claim_evidence` has no status of its own: it is public when both its claim and its source are published.

IDs are UUIDs in the database. The app treats ids as opaque strings, so the slug ids in the in-app fixtures are equally valid.

## Implementation notes (Milestone 0)

- Domain types live in `mobile/src/domain/models`. Enums are readonly tuples in `mobile/src/domain/enums`, shared with Zod.
- Backend row contracts (snake_case) live in `mobile/src/data/schemas/rows.ts`. Table names (implemented in `supabase/migrations`): `people`, `elections`, `offices`, `election_participations`, `office_terms`, `political_organizations`, `affiliation_records`, `education_records`, `award_records`, `policy_position_records`, `legal_case_records`, `asset_disclosure_records`, `sources`, `claims`, `claim_evidence`, `revisions`. Change a migration and its schema in the same commit; `mobile/src/data/supabase/schemaDrift.ts` fails typecheck when they diverge.
- Dates use `YYYY-MM-DD`. Impossible dates and reversed ranges (end before start) are rejected.
- An asset disclosure amount requires a currency.
- `PersonProfile` (read model) does not include legal cases or disclosures until Milestone 4. Their absence must never be shown as "none on record".
- Never stored or derived: `hasCriminalRecord`, scores, ratings, rankings, endorsements, predictions, political color.

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
